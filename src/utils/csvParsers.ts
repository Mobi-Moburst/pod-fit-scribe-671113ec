import Papa from 'papaparse';
import { BatchCSVRow, AirtableCSVRow, SOVCSVRow, GEOCSVRow, ContentGapCSVRow, ContentGapEngineData } from '@/types/csv';

// Normalize CSV header names to snake_case
function normalizeHeaderName(header: string): string {
  return header
    .toLowerCase()
    .replace(/\s*\/\s*/g, '_') // "Date / Time" → "date_time"
    .replace(/\s+/g, '_') // Spaces to underscases
    .replace(/[^a-z0-9_]/g, '') // Remove other special chars
    .trim();
}

// Parse Airtable date format: "4/10/2025 9:30am" or "3/27/2025"
export function parseAirtableDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    // Try standard date parsing first (for simple dates like "3/27/2025")
    const standardParse = new Date(dateStr);
    if (!isNaN(standardParse.getTime())) {
      return standardParse;
    }
    
    // Handle format: "M/D/YYYY H:MMam/pm"
    const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(am|pm))?/i);
    if (!match) return null;
    
    const [, month, day, year, hourStr, minuteStr, ampm] = match;
    let hours = hourStr ? parseInt(hourStr, 10) : 0;
    const minutes = minuteStr ? parseInt(minuteStr, 10) : 0;
    
    // Convert to 24-hour format if needed
    if (ampm && hourStr) {
      if (ampm.toLowerCase() === 'pm' && hours !== 12) {
        hours += 12;
      } else if (ampm.toLowerCase() === 'am' && hours === 12) {
        hours = 0;
      }
    }
    
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes);
  } catch (error) {
    console.error('[parseAirtableDate] Error parsing:', dateStr, error);
    return null;
  }
}

// Normalize podcast title for matching
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Check if titles match (exact or partial prefix match)
export function titlesMatch(title1: string, title2: string): boolean {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);
  
  // Exact match
  if (norm1 === norm2) return true;
  
  // Partial match: shorter title is prefix of longer title
  // e.g., "ai chat" matches "ai chat chatgpt ai news artificial intelligence"
  const shorter = norm1.length < norm2.length ? norm1 : norm2;
  const longer = norm1.length < norm2.length ? norm2 : norm1;
  
  return longer.startsWith(shorter);
}

// Parse Batch Results CSV
export function parseBatchCSV(csvText: string): BatchCSVRow[] {
  const result = Papa.parse<BatchCSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeaderName,
  });
  
  // Debug logging
  const uniqueStatuses = new Set(result.data.map(row => row.status));
  console.log('[parseBatchCSV] Parsed batch CSV:', {
    totalRows: result.data.length,
    headers: result.meta?.fields,
    uniqueStatuses: Array.from(uniqueStatuses),
    sampleRows: result.data.slice(0, 3),
  });
  
  return result.data;
}

// Parse Airtable CSV with date filtering
export function parseAirtableCSV(
  csvText: string,
  startDate: Date,
  endDate: Date
): AirtableCSVRow[] {
  console.log('[parseAirtableCSV] Input params:', {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    csvPreview: csvText.substring(0, 200)
  });

  const result = Papa.parse<AirtableCSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeaderName,
  });
  
  console.log('[parseAirtableCSV] After parse:', {
    totalRows: result.data.length,
    headers: result.meta?.fields,
    firstRow: result.data[0],
    errors: result.errors,
  });
  
  // Filter by scheduled_date_time (recording date) OR date_published OR date_booked
  const filtered = result.data.filter(row => {
    let inRange = false;
    
    // Check recording date
    if (row.scheduled_date_time) {
      const scheduledDate = parseAirtableDate(row.scheduled_date_time);
      if (scheduledDate && scheduledDate >= startDate && scheduledDate <= endDate) {
        inRange = true;
      }
    }
    
    // Check publish date
    if (!inRange && row.date_published) {
      const publishedDate = parseAirtableDate(row.date_published);
      if (publishedDate && publishedDate >= startDate && publishedDate <= endDate) {
        inRange = true;
      }
    }
    
    // Check booked date (for total_booked KPI - rows booked within quarter)
    if (!inRange && row.date_booked) {
      const bookedDate = parseAirtableDate(row.date_booked);
      if (bookedDate && bookedDate >= startDate && bookedDate <= endDate) {
        inRange = true;
      }
    }
    
    return inRange;
  });
  
  console.log('[parseAirtableCSV] After filtering:', {
    filteredCount: filtered.length,
    samples: filtered.slice(0, 3)
  });
  
  return filtered;
}

// Parse SOV CSV
export function parseSOVCSV(csvText: string): SOVCSVRow[] {
  const result = Papa.parse<SOVCSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeaderName,
  });
  return result.data;
}

// Extract competitor name from CSV filename or content
export function extractCompetitorName(filename: string): string {
  // Remove file extension and common patterns
  return filename
    .replace(/\.csv$/i, '')
    .replace(/sov[-_]?/i, '')
    .replace(/listennotes[-_]?/i, '')
    .replace(/listen[-_]?notes[-_]?/i, '')
    .trim();
}

// Parse GEO CSV (Spotlight AEO/GEO export)
export function parseGEOCSV(csvText: string): GEOCSVRow[] {
  const result = Papa.parse<GEOCSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeaderName,
  });
  
  // Filter for podcasts.apple.com domain only
  const podcastEntries = result.data.filter(row => 
    row.domain && row.domain.toLowerCase().includes('podcasts.apple')
  );
  
  console.log('[parseGEOCSV] Parsed GEO CSV:', {
    totalRows: result.data.length,
    podcastEntries: podcastEntries.length,
    uniqueEngines: [...new Set(podcastEntries.map(r => r.llm))],
    sampleRows: podcastEntries.slice(0, 3),
  });
  
  return podcastEntries;
}

// Parse Content Gap CSV (Spotlight Content Gap Analysis export)
export function parseContentGapCSV(csvText: string): ContentGapCSVRow[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  
  if (result.data.length === 0) return [];
  
  // Detect AI engines from column headers
  // Headers like "gemini - Present", "chatgpt - Rank", etc.
  const headers = result.meta?.fields || [];
  const engineNames = new Set<string>();
  
  headers.forEach(header => {
    const match = header.match(/^(.+?)\s*-\s*(Present|Rank|Sentiment|Mentioned Brands)$/i);
    if (match) {
      engineNames.add(match[1].toLowerCase().trim());
    }
  });
  
  const engines = Array.from(engineNames);
  console.log('[parseContentGapCSV] Detected engines:', engines);
  
  // Parse each row
  const parsed: ContentGapCSVRow[] = result.data.map(row => {
    // Normalize keys for access
    const normalizedRow: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      normalizedRow[key.toLowerCase().trim()] = String(value ?? '');
    });
    
    // Extract engine data
    const engineData: ContentGapEngineData[] = engines.map(engine => {
      // Try different header variations
      const presentKey = Object.keys(row).find(k => 
        k.toLowerCase().includes(engine) && k.toLowerCase().includes('present')
      );
      const rankKey = Object.keys(row).find(k => 
        k.toLowerCase().includes(engine) && k.toLowerCase().includes('rank')
      );
      const sentimentKey = Object.keys(row).find(k => 
        k.toLowerCase().includes(engine) && k.toLowerCase().includes('sentiment')
      );
      const brandsKey = Object.keys(row).find(k => 
        k.toLowerCase().includes(engine) && k.toLowerCase().includes('mentioned brands')
      );
      
      const presentValue = presentKey ? row[presentKey] : '';
      const isPresent = presentValue?.toLowerCase() === 'yes';
      
      const brandsValue = brandsKey ? row[brandsKey] : '';
      const brands = brandsValue 
        ? brandsValue.split(',').map(b => b.trim()).filter(Boolean)
        : [];
      
      return {
        name: engine,
        present: isPresent,
        rank: rankKey && row[rankKey] ? parseInt(row[rankKey]) || undefined : undefined,
        sentiment: sentimentKey ? row[sentimentKey] || undefined : undefined,
        mentioned_brands: brands,
      };
    });
    
    // Get base fields
    const topicKey = Object.keys(row).find(k => k.toLowerCase() === 'topic');
    const journeyKey = Object.keys(row).find(k => k.toLowerCase().includes('customer journey'));
    const promptKey = Object.keys(row).find(k => k.toLowerCase() === 'prompt');
    const dateKey = Object.keys(row).find(k => k.toLowerCase().includes('run date'));
    
    return {
      topic: topicKey ? row[topicKey] || '' : '',
      customer_journey: journeyKey ? row[journeyKey] || '' : '',
      prompt: promptKey ? row[promptKey] || '' : '',
      run_date: dateKey ? row[dateKey] || '' : '',
      engines: engineData,
    };
  }).filter(row => row.prompt); // Filter out empty rows
  
  console.log('[parseContentGapCSV] Parsed content gap CSV:', {
    totalRows: parsed.length,
    engines,
    sampleRows: parsed.slice(0, 3),
  });
  
  return parsed;
}
