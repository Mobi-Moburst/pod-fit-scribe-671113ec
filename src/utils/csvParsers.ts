import Papa from 'papaparse';
import { BatchCSVRow, AirtableCSVRow, SOVCSVRow, GEOCSVRow } from '@/types/csv';

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
function parseAirtableDate(dateStr: string): Date | null {
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
  
  // Filter by scheduled_date_time (recording date) OR date_published
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
    
    if (!inRange && row.scheduled_date_time) {
      console.log('[parseAirtableCSV] Filtered out:', {
        podcast: row.podcast_name,
        scheduled: row.scheduled_date_time,
        published: row.date_published,
        reason: 'outside date range'
      });
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
