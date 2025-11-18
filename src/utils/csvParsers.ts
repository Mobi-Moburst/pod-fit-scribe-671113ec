import Papa from 'papaparse';
import { BatchCSVRow, AirtableCSVRow, SOVCSVRow } from '@/types/csv';

// Normalize CSV header names to snake_case
function normalizeHeaderName(header: string): string {
  return header
    .toLowerCase()
    .replace(/\s*\/\s*/g, '_') // "Date / Time" → "date_time"
    .replace(/\s+/g, '_') // Spaces to underscores
    .replace(/[^a-z0-9_]/g, '') // Remove other special chars
    .trim();
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
  return result.data;
}

// Parse Airtable CSV with date filtering
export function parseAirtableCSV(
  csvText: string,
  startDate: Date,
  endDate: Date
): AirtableCSVRow[] {
  const result = Papa.parse<AirtableCSVRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeaderName,
  });
  
  // Filter by scheduled_date_time (recording date)
  return result.data.filter(row => {
    if (!row.scheduled_date_time) return false;
    
    try {
      const scheduledDate = new Date(row.scheduled_date_time);
      return scheduledDate >= startDate && scheduledDate <= endDate;
    } catch {
      return false;
    }
  });
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
