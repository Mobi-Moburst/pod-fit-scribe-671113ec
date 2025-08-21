import { BatchRow, PreflightResult } from '@/types/batch';
import { callScrape, callAnalyze, AnalyzeResult } from '@/utils/api';
import { MinimalClient } from '@/types/clients';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY_PREFIX = 'pfr_batch_cache_';

// ===== URL CONVERSION =====

export async function convertListenNotesToApple(url: string): Promise<string> {
  try {
    // If it's already an Apple Podcast URL, return as-is
    if (url.includes('podcasts.apple.com')) {
      return url;
    }
    
    // If it's not a ListenNotes URL, return as-is
    if (!url.includes('listennotes.com')) {
      return url;
    }

    const { data, error } = await supabase.functions.invoke('convert-podcast-url', {
      body: { url }
    });

    if (error) {
      console.warn('URL conversion failed:', error);
      return url; // Return original URL if conversion fails
    }

    if (data.success && data.apple_podcast_url) {
      console.log(`Converted: ${url} -> ${data.apple_podcast_url}`);
      return data.apple_podcast_url;
    } else {
      console.warn('URL conversion unsuccessful:', data.error);
      return url; // Return original URL if conversion fails
    }
  } catch (error) {
    console.warn('URL conversion error:', error);
    return url; // Return original URL if conversion fails
  }
}

// URL validation and normalization
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    return parsed.href;
  } catch {
    return url.trim();
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function createUrlHash(url: string): string {
  // Simple hash function using built-in string methods
  const normalized = normalizeUrl(url);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 16);
}

// Pre-flight validation with URL conversion
export async function validateAndDedupeUrls(csvData: any[]): Promise<PreflightResult> {
  const urlCounts = new Map<string, number>();
  const validUrls: string[] = [];
  const invalidUrls: { url: string; reason: string }[] = [];
  const conversions: { original: string; converted: string }[] = [];
  
  for (const row of csvData) {
    const url = row.podcast_url || row.url || '';
    if (!url) continue;
    
    // Convert ListenNotes URLs to Apple Podcast URLs
    const convertedUrl = await convertListenNotesToApple(url);
    if (convertedUrl !== url) {
      conversions.push({ original: url, converted: convertedUrl });
    }
    
    const normalized = normalizeUrl(convertedUrl);
    
    if (!isValidUrl(normalized)) {
      invalidUrls.push({ url, reason: 'Invalid URL format' });
      continue;
    }
    
    const count = urlCounts.get(normalized) || 0;
    urlCounts.set(normalized, count + 1);
    
    if (count === 0) {
      validUrls.push(normalized);
    }
  }
  
  const duplicates = Array.from(urlCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([url, count]) => ({ url, count }));
  
  if (conversions.length > 0) {
    console.log(`Converted ${conversions.length} ListenNotes URLs to Apple Podcast URLs`);
  }
  
  return {
    valid_urls: validUrls,
    invalid_urls: invalidUrls,
    duplicates,
    total_unique: validUrls.length
  };
}

// Cache management
export function getCachedResult(urlHash: string): any | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + urlHash);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    const isExpired = Date.now() - parsed.timestamp > CACHE_DURATION;
    
    if (isExpired) {
      localStorage.removeItem(CACHE_KEY_PREFIX + urlHash);
      return null;
    }
    
    return parsed.data;
  } catch {
    return null;
  }
}

export function setCachedResult(urlHash: string, data: any): void {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY_PREFIX + urlHash, JSON.stringify(cacheData));
  } catch (e) {
    console.warn('Failed to cache result:', e);
  }
}

// Process single URL
export async function processSingleUrl(
  row: BatchRow, 
  client: MinimalClient,
  forceRefresh = false
): Promise<BatchRow> {
  try {
    // Convert URL if needed
    const convertedUrl = await convertListenNotesToApple(row.podcast_url);
    const normalizedUrl = normalizeUrl(convertedUrl);
    const urlHash = createUrlHash(normalizedUrl);
    
    // Update row with converted URL
    const updatedRow = { ...row, podcast_url: normalizedUrl };
    
    // Check cache first
    if (!forceRefresh) {
      const cached = getCachedResult(urlHash);
      if (cached) {
        return {
          ...updatedRow,
          status: 'success',
          url_hash: urlHash,
          cache_timestamp: Date.now(),
          ...cached
        };
      }
    }
    
    // Scrape content
    const scrapeResult = await callScrape(normalizedUrl);
    if (!scrapeResult || scrapeResult.error) {
      throw new Error(scrapeResult?.error || 'Failed to scrape content');
    }
    
    const showNotes = scrapeResult.show_notes || updatedRow.show_notes_fallback || '';
    if (!showNotes) {
      throw new Error('No content found');
    }
    
    // Analyze content
    const analyzeResult = await callAnalyze({ client, show_notes: showNotes });
    if (!analyzeResult.success || !analyzeResult.data) {
      throw new Error(analyzeResult.error || 'Analysis failed');
    }
    
    const data = analyzeResult.data as AnalyzeResult;
    
    // Map to batch row format
    const result = {
      ...updatedRow,
      status: 'success' as const,
      url_hash: urlHash,
      cache_timestamp: Date.now(),
      show_title: scrapeResult.title || data.show_title,
      verdict: mapVerdict(data.verdict),
      overall_score: data.overall_score,
      confidence: data.confidence,
      eligibility_class: data.cap_type !== 'none' ? data.cap_type : undefined,
      eligibility_action: data.cap_type !== 'none' ? ('condition' as const) : null,
      last_publish_date: extractPublishDate(scrapeResult),
      rationale_short: createShortRationale(data),
      evaluation_data: data
    };
    
    // Cache the result
    setCachedResult(urlHash, {
      show_title: result.show_title,
      verdict: result.verdict,
      overall_score: result.overall_score,
      confidence: result.confidence,
      eligibility_class: result.eligibility_class,
      eligibility_action: result.eligibility_action,
      last_publish_date: result.last_publish_date,
      rationale_short: result.rationale_short,
      evaluation_data: result.evaluation_data
    });
    
    return result;
  } catch (error) {
    const convertedUrl = await convertListenNotesToApple(row.podcast_url);
    return {
      ...row,
      podcast_url: normalizeUrl(convertedUrl),
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper functions
function mapVerdict(verdict?: string): 'Fit' | 'Consider' | 'Not' {
  switch (verdict) {
    case 'recommend': return 'Fit';
    case 'consider': return 'Consider';
    case 'not_recommended': return 'Not';
    default: return 'Consider';
  }
}

function extractPublishDate(scrapeResult: any): string | undefined {
  // Try to extract publish date from scraped content
  // This is a placeholder - would need more sophisticated extraction
  return undefined;
}

function createShortRationale(data: AnalyzeResult): string {
  if (data.verdict_reason) {
    return data.verdict_reason.substring(0, 100) + (data.verdict_reason.length > 100 ? '...' : '');
  }
  
  const topReason = data.why_fit?.[0] || data.why_not_fit?.[0];
  if (topReason) {
    return topReason.substring(0, 100) + (topReason.length > 100 ? '...' : '');
  }
  
  return 'Analysis completed';
}

// CSV parsing
export function parseCSV(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error('CSV parsing failed: ' + results.errors[0].message));
        } else {
          resolve(results.data);
        }
      },
      error: (error) => reject(error)
    });
  });
}

// Export functionality
export function exportToCSV(rows: BatchRow[], filename = 'batch-results.csv'): void {
  const exportData = rows.map(row => ({
    podcast_url: row.podcast_url,
    show_title: row.show_title || '',
    verdict: row.verdict || '',
    overall_score: row.overall_score || '',
    confidence: row.confidence || '',
    eligibility_class: row.eligibility_class || '',
    eligibility_action: row.eligibility_action || '',
    last_publish_date: row.last_publish_date || '',
    rationale_short: row.rationale_short || '',
    error: row.error || ''
  }));
  
  const csv = Papa.unparse(exportData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}