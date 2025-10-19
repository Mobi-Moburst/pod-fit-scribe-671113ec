import { BatchRow, PreflightResult } from '@/types/batch';
import { callScrape, callAnalyze, AnalyzeResult } from '@/utils/api';
import { MinimalClient } from '@/types/clients';
import Papa from 'papaparse';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY_PREFIX = 'pfr_batch_cache_';

export type CSVFormat = 'rephonic' | 'hubspot' | 'unknown';

// CSV Format Detection
export function detectCSVFormat(csvData: any[]): CSVFormat {
  if (csvData.length === 0) return 'unknown';
  
  const firstRow = csvData[0];
  const headers = Object.keys(firstRow);
  
  // Check for HubSpot indicators
  const hasListenNotes = headers.some(h => 
    h.toLowerCase().includes('listen notes') || 
    h === 'Listen Notes Link'
  );
  const hasShowNotes = headers.includes('Show Notes');
  const hasCompanyName = headers.includes('Company name');
  
  if (hasListenNotes && hasShowNotes && hasCompanyName) {
    return 'hubspot';
  }
  
  // Check for Rephonic indicators
  const hasApplePodcasts = headers.some(h => 
    h === 'Apple Podcasts' || 
    h.toLowerCase() === 'apple podcasts'
  );
  const hasListeners = headers.includes('Listeners Per Episode');
  const hasPublisher = headers.includes('Publisher');
  
  if (hasApplePodcasts && (hasListeners || hasPublisher)) {
    return 'rephonic';
  }
  
  return 'unknown';
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

// Helper to detect URL column
function detectUrlColumn(row: any): string | null {
  const urlColumns = ['podcast_url', 'url', 'Apple Podcasts', 'apple_podcasts', 'Listen Notes Link', 'Website', 'website'];
  for (const col of urlColumns) {
    if (row[col] && typeof row[col] === 'string' && row[col].trim()) {
      return row[col].trim();
    }
  }
  return null;
}

// Helper to detect description column
function detectDescriptionColumn(row: any): string | null {
  const descColumns = ['show_notes_fallback', 'Description', 'description', 'Notes', 'notes'];
  for (const col of descColumns) {
    if (row[col] && typeof row[col] === 'string' && row[col].trim()) {
      return row[col].trim();
    }
  }
  return null;
}

// Pre-flight validation
export function validateAndDedupeUrls(csvData: any[]): PreflightResult {
  const urlCounts = new Map<string, number>();
  const validUrls: string[] = [];
  const invalidUrls: { url: string; reason: string }[] = [];
  
  csvData.forEach(row => {
    const url = detectUrlColumn(row);
    if (!url) return;
    
    const normalized = normalizeUrl(url);
    
    if (!isValidUrl(normalized)) {
      invalidUrls.push({ url, reason: 'Invalid URL format' });
      return;
    }
    
    const count = urlCounts.get(normalized) || 0;
    urlCounts.set(normalized, count + 1);
    
    if (count === 0) {
      validUrls.push(normalized);
    }
  });
  
  const duplicates = Array.from(urlCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([url, count]) => ({ url, count }));
  
  return {
    valid_urls: validUrls,
    invalid_urls: invalidUrls,
    duplicates,
    total_unique: validUrls.length
  };
}

/**
 * Parse full name and email from contact fields
 * Used for both HubSpot "Associated Contact" and Rephonic "Publisher"/"Only Emails"
 */
export interface ParsedContact {
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * Parse contact information from HubSpot's "Associated Contact" field
 * Examples:
 * - "Scott Davison (scottydavison@gmail.com)" → { firstName: "Scott", lastName: "Davison", email: "scottydavison@gmail.com" }
 * - "John Smith, Jane Doe (emails...)" → { firstName: "John", lastName: "Smith", email: "..." } (first contact only)
 */
export function parseContactInfo(associatedContact: string | undefined): ParsedContact {
  const fallback: ParsedContact = {
    firstName: '',
    lastName: '',
    email: ''
  };
  
  if (!associatedContact || associatedContact.trim() === '') {
    return fallback;
  }
  
  // Extract email from parentheses: "(email@example.com)"
  const emailMatch = associatedContact.match(/\(([^)]*@[^)]*)\)/);
  const email = emailMatch ? emailMatch[1].trim() : '';
  
  // Remove email portion to get name
  let nameOnly = associatedContact.replace(/\([^)]*\)/g, '').trim();
  
  // Handle multiple contacts separated by commas - take first one
  if (nameOnly.includes(',')) {
    nameOnly = nameOnly.split(',')[0].trim();
  }
  if (nameOnly.includes(';')) {
    nameOnly = nameOnly.split(';')[0].trim();
  }
  
  // Split name into parts
  const nameParts = nameOnly.split(/\s+/).filter(Boolean);
  
  if (nameParts.length === 0) {
    return { ...fallback, email };
  } else if (nameParts.length === 1) {
    // Single name - treat as first name
    return {
      firstName: nameParts[0],
      lastName: '',
      email
    };
  } else {
    // Multiple parts - first is first name, rest is last name
    return {
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' '),
      email
    };
  }
}

/**
 * Extract numeric percentage from HubSpot's Global Rank field
 * Examples: "Top 10%" → 10, "Top 0.5%" → 0.5, "unranked" → null
 */
export function parseGlobalRankPercentage(globalRank: string | undefined): number | null {
  if (!globalRank || 
      globalRank.toLowerCase() === 'unranked' || 
      globalRank.trim() === '0') {
    return null;
  }
  
  // Extract numbers from strings like "Top 10%" or "Top 0.5%"
  const match = globalRank.match(/(\d+\.?\d*)/);
  if (match && match[1]) {
    const parsed = parseFloat(match[1]);
    // Double-check that we didn't just parse "0" or "0.0"
    if (parsed === 0) {
      return null;
    }
    return parsed;
  }
  
  return null;
}

export function parseContactFirstName(associatedContact: string | undefined): string {
  if (!associatedContact || associatedContact.trim() === '') {
    return 'the host';
  }
  
  // Remove email addresses in parentheses: "(email@example.com)"
  let cleaned = associatedContact.replace(/\([^)]*@[^)]*\)/g, '').trim();
  
  // Handle multiple contacts separated by commas or semicolons - take first one
  if (cleaned.includes(',')) {
    cleaned = cleaned.split(',')[0].trim();
  }
  if (cleaned.includes(';')) {
    cleaned = cleaned.split(';')[0].trim();
  }
  
  // Check if it's a team name (contains "team", "podcast", "podcasts")
  const lowerCleaned = cleaned.toLowerCase();
  if (lowerCleaned.includes('team') || lowerCleaned.includes('podcast')) {
    // Return the full team name
    return cleaned;
  }
  
  // Extract first name from "First Last" format
  const nameParts = cleaned.split(/\s+/);
  if (nameParts.length > 0 && nameParts[0]) {
    return nameParts[0];
  }
  
  // Fallback
  return 'the host';
}

export { detectUrlColumn, detectDescriptionColumn };

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
  forceRefresh = false,
  skipScraping = false
): Promise<BatchRow> {
  try {
    const urlHash = createUrlHash(row.podcast_url);
    
    // Check cache first
    if (!forceRefresh) {
      const cached = getCachedResult(urlHash);
      if (cached) {
        return {
          ...row,
          status: 'success',
          url_hash: urlHash,
          cache_timestamp: Date.now(),
          ...cached
        };
      }
    }
    
    // Scrape content (skip if HubSpot CSV with show notes)
    let showNotes = '';
    let showTitle = '';
    let scrapeResult: any = null;
    
    if (skipScraping && row.show_notes_fallback) {
      // Use provided show notes directly (HubSpot case)
      showNotes = row.show_notes_fallback;
      showTitle = row.metadata?.name || '';
    } else {
      // Scrape content (Rephonic case or fallback)
      scrapeResult = await callScrape(row.podcast_url);
      if (!scrapeResult || scrapeResult.error) {
        throw new Error(scrapeResult?.error || 'Failed to scrape content');
      }
      
      showNotes = scrapeResult.show_notes || row.show_notes_fallback || '';
      showTitle = scrapeResult.title || '';
      
      if (!showNotes) {
        throw new Error('No content found');
      }
    }
    
    // Analyze content
    const analyzeResult = await callAnalyze({ client, show_notes: showNotes });
    if (!analyzeResult.success) {
      // Mark timeout errors as retryable
      if (analyzeResult.error === 'timeout') {
        throw new Error('Analysis timed out - retry available');
      }
      throw new Error(analyzeResult.error || 'Analysis failed');
    }
    if (!analyzeResult.data) {
      throw new Error('No analysis data returned');
    }
    
    const data = analyzeResult.data as AnalyzeResult;
    
    // Map to batch row format
    const result = {
      ...row,
      status: 'success' as const,
      error: undefined,
      url_hash: urlHash,
      cache_timestamp: Date.now(),
      show_title: showTitle || data.show_title,
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
    return {
      ...row,
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
  if (!scrapeResult?.publish_date) return undefined;
  
  try {
    // Parse and validate the date
    const date = new Date(scrapeResult.publish_date);
    if (isNaN(date.getTime())) return undefined;
    
    // Return ISO format for consistency
    return date.toISOString();
  } catch {
    return undefined;
  }
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
    publisher: row.metadata?.publisher || '',
    associated_contact: row.metadata?.associated_contact || '',
    listeners_per_episode: row.metadata?.listeners_per_episode !== undefined ? row.metadata.listeners_per_episode : '',
    monthly_listens: row.metadata?.monthly_listens !== undefined ? row.metadata.monthly_listens : '',
    social_reach: row.metadata?.social_reach || '',
    global_rank: row.metadata?.global_rank || '',
    categories: row.metadata?.categories || '',
    engagement: row.metadata?.engagement !== undefined ? row.metadata.engagement : '',
    language: row.metadata?.language || '',
    status_field: row.metadata?.status || '',
    verdict: row.verdict || '',
    overall_score: row.overall_score !== undefined ? Math.round(row.overall_score) : '',
    confidence: row.confidence !== undefined ? Math.round(row.confidence * 100) : '',
    eligibility_class: row.eligibility_class || '',
    eligibility_action: row.eligibility_action || '',
    last_publish_date: row.last_publish_date || '',
    rationale_short: row.rationale_short || '',
    status: row.status,
    error: row.error || ''
  }));
  
  const csv = Papa.unparse(exportData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

/**
 * Export HubSpot CSV results in ticket import format
 * Only for HubSpot-sourced data
 */
export function exportToHubSpotTickets(
  rows: BatchRow[], 
  campaignManager: string,
  clientName: string,
  filename = 'hubspot-tickets.csv'
): void {
  const exportData = rows.map(row => {
    const contact = parseContactInfo(row.metadata?.associated_contact);
    
    return {
      'Pipeline': 'Agent Master Pipeline',
      'Ticket status': 'Working 1',
      'Ticket owner': campaignManager || '',
      'Ticket Name': row.show_title || row.metadata?.name || '',
      'Company Properties - Record ID': row.metadata?.record_id || '',
      'Ticket Client': clientName || '',
      'Host First Name': contact.firstName,
      'Host Last name': contact.lastName,
      'Host Email': contact.email
    };
  });
  
  const csv = Papa.unparse(exportData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}