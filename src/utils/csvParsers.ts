import Papa from 'papaparse';
import { BatchCSVRow, AirtableCSVRow, SOVCSVRow, GEOCSVRow, ContentGapCSVRow, ContentGapEngineData, RephonicCSVRow } from '@/types/csv';

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

// Check if titles match (exact, prefix, or word-based match)
export function titlesMatch(title1: string, title2: string): boolean {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);
  
  // Exact match
  if (norm1 === norm2) return true;
  
  // Partial match: shorter title is prefix of longer title
  // e.g., "ai chat" matches "ai chat chatgpt ai news artificial intelligence"
  const shorter = norm1.length < norm2.length ? norm1 : norm2;
  const longer = norm1.length < norm2.length ? norm2 : norm1;
  
  if (longer.startsWith(shorter)) return true;
  
  // Word-based match: all significant words from shorter are in longer
  // e.g., "forward slash" matches "the forward slash podcast"
  const words1 = norm1.split(' ').filter(w => w.length > 2); // Skip short words like "the", "a"
  const words2 = norm2.split(' ').filter(w => w.length > 2);
  
  const shorterWords = words1.length < words2.length ? words1 : words2;
  const longerWords = words1.length < words2.length ? words2 : words1;
  
  if (shorterWords.length > 0 && shorterWords.every(w => longerWords.includes(w))) {
    return true;
  }
  
  return false;
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

  const result = Papa.parse<Record<string, string>>(csvText, {
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
  
  // Map raw rows to AirtableCSVRow, handling common column name variations
  const mappedRows: AirtableCSVRow[] = result.data.map(raw => {
    // Handle episode link variations: "link_to_episode", "episode_link", "link"
    const episodeLink = raw.link_to_episode || raw.episode_link || raw.link || '';
    
    return {
      podcast_name: raw.podcast_name || raw.podcast || raw.show_name || raw.name || '',
      apple_podcast_link: raw.apple_podcast_link || raw.apple_link || raw.apple_podcasts || '',
      action: raw.action || '',
      scheduled_date_time: raw.scheduled_date_time || raw.scheduled_date || raw.recording_date || '',
      show_notes: raw.show_notes || raw.notes || '',
      date_booked: raw.date_booked || raw.booked_date || '',
      date_published: raw.date_published || raw.published_date || raw.publish_date || '',
      link_to_episode: episodeLink,
    };
  }).filter(row => row.podcast_name); // Filter out empty rows
  
  console.log('[parseAirtableCSV] After mapping:', {
    mappedCount: mappedRows.length,
    sampleEpisodeLinks: mappedRows.slice(0, 5).map(r => ({ 
      name: r.podcast_name, 
      date_published: r.date_published, 
      link: r.link_to_episode 
    })),
  });
  
  // Filter by scheduled_date_time (recording date) OR date_published OR date_booked
  const filtered = mappedRows.filter(row => {
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
    publishedCount: filtered.filter(r => r.date_published).length,
    withEpisodeLink: filtered.filter(r => r.link_to_episode).length,
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

// Parse GEO CSV (Spotlight AEO/GEO export or Spotlight sources_detailed export)
// Accepts both formats:
//   Spotlight GEO: uri, title, domain, type, llm, prompt_text, topic_name, has_analysis
//   Spotlight sources_detailed: Domain, URL, Model, Topic, Prompt, Run Date
export function parseGEOCSV(csvText: string): { rows: GEOCSVRow[]; parseWarnings: string[] } {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeaderName,
  });

  const warnings: string[] = [];

  if (result.data.length === 0) {
    warnings.push('No data rows found in the CSV file.');
    return { rows: [], parseWarnings: warnings };
  }

  const headers = result.meta?.fields || [];
  const hasRequiredColumns = headers.some(h => ['uri', 'url'].includes(h)) &&
    headers.some(h => ['llm', 'model'].includes(h));

  if (!hasRequiredColumns) {
    warnings.push('Could not find expected columns (URL/URI and Model/LLM). Please check the file format.');
  }

  // Map alternative column names to expected GEO fields
  const mapped: GEOCSVRow[] = result.data
    .map(row => ({
      uri: row.uri || row.url || '',
      title: row.title || '',
      domain: row.domain || new URL(row.uri || row.url || 'http://unknown').hostname.replace(/^www\./, ''),
      type: row.type || '',
      llm: row.llm || row.model || '',
      prompt_text: row.prompt_text || row.prompt || '',
      topic_name: row.topic_name || row.topic || '',
      has_analysis: row.has_analysis || '',
      run_date: row.run_date || row.run_date || '',
    }))
    .filter(row => row.uri && row.llm);

  if (mapped.length === 0) {
    warnings.push('No valid rows found after parsing. Ensure the file has URL and Model/LLM columns with data.');
  } else if (mapped.length < result.data.length) {
    const skipped = result.data.length - mapped.length;
    warnings.push(`${skipped} row${skipped !== 1 ? 's' : ''} skipped due to missing URL or engine data.`);
  }

  const uniqueEngines = [...new Set(mapped.map(r => r.llm))];
  const uniqueDomains = [...new Set(mapped.map(r => r.domain))];

  console.log('[parseGEOCSV] Parsed GEO CSV:', {
    totalRows: mapped.length,
    uniqueEngines,
    topDomains: uniqueDomains.slice(0, 10),
    sampleRows: mapped.slice(0, 3),
  });

  return { rows: mapped, parseWarnings: warnings };
}

// Detect if CSV is in AEO sources format (Domain, URL, Model, Topic, Prompt, Run Date)
function isAEOSourcesFormat(headers: string[]): boolean {
  const normalized = headers.map(h => h.toLowerCase().trim());
  return normalized.includes('domain') && normalized.includes('model') && normalized.includes('prompt') &&
    !normalized.some(h => h.includes('present') || h.includes('rank'));
}

// Convert AEO sources format to ContentGapCSVRow[]
function convertAEOSourcesToContentGap(data: Record<string, string>[], clientDomain?: string): ContentGapCSVRow[] {
  // Group by prompt + topic
  const promptMap = new Map<string, { topic: string; run_date: string; entries: Array<{ domain: string; model: string }> }>();
  
  data.forEach(row => {
    const prompt = row['Prompt'] || row['prompt'] || '';
    const topic = row['Topic'] || row['topic'] || '';
    const model = row['Model'] || row['model'] || '';
    const domain = row['Domain'] || row['domain'] || '';
    const runDate = row['Run Date'] || row['run_date'] || row['run date'] || '';
    
    if (!prompt) return;
    
    const key = `${prompt}|||${topic}`;
    if (!promptMap.has(key)) {
      promptMap.set(key, { topic, run_date: runDate, entries: [] });
    }
    promptMap.get(key)!.entries.push({ domain, model });
  });
  
  // Get unique models/engines
  const allModels = new Set<string>();
  data.forEach(row => {
    const model = row['Model'] || row['model'] || '';
    if (model) allModels.add(model);
  });
  const engines = Array.from(allModels);
  
  // Normalize client domain for matching (strip protocol, www, trailing slash)
  const clientDomainNormalized = clientDomain?.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '') || '';
  
  console.log('[convertAEOSourcesToContentGap] Converting AEO sources:', {
    totalRows: data.length,
    uniquePrompts: promptMap.size,
    engines,
    clientDomain: clientDomainNormalized,
  });
  
  // Convert each prompt group to a ContentGapCSVRow
  const rows: ContentGapCSVRow[] = [];
  promptMap.forEach(({ topic, run_date, entries }, key) => {
    const prompt = key.split('|||')[0];
    
    const engineData: ContentGapEngineData[] = engines.map(engine => {
      const engineEntries = entries.filter(e => e.model === engine);
      const clientPresent = clientDomainNormalized 
        ? engineEntries.some(e => e.domain.toLowerCase().replace(/^www\./, '') === clientDomainNormalized)
        : false;
      
      // Other domains appearing for this engine+prompt are "mentioned brands" (competitors)
      const otherBrands = engineEntries
        .map(e => e.domain.toLowerCase().replace(/^www\./, ''))
        .filter(d => d !== clientDomainNormalized)
        .filter((d, i, arr) => arr.indexOf(d) === i) // dedupe
        .slice(0, 10);
      
      // Rank: if client is present, find their position
      const rank = clientPresent 
        ? engineEntries.findIndex(e => e.domain.toLowerCase().replace(/^www\./, '') === clientDomainNormalized) + 1
        : undefined;
      
      return {
        name: engine.toLowerCase(),
        present: clientPresent,
        rank,
        mentioned_brands: otherBrands,
      };
    });
    
    rows.push({
      topic,
      customer_journey: '', // Not available in this format
      prompt,
      run_date,
      engines: engineData,
    });
  });
  
  return rows;
}

// Parse Content Gap CSV (Spotlight Content Gap Analysis export OR AEO sources export)
export function parseContentGapCSV(csvText: string, clientDomain?: string): ContentGapCSVRow[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  
  if (result.data.length === 0) return [];
  
  const headers = result.meta?.fields || [];
  
  // Check if this is the AEO sources format (Domain, URL, Model, Topic, Prompt)
  if (isAEOSourcesFormat(headers)) {
    console.log('[parseContentGapCSV] Detected AEO sources format, converting...');
    return convertAEOSourcesToContentGap(result.data, clientDomain);
  }
  
  // Original Spotlight Content Gap format
  // Detect AI engines from column headers
  // Headers like "gemini - Present", "chatgpt - Rank", etc.
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

// Parse Rephonic EMV CSV
export function parseRephonicCSV(csvText: string): RephonicCSVRow[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeaderName,
  });
  
  // Map common Rephonic header variations to our standard format
  const parsed: RephonicCSVRow[] = result.data.map(row => {
    // Try different header variations for podcast name
    const podcastName = row.podcast_name || row.show_name || row.name || row.title || row.podcast || '';
    
    // Try different header variations for listeners
    const listenersRaw = row.listeners_per_episode || row.listeners || row.avg_listeners || 
                         row.average_listeners || row.monthly_listeners || '';
    const listeners = listenersRaw ? parseInt(String(listenersRaw).replace(/[^0-9]/g, '')) || 0 : 0;
    
    // Try different header variations for duration
    const durationRaw = row.episode_duration_minutes || row.duration || row.avg_duration || 
                        row.episode_length || row.length || '';
    const duration = durationRaw ? parseFloat(String(durationRaw).replace(/[^0-9.]/g, '')) || 0 : 0;
    
    // Monthly listens
    const monthlyListensRaw = row.monthly_listens || row.monthly_listeners || '';
    const monthlyListens = monthlyListensRaw ? parseInt(String(monthlyListensRaw).replace(/[^0-9]/g, '')) || 0 : 0;
    
    // Social reach (combine social_reach + youtube_subscribers)
    const socialReachRaw = row.social_reach || row.social_followers || '';
    const socialReachVal = socialReachRaw ? parseInt(String(socialReachRaw).replace(/[^0-9]/g, '')) || 0 : 0;
    const youtubeSubsRaw = row.youtube_subscribers || row.youtube_subs || '';
    const youtubeSubsVal = youtubeSubsRaw ? parseInt(String(youtubeSubsRaw).replace(/[^0-9]/g, '')) || 0 : 0;
    const socialReach = socialReachVal + youtubeSubsVal;
    
    // Categories
    const categories = row.categories || '';
    
    // Apple Podcasts link
    const applePodcastLink = row.apple_podcasts || row.apple_podcast_link || row.apple_link || '';
    
    // Description & Publisher
    const description = row.description || '';
    const publisher = row.publisher || '';
    
    // Episode link
    const episodeLink = row.episode_link || row.episode_url || row.url || row.link || '';
    
    // Pre-calculated EMV if provided
    const emvRaw = row.emv || row.earned_media_value || row.value || '';
    const emv = emvRaw ? parseFloat(String(emvRaw).replace(/[^0-9.]/g, '')) || 0 : 0;
    
    return {
      podcast_name: podcastName,
      listeners_per_episode: listeners > 0 ? listeners : undefined,
      monthly_listens: monthlyListens > 0 ? monthlyListens : undefined,
      social_reach: socialReach > 0 ? socialReach : undefined,
      categories: categories || undefined,
      apple_podcast_link: applePodcastLink || undefined,
      description: description || undefined,
      publisher: publisher || undefined,
      episode_duration_minutes: duration > 0 ? duration : undefined,
      episode_link: episodeLink || undefined,
      emv: emv > 0 ? emv : undefined,
    };
  }).filter(row => row.podcast_name); // Filter out empty rows
  
  console.log('[parseRephonicCSV] Parsed Rephonic EMV CSV:', {
    totalRows: parsed.length,
    headers: result.meta?.fields,
    sampleRows: parsed.slice(0, 3),
  });
  
  return parsed;
}
