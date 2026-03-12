import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CompanySpeakerSelector } from "@/components/CompanySpeakerSelector";
import type { Company, Speaker, MinimalClient, Competitor } from "@/types/clients";
import { supabase } from "@/integrations/supabase/client";
import { TEAM_ORG_ID } from "@/integrations/supabase/client";
import { generateReportFromMultipleCSVs, generateMultiSpeakerReport, SpeakerDataInput, generateTalkingPointDescription, generateAITalkingPoints, generatePodcastCategories, scoreAirtablePodcasts } from "@/utils/reportGenerator";
import { parseBatchCSV, parseAirtableCSV, parseGEOCSV, parseContentGapCSV, parseRephonicCSV } from "@/utils/csvParsers";
import { ReportData, TargetPodcast } from "@/types/reports";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { KPICard } from "@/components/reports/KPICard";
import { CampaignOverview } from "@/components/reports/CampaignOverview";
import { NextQuarterStrategy } from "@/components/reports/NextQuarterStrategy";
import { TargetPodcastsSection } from "@/components/reports/TargetPodcastsSection";
import { EMVAnalysisDialog } from "@/components/reports/EMVAnalysisDialog";
import { ReachAnalysisDialog } from "@/components/reports/ReachAnalysisDialog";
import { SOVChartDialog } from "@/components/reports/SOVChartDialog";
import { GEODialog } from "@/components/reports/GEODialog";
import { ContentGapDialog } from "@/components/reports/ContentGapDialog";
import { SocialValueDialog } from "@/components/reports/SocialValueDialog";
import { PodcastListDialog } from "@/components/reports/PodcastListDialog";
import { ContentGapRecommendations } from "@/components/reports/ContentGapRecommendations";
import { AirtableEmbed } from "@/components/reports/AirtableEmbed";
import { SpeakerAccordion } from "@/components/reports/SpeakerAccordion";
import { PublishedEpisodesCarousel } from "@/components/reports/PublishedEpisodesCarousel";
import { Upload, FileText, TrendingUp, Users, Printer, Calendar, Radio, Mic, Trash2, Eye, DollarSign, PieChart, Sparkles, Search, Clipboard, X, AlertTriangle, ChevronDown, ChevronRight, Globe, Link, Copy, ExternalLink, Video, RefreshCw, Share2, Link2, Loader2, Building2, Check, PhoneCall, Info, Plus } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AirtableSyncButton } from "@/components/airtable/AirtableSyncButton";
import { AirtableConnectionDialog } from "@/components/airtable/AirtableConnectionDialog";
import { AirtableCSVRow } from "@/hooks/use-airtable-connection";
import { useToast } from "@/hooks/use-toast";
import { HighlightClip } from "@/types/reports";
import HighlightUploadDialog from "@/components/reports/HighlightUploadDialog";
import ClientReportHighlights from "@/components/client-report/ClientReportHighlights";
import { CampaignOverviewEditDialog } from "@/components/reports/CampaignOverviewEditDialog";
import { NextQuarterEditDialog } from "@/components/reports/NextQuarterEditDialog";
import { UpdateCSVDialog } from "@/components/reports/UpdateCSVDialog";
import { AirtableDataPreview } from "@/components/reports/AirtableDataPreview";

export default function Reports() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(null);
  
  // Multi-speaker mode state
  const [isMultiSpeakerMode, setIsMultiSpeakerMode] = useState(false);
  const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<string[]>([]);
  const [speakerFiles, setSpeakerFiles] = useState<{
    [speakerId: string]: {
      batchFile: File | null;
      airtableFile: File | null;
    };
  }>({});
  const [speakerSyncedData, setSpeakerSyncedData] = useState<{
    [speakerId: string]: AirtableCSVRow[] | null;
  }>({});
  const [speakerFileExpanded, setSpeakerFileExpanded] = useState<{ [speakerId: string]: boolean }>({});
  
  // Single-speaker file uploads
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [airtableFile, setAirtableFile] = useState<File | null>(null);
  const [airtableSyncedData, setAirtableSyncedData] = useState<AirtableCSVRow[] | null>(null);
  const [airtableConnectionDialogOpen, setAirtableConnectionDialogOpen] = useState(false);
  const [connectionVersion, setConnectionVersion] = useState(0);
  
  // Company-level file uploads (shared for multi-speaker)
  const [sovFile, setSOVFile] = useState<File | null>(null); // kept for backward compat, always null
  const [geoFile, setGeoFile] = useState<File | null>(null);
  const [contentGapFile, setContentGapFile] = useState<File | null>(null);
  const [rephonicEmvFile, setRephonicEmvFile] = useState<File | null>(null);
  
  // Manual SOV inputs
  const [manualSOVMode, setManualSOVMode] = useState(false);
  const [competitorInterviews, setCompetitorInterviews] = useState<{ name: string; role: string; count: number; episodeUrls?: string[]; episodes?: Array<{ title: string; podcast_name: string; air_date: string; role: string }> }[]>([]);
  const [expandedCompetitorEpisodes, setExpandedCompetitorEpisodes] = useState<{ [index: number]: boolean }>({});
  
  // Report metadata
  const [reportName, setReportName] = useState<string>('');
  const [quarter, setQuarter] = useState<string>('');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Advanced EMV settings
  const [cpmRate, setCpmRate] = useState<number>(50);
  const [speakingTimePct, setSpeakingTimePct] = useState<number>(40);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  
  // State
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [allReports, setAllReports] = useState<any[]>([]);
  const [allReportsSearchQuery, setAllReportsSearchQuery] = useState('');
  const [allReportsExpanded, setAllReportsExpanded] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [selectedCampaignManager, setSelectedCampaignManager] = useState<string>('');
  const [dataSourcesOpen, setDataSourcesOpen] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emvDialogOpen, setEmvDialogOpen] = useState(false);
  const [reachDialogOpen, setReachDialogOpen] = useState(false);
  const [sovDialogOpen, setSOVDialogOpen] = useState(false);
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  const [contentGapDialogOpen, setContentGapDialogOpen] = useState(false);
  const [socialValueDialogOpen, setSocialValueDialogOpen] = useState(false);
  const [bookedDialogOpen, setBookedDialogOpen] = useState(false);
  const [publishedDialogOpen, setPublishedDialogOpen] = useState(false);
  const [recordedDialogOpen, setRecordedDialogOpen] = useState(false);
  const [introCallsDialogOpen, setIntroCallsDialogOpen] = useState(false);
  const [highlightsDialogOpen, setHighlightsDialogOpen] = useState(false);
  const [campaignOverviewEditOpen, setCampaignOverviewEditOpen] = useState(false);
  const [nextQuarterEditOpen, setNextQuarterEditOpen] = useState(false);
  const [updateCSVDialogOpen, setUpdateCSVDialogOpen] = useState(false);
  const [reportToUpdate, setReportToUpdate] = useState<any>(null);
  const [isRegeneratingTalkingPoints, setIsRegeneratingTalkingPoints] = useState(false);
  const [isRegeneratingCategories, setIsRegeneratingCategories] = useState(false);
  const [scoringProgress, setScoringProgress] = useState<{ completed: number; total: number } | null>(null);
  const [isScoringFit, setIsScoringFit] = useState(false);
  const [isFetchingSOV, setIsFetchingSOV] = useState(false);
  const [sovFetchError, setSovFetchError] = useState<string | null>(null);
  const [fetchingEpisodeMetadata, setFetchingEpisodeMetadata] = useState<{ [index: number]: boolean }>({});
  
  // Visibility state for report sections
  const [visibleSections, setVisibleSections] = useState({
    // Core KPIs
    totalBooked: true,
    totalPublished: true,
    totalRecorded: true,
    totalIntroCalls: true,
    socialReach: true,
    totalReach: true,
    averageScore: true,
    // Additional Value Metrics
    emv: true,
    sov: true,
    geoScore: true,
    contentGap: true,
    socialValue: true,
    // Other Sections
    campaignOverview: true,
    airtableEmbed: true,
    topCategories: true,
    nextQuarterStrategy: true,
    targetPodcasts: true,
    contentGapRecommendations: true,
    highlights: true,
  });
  
  const toggleSection = async (key: keyof typeof visibleSections) => {
    const newVisibleSections = { ...visibleSections, [key]: !visibleSections[key] };
    setVisibleSections(newVisibleSections);
    
    // Auto-save visibility changes for saved reports
    // IMPORTANT: Fetch fresh data from DB to avoid overwriting other fields like highlight_clips
    if (currentReportId) {
      try {
        const { data: freshReport, error: fetchError } = await supabase
          .from('reports')
          .select('report_data')
          .eq('id', currentReportId)
          .single();
        
        if (fetchError) throw fetchError;
        
        const freshReportData = freshReport.report_data as unknown as ReportData;
        const updatedReportData = { ...freshReportData, visibleSections: newVisibleSections };
        
        // Also update local state to stay in sync
        setReportData(updatedReportData);
        
        await supabase
          .from('reports')
          .update({ report_data: updatedReportData as any })
          .eq('id', currentReportId);
      } catch (error) {
        console.error('Error saving visibility changes:', error);
      }
    }
  };
  
  const coreKPIsVisible = visibleSections.totalBooked || visibleSections.totalPublished || visibleSections.totalRecorded ||
    visibleSections.socialReach || visibleSections.totalReach || visibleSections.averageScore;
  const additionalMetricsVisible = visibleSections.emv || visibleSections.sov || visibleSections.geoScore || visibleSections.contentGap || visibleSections.socialValue;
  
  const { toast } = useToast();

  const getQuarterDates = (quarterValue: string, year: number) => {
    const quarters: Record<string, { start: string; end: string }> = {
      'Q1': { start: `${year}-01-01`, end: `${year}-03-31` },
      'Q2': { start: `${year}-04-01`, end: `${year}-06-30` },
      'Q3': { start: `${year}-07-01`, end: `${year}-09-30` },
      'Q4': { start: `${year}-10-01`, end: `${year}-12-31` },
    };
    return quarters[quarterValue];
  };

  const handleQuarterChange = (value: string) => {
    setSelectedQuarter(value);
    if (value !== 'custom') {
      const dates = getQuarterDates(value, selectedYear);
      setDateRangeStart(dates.start);
      setDateRangeEnd(dates.end);
      setQuarter(`${value} ${selectedYear}`);
    } else {
      setDateRangeStart('');
      setDateRangeEnd('');
      setQuarter('');
    }
  };

  const handleYearChange = (value: string) => {
    const year = parseInt(value);
    setSelectedYear(year);
    if (selectedQuarter && selectedQuarter !== 'custom') {
      const dates = getQuarterDates(selectedQuarter, year);
      setDateRangeStart(dates.start);
      setDateRangeEnd(dates.end);
      setQuarter(`${selectedQuarter} ${year}`);
    }
  };

  const loadAllReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        companies(name),
        speakers(name)
      `)
      .order('generated_at', { ascending: false });
    
    if (!error) {
      setAllReports(data || []);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const [companiesRes, speakersRes] = await Promise.all([
        supabase.from('companies').select('*').is('archived_at', null).order('name', { ascending: true }),
        supabase.from('speakers').select('*').is('archived_at', null).order('name', { ascending: true }),
      ]);
      
      if (companiesRes.error) {
        console.error('Error loading companies:', companiesRes.error);
        toast({
          title: "Error loading companies",
          description: "Failed to load company list from database.",
          variant: "destructive",
        });
        return;
      }
      
      setCompanies(companiesRes.data as unknown as Company[]);
      setSpeakers(speakersRes.data as unknown as Speaker[]);
    };
    
    loadData();
    loadAllReports();
  }, [toast]);

  // Build legacy-compatible client object from selected speaker
  const selectedSpeaker = useMemo(() => speakers.find(s => s.id === selectedSpeakerId), [speakers, selectedSpeakerId]);
  const selectedCompany = useMemo(() => companies.find(c => c.id === selectedCompanyId), [companies, selectedCompanyId]);
  
  // Speakers for selected company
  const companySpeakers = useMemo(() => 
    speakers.filter(s => s.company_id === selectedCompanyId),
    [speakers, selectedCompanyId]
  );

  // Extract unique campaign managers from all companies
  const campaignManagers = useMemo(() => {
    const managers = new Set<string>();
    companies.forEach(c => {
      if (c.campaign_manager) {
        c.campaign_manager.split(',').forEach(m => {
          const trimmed = m.trim();
          if (trimmed) managers.add(trimmed);
        });
      }
    });
    return Array.from(managers).sort();
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    let filtered = companies;
    // Filter by campaign manager
    if (selectedCampaignManager) {
      filtered = filtered.filter(c => 
        c.campaign_manager?.split(',').map(m => m.trim()).includes(selectedCampaignManager)
      );
    }
    // Filter by search query
    if (companySearchQuery.trim()) {
      const q = companySearchQuery.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [companies, companySearchQuery, selectedCampaignManager]);

  const speakerAsClient: MinimalClient | null = useMemo(() => {
    if (!selectedSpeaker || !selectedCompany) return null;
    return {
      id: selectedSpeaker.id,
      name: selectedSpeaker.name,
      company: selectedCompany.name,
      company_url: selectedCompany.company_url || '',
      logo_url: (selectedCompany as any).logo_url || '',
      brand_colors: (selectedCompany as any).brand_colors || undefined,
      headshot_url: (selectedSpeaker as any).headshot_url || '',
      media_kit_url: selectedSpeaker.media_kit_url || '',
      target_audiences: selectedSpeaker.target_audiences || [],
      talking_points: selectedSpeaker.talking_points || [],
      avoid: selectedSpeaker.avoid || [],
      notes: selectedCompany.notes || '',
      campaign_strategy: selectedSpeaker.campaign_strategy || '',
      campaign_manager: selectedCompany.campaign_manager || '',
      pitch_template: selectedSpeaker.pitch_template || '',
      title: selectedSpeaker.title || '',
      gender: selectedSpeaker.gender as any,
      guest_identity_tags: selectedSpeaker.guest_identity_tags || [],
      professional_credentials: selectedSpeaker.professional_credentials || [],
      competitors: (selectedSpeaker.competitors as any) || [],
      airtable_embed_url: selectedSpeaker.airtable_embed_url || selectedCompany.airtable_embed_url || ''
    };
  }, [selectedSpeaker, selectedCompany]);

  useEffect(() => {
    if (isMultiSpeakerMode && selectedSpeakerIds.length > 0) {
      // Multi-speaker mode: load saved reports and merge competitors from all selected speakers
      loadSavedReports();
      const allCompetitors: { name: string; role: string; count: number }[] = [];
      const seenNames = new Set<string>();
      
      for (const speakerId of selectedSpeakerIds) {
        const speaker = speakers.find(s => s.id === speakerId);
        const competitors = (speaker?.competitors as Competitor[]) || [];
        
        for (const comp of competitors) {
          if (!seenNames.has(comp.name.toLowerCase())) {
            seenNames.add(comp.name.toLowerCase());
            allCompetitors.push({
              name: comp.name,
              role: comp.role,
              count: 0
            });
          }
        }
      }
      
      if (allCompetitors.length > 0) {
        setManualSOVMode(true);
        setCompetitorInterviews(allCompetitors);
      } else {
        setManualSOVMode(false);
        setCompetitorInterviews([]);
      }
    } else if (selectedSpeakerId) {
      loadSavedReports();
      // Single-speaker mode: load competitors from selected speaker
      if (speakerAsClient?.competitors && speakerAsClient.competitors.length > 0) {
        setManualSOVMode(true);
        setCompetitorInterviews(
          speakerAsClient.competitors.map(comp => ({
            name: comp.name,
            role: comp.role,
            count: 0
          }))
        );
      } else {
        setManualSOVMode(false);
        setCompetitorInterviews([]);
      }
    } else {
      setSavedReports([]);
      setManualSOVMode(false);
      setCompetitorInterviews([]);
    }
  }, [selectedSpeakerId, speakerAsClient, isMultiSpeakerMode, selectedSpeakerIds, speakers, selectedCompanyId]);

  // Helper functions for ListenNotes search
  const generateListenNotesURL = (competitorName: string) => {
    const startTimestamp = new Date(dateRangeStart).getTime();
    const endTimestamp = new Date(dateRangeEnd).getTime();
    
    const params = new URLSearchParams({
      q: `"${competitorName}"`,
      scope: 'episode',
      sort_by_date: '1',
      language: 'English',
      unique_podcasts: '1',
      date_filter: 'custom',
      published_after: startTimestamp.toString(),
      published_before: endTimestamp.toString(),
    });
    
    return `https://www.listennotes.com/search/?${params.toString()}`;
  };

  const copyListenNotesURL = (competitorName: string) => {
    if (!dateRangeStart || !dateRangeEnd) {
      toast({
        title: "Select date range first",
        description: "Please set the report date range before searching.",
        variant: "destructive",
      });
      return;
    }
    const url = generateListenNotesURL(competitorName);
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied!",
      description: `ListenNotes search URL for ${competitorName} copied to clipboard.`,
    });
  };

  const updateCompetitorCount = (index: number, count: number) => {
    setCompetitorInterviews(prev => 
      prev.map((comp, i) => i === index ? { ...comp, count } : comp)
    );
  };

  const autoFetchPeerComparison = async () => {
    if (!dateRangeStart || !dateRangeEnd) {
      toast({
        title: "Select date range first",
        description: "Please set the report date range before auto-fetching.",
        variant: "destructive",
      });
      return;
    }
    if (competitorInterviews.length === 0) return;

    setIsFetchingSOV(true);
    setSovFetchError(null);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-podchaser-credits', {
        body: {
          competitors: competitorInterviews.map(c => ({ name: c.name, role: c.role })),
          date_range: { start: dateRangeStart, end: dateRangeEnd },
        },
      });

      if (error) throw new Error(error.message || 'Failed to fetch credits');
      if (data?.error) throw new Error(data.error);

      const results = data?.results;
      if (results) {
        setCompetitorInterviews(prev =>
          prev.map(comp => {
            const result = results[comp.name];
            if (result && !result.error) {
              return { ...comp, count: result.interview_count, episodes: result.episodes || [] };
            }
            return comp;
          })
        );

        const successCount = Object.values(results).filter((r: any) => !r.error).length;
        const errorCount = Object.values(results).filter((r: any) => r.error).length;

        toast({
          title: "Peer data fetched",
          description: `${successCount} competitor(s) updated${errorCount > 0 ? `, ${errorCount} failed` : ''}.`,
        });
      }
    } catch (err: any) {
      console.error('Auto-fetch SOV error:', err);
      const msg = err.message || 'Failed to fetch peer comparison data';
      setSovFetchError(msg);
      toast({
        title: "Auto-fetch failed",
        description: msg.includes('credits') ? "Credits API may not be available on your Podchaser plan. Use manual entry or CSV instead." : msg,
        variant: "destructive",
      });
    } finally {
      setIsFetchingSOV(false);
    }
  };

  const loadSavedReports = async () => {
    if (!selectedCompanyId) return;
    
    let query = supabase
      .from('reports')
      .select('*')
      .eq('company_id', selectedCompanyId)
      .order('generated_at', { ascending: false });
    
    // For single-speaker mode, filter to that speaker's reports
    // For multi-speaker mode, filter to reports where speaker_id is null
    if (isMultiSpeakerMode) {
      query = query.is('speaker_id', null);
    } else if (selectedSpeakerId) {
      query = query.eq('speaker_id', selectedSpeakerId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error loading reports:', error);
      return;
    }
    
    setSavedReports(data || []);
  };

  const handleGenerateReport = async () => {
    // Reset current report ID since we're generating a new report
    setCurrentReportId(null);
    
    // Common validation
    if (!dateRangeStart || !dateRangeEnd) {
      toast({
        title: "Missing date range",
        description: "Please select start and end dates.",
        variant: "destructive",
      });
      return;
    }

    const startDate = new Date(dateRangeStart);
    const endDate = new Date(dateRangeEnd);
    
    // Multi-speaker mode
    if (isMultiSpeakerMode) {
      if (selectedSpeakerIds.length < 2) {
        toast({
          title: "Select at least 2 speakers",
          description: "Multi-speaker reports require at least 2 speakers.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate all speakers have airtable data (batch file is now optional)
      for (const speakerId of selectedSpeakerIds) {
        const files = speakerFiles[speakerId];
        const syncedData = speakerSyncedData[speakerId];
        const hasAirtableData = !!syncedData || !!files?.airtableFile;
        
        if (!hasAirtableData) {
          const speaker = speakers.find(s => s.id === speakerId);
          toast({
            title: "Missing data",
            description: `${speaker?.name || 'Speaker'} is missing Airtable data. Sync or upload a CSV.`,
            variant: "destructive",
          });
          return;
        }
      }
      
      if (!selectedCompany) {
        toast({
          title: "Company not found",
          description: "Selected company could not be found.",
          variant: "destructive",
        });
        return;
      }
      
      setIsProcessing(true);
      
      try {
        // Prepare speaker data
        const speakerDataInputs: SpeakerDataInput[] = [];
        
        for (const speakerId of selectedSpeakerIds) {
          const speaker = speakers.find(s => s.id === speakerId);
          const files = speakerFiles[speakerId];
          const syncedData = speakerSyncedData[speakerId];
          
          if (!speaker) continue;
          
          // Use synced data if available, otherwise parse CSV
          let airtableRows: any[];
          if (syncedData && syncedData.length > 0) {
            airtableRows = syncedData;
          } else if (files?.airtableFile) {
            const airtableText = await files.airtableFile.text();
            airtableRows = parseAirtableCSV(airtableText, startDate, endDate);
          } else {
            continue;
          }

          // Create stub batch rows from Airtable (no scoring - can be done post-generation)
          const batchRows = airtableRows
            .filter((r: any) => String(Array.isArray(r.action) ? r.action[0] : r.action || '').toLowerCase().includes('podcast recording'))
            .map((r: any) => ({
              show_title: r.podcast_name || '',
              verdict: 'Consider' as const,
              overall_score: 0,
              status: 'success',
              rationale_short: 'Score not yet generated',
            }));
          
          speakerDataInputs.push({
            speaker: speaker as Speaker,
            batchRows,
            airtableRows,
          });
        }
        
        // Parse company-level CSVs
        const sovText: string | null = null;
        const geoText = geoFile ? await geoFile.text() : null;
        const contentGapText = contentGapFile ? await contentGapFile.text() : null;
        
        // Parse Rephonic CSV from per-speaker batchFile uploads
        let rephonicRows: ReturnType<typeof parseRephonicCSV> | undefined;
        const firstSpeakerFiles = speakerFiles[selectedSpeakerIds[0]];
        if (firstSpeakerFiles?.batchFile) {
          rephonicRows = parseRephonicCSV(await firstSpeakerFiles.batchFile.text());
        }
        
        const sovRows = null;
        const geoRows = geoText ? parseGEOCSV(geoText) : [];
        const contentGapRows = contentGapText ? parseContentGapCSV(contentGapText) : [];
        
        // Prepare manual SOV data (include episode URLs)
        const manualSOVCompetitors = manualSOVMode && competitorInterviews.length > 0
          ? competitorInterviews.filter(c => c.count > 0).map(c => ({ ...c, episodeUrls: (c.episodeUrls || []).filter(u => u.trim()) }))
          : null;
        
        // Generate multi-speaker report
        const report = await generateMultiSpeakerReport(
          speakerDataInputs,
          sovRows,
          geoRows,
          contentGapRows,
          selectedCompany as Company,
          reportName || `${selectedCompany.name} - ${quarter || 'Report'}`,
          quarter,
          { start: startDate, end: endDate },
          manualSOVCompetitors,
          cpmRate,
          rephonicRows,
          !!geoFile, // geoCsvProvided
          !!contentGapFile, // contentGapCsvProvided
          speakingTimePct / 100, // Convert percentage to decimal
          // Merge quarterly notes from all selected speakers
          selectedSpeakerIds.flatMap(id => {
            const sp = speakers.find(s => s.id === id);
            return (sp?.quarterly_notes as Array<{ quarter: string; notes: string }>) || [];
          })
        );
        
        setReportData(report);
        if (!reportName) {
          setReportName(`${selectedCompany?.name} - ${quarter || 'Report'}`);
        }
        toast({
          title: "Multi-speaker report generated",
          description: `Processed ${report.speaker_breakdowns?.length || 0} speakers with ${report.kpis.total_booked} total bookings.`,
        });
      } catch (error) {
        console.error("Error generating multi-speaker report:", error);
        toast({
          title: "Error generating report",
          description: error instanceof Error ? error.message : "Failed to process CSVs",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    
    // Single-speaker mode (original logic)
    if (!selectedSpeakerId || !speakerAsClient) {
      toast({
        title: "Select a speaker first",
        description: "Please select a company and speaker before generating a report.",
        variant: "destructive",
      });
      return;
    }
    if (!airtableSyncedData?.length && !airtableFile) {
      toast({
        title: "Missing Airtable data",
        description: "Sync from Airtable or upload an Airtable CSV to generate a report.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Read CSV files
      const sovText: string | null = null;
      const geoText = geoFile ? await geoFile.text() : null;
      const contentGapText = contentGapFile ? await contentGapFile.text() : null;
      
      // Parse Airtable data - use synced data first, fall back to file
      let airtableRows: any[];
      if (airtableSyncedData && airtableSyncedData.length > 0) {
        airtableRows = airtableSyncedData;
      } else if (airtableFile) {
        const airtableText = await airtableFile.text();
        airtableRows = parseAirtableCSV(airtableText, startDate, endDate);
      } else {
        airtableRows = [];
      }

      // Parse Rephonic CSV (uploaded in the "Rephonic CSV" field, formerly "Batch Results CSV")
      const rephonicRows = batchFile ? parseRephonicCSV(await batchFile.text()) : undefined;

      // Create stub batch rows from Airtable data (no scoring - can be done post-generation)
      const batchRows: any[] = airtableRows
        .filter((r: any) => String(Array.isArray(r.action) ? r.action[0] : r.action || '').toLowerCase().includes('podcast recording'))
        .map((r: any) => ({
          show_title: r.podcast_name || '',
          verdict: 'Consider' as const,
          overall_score: 0,
          status: 'success',
          rationale_short: 'Score not yet generated',
        }));

      const sovRows = null;
      const geoRows = geoText ? parseGEOCSV(geoText) : [];
      const contentGapRows = contentGapText ? parseContentGapCSV(contentGapText) : [];
      
      // Prepare manual SOV data if in manual mode
      const manualSOVCompetitors = manualSOVMode && competitorInterviews.length > 0
        ? competitorInterviews.filter(c => c.count > 0).map(c => ({ ...c, episodeUrls: (c.episodeUrls || []).filter(u => u.trim()) }))
        : null;
      
      // Generate report
      const report = await generateReportFromMultipleCSVs(
        batchRows,
        airtableRows,
        sovRows,
        null,
        geoRows,
        contentGapRows,
        speakerAsClient,
        reportName || `${speakerAsClient.name} - ${quarter || 'Report'}`,
        quarter,
        { start: startDate, end: endDate },
        manualSOVCompetitors,
        cpmRate,
        rephonicRows,
        !!geoFile, // geoCsvProvided
        !!contentGapFile, // contentGapCsvProvided
        speakingTimePct / 100, // Convert percentage to decimal
        (selectedSpeaker?.quarterly_notes as Array<{ quarter: string; notes: string }>) || undefined
      );

      // Flag as needing scoring
      report.contains_live_scores = true;
      
      setReportData(report);
      if (!reportName) {
        setReportName(`${selectedCompany?.name} - ${quarter || 'Report'}`);
      }
      toast({
        title: "Report generated",
        description: `Successfully processed ${report.kpis.total_interviews} podcasts with ${report.kpis.total_booked} booked and ${report.kpis.total_published} published.`,
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error generating report",
        description: error instanceof Error ? error.message : "Failed to process CSVs",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Post-generation fit score calculation
  
  const handleGenerateFitScores = async () => {
    if (!reportData || !speakerAsClient) return;
    
    setIsScoringFit(true);
    setScoringProgress({ completed: 0, total: reportData.podcasts.length });
    
    try {
      // Build AirtableCSVRow-like objects from existing podcast entries
      const airtableRows: AirtableCSVRow[] = reportData.podcasts.map(p => ({
        podcast_name: p.show_title,
        action: 'podcast recording',
        scheduled_date_time: p.scheduled_date_time || '',
        show_notes: p.show_notes || '',
        date_booked: p.date_booked || '',
        date_published: p.date_published || '',
        link_to_episode: p.episode_link || '',
        apple_podcast_link: p.apple_podcast_link || '',
      }));
      
      const scoredRows = await scoreAirtablePodcasts(
        airtableRows,
        speakerAsClient,
        (completed, total) => setScoringProgress({ completed, total })
      );
      
      // Merge scores back into podcast entries
      const updatedPodcasts = reportData.podcasts.map(podcast => {
        const scored = scoredRows.find(s => 
          s.show_title?.toLowerCase() === podcast.show_title?.toLowerCase()
        );
        if (scored && scored.overall_score > 0) {
          return {
            ...podcast,
            overall_score: scored.overall_score,
            verdict: scored.verdict,
            rationale_short: scored.rationale_short || podcast.rationale_short,
          };
        }
        return podcast;
      });
      
      // Recalculate average score
      const scoredPodcasts = updatedPodcasts.filter(p => p.overall_score > 0);
      const avgScore = scoredPodcasts.length > 0
        ? scoredPodcasts.reduce((sum, p) => sum + p.overall_score, 0) / scoredPodcasts.length
        : 0;
      
      setReportData({
        ...reportData,
        podcasts: updatedPodcasts,
        contains_live_scores: true,
        kpis: {
          ...reportData.kpis,
          avg_score: avgScore,
        },
      });
      
      toast({
        title: "Fit scores generated",
        description: `Scored ${scoredRows.filter(r => r.overall_score > 0).length} of ${scoredRows.length} podcasts.`,
      });
    } catch (error) {
      console.error("Error generating fit scores:", error);
      toast({
        title: "Error generating fit scores",
        description: error instanceof Error ? error.message : "Failed to score podcasts",
        variant: "destructive",
      });
    } finally {
      setIsScoringFit(false);
      setScoringProgress(null);
    }
  };

  const handleSaveReport = async () => {
    if (!reportData || !reportName || !selectedCompanyId) {
      toast({
        title: "Missing information",
        description: "Report name and company are required to save.",
        variant: "destructive",
      });
      return;
    }

    // Mode-specific validation
    if (!isMultiSpeakerMode && !selectedSpeakerId) {
      toast({
        title: "Missing information",
        description: "Please select a speaker for single-speaker reports.",
        variant: "destructive",
      });
      return;
    }

    if (isMultiSpeakerMode && selectedSpeakerIds.length < 2) {
      toast({
        title: "Missing information",
        description: "Please select at least 2 speakers for multi-speaker reports.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      // 1. Insert report and get back the ID
      const slug = generateSlug();
      const { data: insertedReport, error } = await supabase.from('reports').insert({
        org_id: TEAM_ORG_ID,
        speaker_id: isMultiSpeakerMode ? null : selectedSpeakerId,
        company_id: selectedCompanyId,
        report_name: reportName,
        quarter: quarter || null,
        date_range_start: reportData.date_range?.start.split('T')[0] || new Date().toISOString().split('T')[0],
        date_range_end: reportData.date_range?.end.split('T')[0] || new Date().toISOString().split('T')[0],
        report_data: {
          ...reportData,
          selected_speaker_ids: isMultiSpeakerMode ? selectedSpeakerIds : undefined,
          visibleSections,
        } as any,
        is_published: true,
        public_slug: slug,
        published_at: new Date().toISOString(),
      }).select('id').single();
      
      if (error) throw error;

      // 2. Log to speaker history (quarterly_notes)
      const speakerIdsToLog = isMultiSpeakerMode ? selectedSpeakerIds : (selectedSpeakerId ? [selectedSpeakerId] : []);
      const historyEntry = {
        quarter: quarter || 'N/A',
        notes: `📊 Campaign report saved: ${reportName}`,
        created_at: new Date().toISOString(),
        report_id: insertedReport?.id || null,
        report_slug: slug,
      };

      for (const spkId of speakerIdsToLog) {
        const { data: spk } = await supabase
          .from('speakers')
          .select('quarterly_notes')
          .eq('id', spkId)
          .single();
        const existing = Array.isArray(spk?.quarterly_notes) ? spk.quarterly_notes : [];
        await supabase
          .from('speakers')
          .update({ quarterly_notes: [...existing, historyEntry] } as any)
          .eq('id', spkId);
      }
      
      toast({
        title: "Report saved & published",
        description: "Your report has been saved with a shareable link.",
      });
      await loadSavedReports();
      await loadAllReports();
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: "Error saving report",
        description: error instanceof Error ? error.message : "Failed to save report",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const generateSlug = () => {
    return Math.random().toString(36).substring(2, 10);
  };

  const handlePublishReport = async (reportId: string) => {
    const slug = generateSlug();
    
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          is_published: true,
          public_slug: slug,
          published_at: new Date().toISOString(),
        })
        .eq('id', reportId);
      
      if (error) throw error;
      
      toast({
        title: "Report published!",
        description: "Your report is now publicly accessible.",
      });
      await loadSavedReports();
      await loadAllReports();
    } catch (error) {
      console.error('Error publishing report:', error);
      toast({
        title: "Error publishing report",
        description: error instanceof Error ? error.message : "Failed to publish report",
        variant: "destructive",
      });
    }
  };

  const handleUnpublishReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          is_published: false,
          public_slug: null,
          published_at: null,
        })
        .eq('id', reportId);
      
      if (error) throw error;
      
      toast({
        title: "Report unpublished",
        description: "The report is no longer publicly accessible.",
      });
      await loadSavedReports();
      await loadAllReports();
    } catch (error) {
      console.error('Error unpublishing report:', error);
      toast({
        title: "Error unpublishing report",
        description: error instanceof Error ? error.message : "Failed to unpublish report",
        variant: "destructive",
      });
    }
  };

  const copyPublicUrl = (slug: string) => {
    const url = `${window.location.origin}/report/${slug}?v=${Date.now()}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied!",
      description: "Public report URL copied to clipboard.",
    });
  };

  const loadReport = (report: any) => {
    let loadedData = report.report_data as ReportData;
    
    // Auto-populate next_quarter_kpis if missing or incomplete (for older reports)
    if (loadedData.next_quarter_strategy) {
      const speakerBreakdowns = loadedData.speaker_breakdowns || [];
      const speakerCount = speakerBreakdowns.length || 1;
      const currentListenership = loadedData.kpis?.total_reach || 0;
      const currentAnnualListenership = (loadedData.kpis?.total_listeners_per_episode || 0) * 12;
      
      // Build speaker breakdown array
      const speakerBreakdownArray = speakerBreakdowns.length > 0
        ? speakerBreakdowns.map(s => ({ speaker_name: s.speaker_name, goal: 9 }))
        : [{ speaker_name: loadedData.client?.name || 'Speaker', goal: 9 }];
      
      const existingKpis = loadedData.next_quarter_strategy.next_quarter_kpis;
      
      // Only update if missing or if speaker_breakdown is missing or if current_annual_listenership is missing
      if (!existingKpis || !existingKpis.speaker_breakdown || existingKpis.current_annual_listenership === undefined) {
        loadedData = {
          ...loadedData,
          next_quarter_strategy: {
            ...loadedData.next_quarter_strategy,
            next_quarter_kpis: {
              high_impact_podcasts_goal: existingKpis?.high_impact_podcasts_goal || (3 * speakerCount * 3),
              listenership_goal: existingKpis?.listenership_goal || Math.ceil(currentListenership * 1.2),
              speaker_breakdown: existingKpis?.speaker_breakdown || speakerBreakdownArray,
              current_total_reach: existingKpis?.current_total_reach || currentListenership,
              current_annual_listenership: currentAnnualListenership,
            },
          },
        };
      }
    }
    
    setReportData(loadedData);
    setReportName(report.report_name);
    setQuarter(report.quarter || '');
    setCurrentReportId(report.id);
    
    // Restore saved visibility sections if they exist
    if (report.report_data?.visibleSections) {
      // Use saved visibility sections directly, only falling back to defaults for new keys not in saved data
      const savedSections = report.report_data.visibleSections;
      setVisibleSections({
        totalBooked: savedSections.totalBooked ?? true,
        totalPublished: savedSections.totalPublished ?? true,
        totalRecorded: savedSections.totalRecorded ?? true,
        totalIntroCalls: savedSections.totalIntroCalls ?? true,
        socialReach: savedSections.socialReach ?? true,
        totalReach: savedSections.totalReach ?? true,
        averageScore: savedSections.averageScore ?? true,
        emv: savedSections.emv ?? true,
        sov: savedSections.sov ?? true,
        geoScore: savedSections.geoScore ?? true,
        contentGap: savedSections.contentGap ?? true,
        socialValue: savedSections.socialValue ?? true,
        campaignOverview: savedSections.campaignOverview ?? true,
        airtableEmbed: savedSections.airtableEmbed ?? true,
        topCategories: savedSections.topCategories ?? true,
        nextQuarterStrategy: savedSections.nextQuarterStrategy ?? true,
        targetPodcasts: savedSections.targetPodcasts ?? true,
        contentGapRecommendations: savedSections.contentGapRecommendations ?? true,
        highlights: savedSections.highlights ?? true,
      });
    }
    
    toast({
      title: "Report loaded",
      description: `Loaded ${report.report_name}`,
    });
  };

  const deleteReport = async (reportId: string) => {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId);
    
    if (error) {
      toast({
        title: "Error deleting report",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Report deleted",
      description: "The report has been removed.",
    });
    await loadSavedReports();
    await loadAllReports();
  };

  const handlePrint = () => {
    window.print();
  };

  // Update saved report with new target podcasts
  const updateReportTargetPodcasts = async (podcasts: TargetPodcast[]) => {
    if (!reportData) return;

    // Optimistic local update
    const optimisticReportData = { ...reportData, target_podcasts: podcasts, visibleSections };
    setReportData(optimisticReportData);

    // Only persist if report is already saved
    if (!currentReportId) {
      toast({
        title: "Report updated",
        description: "Target podcasts updated. Save report to persist.",
      });
      return;
    }

    try {
      // Fetch fresh report_data to avoid overwriting fields (e.g. categories) with stale local state
      const { data: freshReport, error: fetchError } = await supabase
        .from('reports')
        .select('report_data')
        .eq('id', currentReportId)
        .single();

      if (fetchError) throw fetchError;

      const freshReportData = freshReport.report_data as unknown as ReportData;
      const updatedReportData = { ...freshReportData, target_podcasts: podcasts, visibleSections };

      // Keep local state aligned with persisted data
      setReportData(updatedReportData);

      const { error } = await supabase
        .from('reports')
        .update({ report_data: updatedReportData as any })
        .eq('id', currentReportId);

      if (error) throw error;

      toast({
        title: "Report updated",
        description: "Target podcasts saved to report.",
      });
    } catch (error) {
      console.error('Error updating report:', error);
      toast({
        title: "Failed to save",
        description: "Target podcasts generated but couldn't save to report.",
        variant: "destructive",
      });
    }
  };

  const handleContentGapRecommendationsUpdate = async (
    recommendations: ReportData['content_gap_analysis']['ai_recommendations']
  ) => {
    if (!reportData || !reportData.content_gap_analysis) return;

    // Optimistic local update
    const optimisticReportData = {
      ...reportData,
      content_gap_analysis: {
        ...reportData.content_gap_analysis,
        ai_recommendations: recommendations,
      },
      visibleSections,
    } as any;

    setReportData(optimisticReportData);

    if (!currentReportId) return;

    try {
      // Fetch fresh report_data to avoid overwriting fields with stale local state
      const { data: freshReport, error: fetchError } = await supabase
        .from('reports')
        .select('report_data')
        .eq('id', currentReportId)
        .single();

      if (fetchError) throw fetchError;

      const freshReportData = freshReport.report_data as unknown as ReportData;
      const updatedReportData = {
        ...freshReportData,
        content_gap_analysis: {
          ...(freshReportData.content_gap_analysis || reportData.content_gap_analysis),
          ai_recommendations: recommendations,
        } as any,
        visibleSections,
      } as any;

      setReportData(updatedReportData);

      const { error } = await supabase
        .from('reports')
        .update({ report_data: updatedReportData as any })
        .eq('id', currentReportId);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving content gap recommendations:', error);
    }
  };

  // Update saved report with highlight clips
  const updateReportHighlights = async (clips: HighlightClip[]) => {
    if (!reportData) return;

    // Optimistic local update
    const optimisticReportData = { ...reportData, highlight_clips: clips, visibleSections };
    setReportData(optimisticReportData);

    // Only persist if report is already saved
    if (!currentReportId) {
      toast({
        title: "Highlights updated",
        description: "Highlights updated. Save report to persist.",
      });
      return;
    }

    try {
      // Fetch fresh report_data to avoid overwriting fields (e.g. categories) with stale local state
      const { data: freshReport, error: fetchError } = await supabase
        .from('reports')
        .select('report_data')
        .eq('id', currentReportId)
        .single();

      if (fetchError) throw fetchError;

      const freshReportData = freshReport.report_data as unknown as ReportData;
      const updatedReportData = { ...freshReportData, highlight_clips: clips, visibleSections };

      // Keep local state aligned with persisted data
      setReportData(updatedReportData);

      const { error } = await supabase
        .from('reports')
        .update({ report_data: updatedReportData as any })
        .eq('id', currentReportId);

      if (error) throw error;

      toast({
        title: "Highlights saved",
        description: "Interview highlights updated successfully.",
      });
    } catch (error) {
      console.error('Error updating highlights:', error);
      toast({
        title: "Failed to save highlights",
        description: "Highlights were added but couldn't save to report.",
        variant: "destructive",
      });
    }
  };

  // Update report with campaign overview edits (works for both saved and unsaved reports)
  const updateReportCampaignOverview = async (campaignOverview: ReportData["campaign_overview"]) => {
    if (!reportData) return;

    const nextCampaignOverview: ReportData["campaign_overview"] = {
      ...campaignOverview,
      target_audiences: [...(campaignOverview.target_audiences || [])],
      talking_points: [...(campaignOverview.talking_points || [])],
      pitch_hooks: campaignOverview.pitch_hooks
        ? campaignOverview.pitch_hooks.map((s) => ({
            ...s,
            hooks: [...(s.hooks || [])],
          }))
        : undefined,
    };

    // Optimistic local update
    const optimisticReportData = {
      ...reportData,
      campaign_overview: nextCampaignOverview,
      visibleSections,
    } as any;
    setReportData(optimisticReportData);

    if (!currentReportId) {
      toast({
        title: "Campaign overview updated",
        description: "Changes applied. Save report to persist.",
      });
      return;
    }

    try {
      // Fetch fresh report_data to avoid overwriting fields with stale local state
      const { data: freshReport, error: fetchError } = await supabase
        .from('reports')
        .select('report_data')
        .eq('id', currentReportId)
        .single();

      if (fetchError) throw fetchError;

      const freshReportData = freshReport.report_data as unknown as ReportData;
      const updatedReportData = {
        ...freshReportData,
        campaign_overview: nextCampaignOverview,
        visibleSections,
      } as any;

      setReportData(updatedReportData);

      const { error } = await supabase
        .from('reports')
        .update({ report_data: updatedReportData as any })
        .eq('id', currentReportId);

      if (error) throw error;

      toast({
        title: "Campaign overview saved",
        description: "Campaign overview updated successfully.",
      });
    } catch (error) {
      console.error('Error updating campaign overview:', error);
      toast({
        title: "Failed to save",
        description: "Changes couldn't be saved to the report.",
        variant: "destructive",
      });
    }
  };

  // Update report with next quarter strategy edits (works for both saved and unsaved reports)
  const updateReportNextQuarterStrategy = async (strategy: NonNullable<ReportData["next_quarter_strategy"]>) => {
    if (!reportData) return;

    // Always update local state immediately
    const optimisticReportData = { ...reportData, next_quarter_strategy: strategy, visibleSections };
    setReportData(optimisticReportData);

    // Only save to database if report is already saved
    if (currentReportId) {
      try {
        // Fetch fresh report_data to avoid overwriting other fields with stale local state
        const { data: freshReport, error: fetchError } = await supabase
          .from('reports')
          .select('report_data')
          .eq('id', currentReportId)
          .single();

        if (fetchError) throw fetchError;

        const freshReportData = freshReport.report_data as unknown as ReportData;
        const updatedReportData = {
          ...freshReportData,
          next_quarter_strategy: strategy,
          visibleSections,
        };

        // Keep local state aligned with what we persist
        setReportData(updatedReportData);

        const { error } = await supabase
          .from('reports')
          .update({ report_data: updatedReportData as any })
          .eq('id', currentReportId);

        if (error) throw error;

        toast({
          title: "Looking ahead saved",
          description: "Next quarter strategy updated successfully.",
        });
      } catch (error) {
        console.error('Error updating next quarter strategy:', error);
        toast({
          title: "Failed to save",
          description: "Changes couldn't be saved to the report.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Looking ahead updated",
        description: "Changes applied. Save report to persist.",
      });
    }
  };

  // Regenerate talking points spotlight using AI
  const handleRegenerateTalkingPoints = async () => {
    if (!reportData || !reportData.next_quarter_strategy) return;
    
    setIsRegeneratingTalkingPoints(true);
    
    try {
      const isMultiSpeaker = reportData.report_type === 'multi' && reportData.speaker_breakdowns && reportData.speaker_breakdowns.length > 1;
      const quarter = reportData.next_quarter_strategy.quarter || reportData.quarter || '';
      
      // Build speaker data for AI
      let speakersForAI: Array<{
        name: string;
        title?: string | null;
        company?: string;
        talking_points?: string[] | null;
        target_audiences?: string[] | null;
        campaign_strategy?: string | null;
        professional_credentials?: string[] | null;
        guest_identity_tags?: string[] | null;
      }> = [];
      
      if (isMultiSpeaker && reportData.speaker_breakdowns) {
        // Multi-speaker: use each speaker's data
        speakersForAI = reportData.speaker_breakdowns.map(sb => ({
          name: sb.speaker_name,
          title: sb.speaker_title,
          company: reportData.company_name || reportData.client?.company,
          talking_points: sb.talking_points,
          target_audiences: sb.target_audiences,
          campaign_strategy: sb.campaign_strategy,
          professional_credentials: sb.professional_credentials,
        }));
      } else {
        // Single speaker: use client data
        const client = reportData.client;
        speakersForAI = [{
          name: client?.name || '',
          title: client?.title,
          company: client?.company,
          talking_points: client?.talking_points,
          target_audiences: client?.target_audiences,
          campaign_strategy: client?.campaign_strategy,
          professional_credentials: client?.professional_credentials,
          guest_identity_tags: client?.guest_identity_tags,
        }];
      }
      
      // Calculate next quarter for talking points target
      const nextQuarter = (() => {
        const match = quarter.match(/Q(\d)\s*(\d{4})/);
        if (!match) return quarter;
        const q = parseInt(match[1]);
        const y = parseInt(match[2]);
        return q === 4 ? `Q1 ${y + 1}` : `Q${q + 1} ${y}`;
      })();
      
      // Call AI to generate talking points
      const aiResult = await generateAITalkingPoints(
        speakersForAI,
        nextQuarter, // The quarter these talking points are FOR
        {
          total_booked: reportData.kpis?.total_booked,
          total_published: reportData.kpis?.total_published,
          total_reach: reportData.kpis?.total_reach,
          top_categories: reportData.kpis?.top_categories,
        },
        isMultiSpeaker,
        quarter // The quarter the report covers
      );
      
      // Update the next quarter strategy with AI-generated talking points
      let updatedStrategy = { ...reportData.next_quarter_strategy };
      
      if (isMultiSpeaker && aiResult.speaker_talking_points_spotlight) {
        updatedStrategy.speaker_talking_points_spotlight = aiResult.speaker_talking_points_spotlight;
        updatedStrategy.talking_points_spotlight = []; // Clear general points for multi-speaker
      } else if (aiResult.talking_points_spotlight) {
        updatedStrategy.talking_points_spotlight = aiResult.talking_points_spotlight;
      }
      
      // Save using the existing handler
      await updateReportNextQuarterStrategy(updatedStrategy);
      
      const pointCount = isMultiSpeaker 
        ? aiResult.speaker_talking_points_spotlight?.reduce((sum, s) => sum + s.points.length, 0) || 0
        : aiResult.talking_points_spotlight?.length || 0;
      
      toast({
        title: "Talking points regenerated",
        description: `Generated ${pointCount} AI-powered talking point${pointCount !== 1 ? 's' : ''} to spotlight.`,
      });
    } catch (error) {
      console.error('Error regenerating talking points:', error);
      toast({
        title: "Error",
        description: "Failed to regenerate talking points. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRegeneratingTalkingPoints(false);
    }
  };

  // Regenerate podcast categories using AI
  const handleRegenerateCategories = async () => {
    if (!reportData || !reportData.podcasts || reportData.podcasts.length === 0) {
      toast({
        title: "No podcasts",
        description: "No podcast data available to regenerate categories.",
        variant: "destructive",
      });
      return;
    }
    
    setIsRegeneratingCategories(true);
    
    try {
      // Get target audiences from client or speaker data
      let targetAudiences: string[] = [];
      let companyName: string | undefined;
      
      if (reportData.report_type === 'multi' && reportData.speaker_breakdowns) {
        // Multi-speaker: collect all target audiences
        reportData.speaker_breakdowns.forEach(sb => {
          if (sb.target_audiences) {
            targetAudiences.push(...sb.target_audiences);
          }
        });
        companyName = reportData.company_name || reportData.client?.company;
      } else {
        // Single speaker
        targetAudiences = reportData.client?.target_audiences || [];
        companyName = reportData.client?.company;
      }
      
      // Filter to unique podcasts
      const uniquePodcasts = new Map<string, {
        name: string;
        apple_link?: string;
      }>();
      
      reportData.podcasts.forEach(p => {
        const key = (p.apple_podcast_link || p.show_title || '').toLowerCase();
        if (!uniquePodcasts.has(key)) {
          uniquePodcasts.set(key, {
            name: p.show_title,
            apple_link: p.apple_podcast_link, // May be undefined - that's ok
          });
        }
      });
      
      const podcastsList = Array.from(uniquePodcasts.values());
      console.log(`Regenerating categories for ${podcastsList.length} podcasts - scraping cover art first`);
      
      // Scrape cover art for each podcast in batches
      const podcastsWithMetadata: Array<{
        name: string;
        description?: string;
        apple_link?: string;
        cover_art_url?: string;
      }> = [];
      
      const batchSize = 5;
      for (let i = 0; i < podcastsList.length; i += batchSize) {
        const batch = podcastsList.slice(i, i + batchSize);
        
        const results = await Promise.all(
          batch.map(async (podcast) => {
            // Skip scraping if no Apple link
            if (!podcast.apple_link) {
              return {
                name: podcast.name,
                apple_link: undefined,
                cover_art_url: undefined,
              };
            }
            
            try {
              const { data, error } = await supabase.functions.invoke('scrape-podcast-cover-art', {
                body: { apple_podcast_url: podcast.apple_link }
              });
              
              if (error || !data) {
                return {
                  name: podcast.name,
                  apple_link: podcast.apple_link,
                  cover_art_url: undefined,
                };
              }
              
              return {
                name: data.podcastName || podcast.name,
                description: data.description,
                apple_link: podcast.apple_link,
                cover_art_url: data.coverArtUrl,
              };
            } catch {
              return {
                name: podcast.name,
                apple_link: podcast.apple_link,
                cover_art_url: undefined,
              };
            }
          })
        );
        
        podcastsWithMetadata.push(...results);
        
        // Small delay between batches
        if (i + batchSize < podcastsList.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`Scraped metadata for ${podcastsWithMetadata.length} podcasts, now categorizing...`);
      
      const newCategories = await generatePodcastCategories(
        podcastsWithMetadata,
        targetAudiences,
        companyName
      );
      
      if (newCategories.length === 0) {
        toast({
          title: "No categories generated",
          description: "The AI could not categorize the podcasts. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Update report data with new categories
      const updatedKpis = {
        ...reportData.kpis,
        top_categories: newCategories,
      };
      
      const updatedReportData = {
        ...reportData,
        kpis: updatedKpis,
      };
      
      setReportData(updatedReportData);
      
      // If saved report, persist to database
      if (currentReportId) {
        try {
          const { data: freshReport, error: fetchError } = await supabase
            .from('reports')
            .select('report_data')
            .eq('id', currentReportId)
            .single();
          
          if (fetchError) throw fetchError;
          
          const freshReportData = freshReport.report_data as unknown as ReportData;
          const mergedReportData = {
            ...freshReportData,
            kpis: {
              ...freshReportData.kpis,
              top_categories: newCategories,
            },
          };
          
          const { error } = await supabase
            .from('reports')
            .update({ report_data: mergedReportData as any })
            .eq('id', currentReportId);
          
          if (error) throw error;
        } catch (dbError) {
          console.error('Error persisting categories:', dbError);
        }
      }
      
      toast({
        title: "Categories regenerated",
        description: `Generated ${newCategories.length} audience-focused categories.`,
      });
    } catch (error) {
      console.error('Error regenerating categories:', error);
      toast({
        title: "Error",
        description: "Failed to regenerate categories. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRegeneratingCategories(false);
    }
  };

  return (
    <div className="min-h-screen w-full">
      <BackgroundFX />
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* All Saved Reports Section */}
          {allReports.length > 0 && (
            <Collapsible open={allReportsExpanded} onOpenChange={setAllReportsExpanded}>
              <Card className="print:hidden border-border/60 shadow-none">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        {allReportsExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle className="text-[15px] font-semibold tracking-tight">All Saved Reports</CardTitle>
                          <CardDescription className="text-sm">
                            {allReports.length} reports across all companies
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardHeader className="pt-0 pb-4">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search reports..."
                        value={allReportsSearchQuery}
                        onChange={(e) => setAllReportsSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Speaker</TableHead>
                          <TableHead>Report Name</TableHead>
                          <TableHead>Quarter</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Generated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allReports
                          .filter(report => {
                            const query = allReportsSearchQuery.toLowerCase();
                            if (!query) return true;
                            return (
                              report.report_name?.toLowerCase().includes(query) ||
                              report.companies?.name?.toLowerCase().includes(query) ||
                              report.speakers?.name?.toLowerCase().includes(query) ||
                              report.quarter?.toLowerCase().includes(query)
                            );
                          })
                          .slice(0, 20)
                          .map(report => (
                            <TableRow key={report.id} className="group">
                              <TableCell className="font-medium">
                                {report.companies?.name || '-'}
                              </TableCell>
                              <TableCell>
                                {report.speaker_id === null ? (
                                  <Badge variant="secondary">Multi-Speaker</Badge>
                                ) : (
                                  report.speakers?.name || '-'
                                )}
                              </TableCell>
                              <TableCell>{report.report_name}</TableCell>
                              <TableCell>{report.quarter || '-'}</TableCell>
                              <TableCell>
                                {report.is_published ? (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/30">
                                      <Globe className="h-3 w-3 mr-1" />
                                      Published
                                    </Badge>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => copyPublicUrl(report.public_slug)}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                    <a
                                      href={`/report/${report.public_slug}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Button size="icon" variant="ghost" className="h-6 w-6">
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    </a>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground">Draft</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(report.generated_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs"
                                    onClick={() => {
                                      if (report.company_id) {
                                        setSelectedCompanyId(report.company_id);
                                      }
                                      if (report.speaker_id) {
                                        setIsMultiSpeakerMode(false);
                                        setSelectedSpeakerId(report.speaker_id);
                                      } else {
                                        setIsMultiSpeakerMode(true);
                                        setSelectedSpeakerId(null);
                                      }
                                      loadReport(report);
                                    }}
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs"
                                    onClick={() => {
                                      if (report.company_id) {
                                        setSelectedCompanyId(report.company_id);
                                      }
                                      if (report.speaker_id) {
                                        setIsMultiSpeakerMode(false);
                                        setSelectedSpeakerId(report.speaker_id);
                                      } else {
                                        setIsMultiSpeakerMode(true);
                                        setSelectedSpeakerId(null);
                                      }
                                      loadReport(report);
                                      setHighlightsDialogOpen(true);
                                    }}
                                  >
                                    <Video className="h-3.5 w-3.5 mr-1" />
                                    Highlights
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs"
                                    onClick={() => {
                                      setReportToUpdate(report);
                                      setUpdateCSVDialogOpen(true);
                                    }}
                                    title="Update CSV data"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                    Update
                                  </Button>
                                  {report.is_published ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-xs"
                                      onClick={() => handleUnpublishReport(report.id)}
                                    >
                                      Unpublish
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-xs"
                                      onClick={() => handlePublishReport(report.id)}
                                    >
                                      <Globe className="h-3.5 w-3.5 mr-1" />
                                      Publish
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      deleteReport(report.id);
                                      loadAllReports();
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    {allReports.length > 20 && !allReportsSearchQuery && (
                      <p className="text-sm text-muted-foreground mt-4 text-center">
                        Showing 20 most recent reports. Use search to find older reports.
                      </p>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}


          {/* Generate Report Section */}
          <Card className="print:hidden border-border/60 shadow-none">
            <CardHeader>
              <CardTitle className="text-[15px] font-semibold tracking-tight">Generate Client Report</CardTitle>
              <CardDescription>
                Select a company, speaker, and period to generate a campaign report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* ── Section 1: Company Selection ── */}
              <div className="space-y-3">
                <Label className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Company</Label>
                
                {selectedCompanyId && selectedCompany ? (
                  /* Collapsed: show selected company as a compact chip */
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-primary bg-primary/5 flex-1">
                      <div className="w-6 h-6 rounded-md bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden border border-border/50">
                        {selectedCompany.logo_url ? (
                          <img src={selectedCompany.logo_url} alt="" className="w-full h-full object-contain p-0.5" />
                        ) : (
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{selectedCompany.name}</span>
                      <Check className="h-4 w-4 text-primary ml-auto shrink-0" />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSelectedCompanyId(null);
                        setSelectedSpeakerId(null);
                        setSelectedSpeakerIds([]);
                        setSpeakerFiles({});
                        setSpeakerSyncedData({});
                        setIsMultiSpeakerMode(false);
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  /* Expanded: full company picker */
                  <>
                    {/* Campaign Manager Filter */}
                    {campaignManagers.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedCampaignManager('')}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            !selectedCampaignManager
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          All
                        </button>
                        {campaignManagers.map(manager => (
                          <button
                            key={manager}
                            type="button"
                            onClick={() => setSelectedCampaignManager(manager === selectedCampaignManager ? '' : manager)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              selectedCampaignManager === manager
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            {manager}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search companies..."
                        value={companySearchQuery}
                        onChange={(e) => setCompanySearchQuery(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[240px] overflow-y-auto">
                      {filteredCompanies.map((company) => {
                        const speakerCount = speakers.filter(s => s.company_id === company.id).length;
                        return (
                          <button
                            key={company.id}
                            type="button"
                            onClick={() => {
                              setSelectedCompanyId(company.id);
                              setSelectedSpeakerId(null);
                              setSelectedSpeakerIds([]);
                              setSpeakerFiles({});
                              setSpeakerSyncedData({});
                              setIsMultiSpeakerMode(false);
                            }}
                            className="flex items-center gap-2.5 p-3 rounded-lg border border-border/60 hover:border-border hover:shadow-sm bg-card text-left transition-all"
                          >
                            <div className="w-8 h-8 rounded-md bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden border border-border/50">
                              {company.logo_url ? (
                                <img src={company.logo_url} alt="" className="w-full h-full object-contain p-0.5" />
                              ) : (
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{company.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {speakerCount} speaker{speakerCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                      {filteredCompanies.length === 0 && (
                        <p className="col-span-full text-sm text-muted-foreground text-center py-6">No companies found.</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* ── Section 2: Speaker Selection ── */}
              {selectedCompanyId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      {isMultiSpeakerMode ? 'Speakers (select 2+)' : 'Speaker'}
                    </Label>
                    {companySpeakers.length >= 2 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Multi-speaker</span>
                        <Switch
                          checked={isMultiSpeakerMode}
                          onCheckedChange={(checked) => {
                            setIsMultiSpeakerMode(checked);
                            if (checked) {
                              setSelectedSpeakerId(null);
                              setSelectedSpeakerIds([]);
                              setSpeakerFiles({});
                              setSpeakerSyncedData({});
                              setBatchFile(null);
                              setAirtableFile(null);
                            } else {
                              setSelectedSpeakerIds([]);
                              setSpeakerFiles({});
                              setSpeakerSyncedData({});
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    {companySpeakers.map((speaker) => {
                      const isSelected = isMultiSpeakerMode
                        ? selectedSpeakerIds.includes(speaker.id)
                        : selectedSpeakerId === speaker.id;
                      return (
                        <button
                          key={speaker.id}
                          type="button"
                          onClick={() => {
                            if (isMultiSpeakerMode) {
                              if (selectedSpeakerIds.includes(speaker.id)) {
                                setSelectedSpeakerIds(prev => prev.filter(id => id !== speaker.id));
                                setSpeakerFiles(prev => { const u = { ...prev }; delete u[speaker.id]; return u; });
                                setSpeakerSyncedData(prev => { const u = { ...prev }; delete u[speaker.id]; return u; });
                              } else {
                                setSelectedSpeakerIds(prev => [...prev, speaker.id]);
                                setSpeakerFileExpanded(prev => ({ ...prev, [speaker.id]: true }));
                              }
                            } else {
                              setSelectedSpeakerId(speaker.id);
                            }
                          }}
                          className={`flex items-center gap-3 w-full p-2.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-transparent hover:bg-muted/50'
                          }`}
                        >
                          {isMultiSpeakerMode && (
                            <Checkbox checked={isSelected} className="pointer-events-none" />
                          )}
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={speaker.headshot_url || undefined} alt={speaker.name} />
                            <AvatarFallback className="text-[10px] bg-muted">
                              {speaker.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium">{speaker.name}</span>
                            {speaker.title && (
                              <span className="text-xs text-muted-foreground ml-2">— {speaker.title}</span>
                            )}
                          </div>
                          {!isMultiSpeakerMode && isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                    {isMultiSpeakerMode && selectedSpeakerIds.length > 0 && selectedSpeakerIds.length < 2 && (
                      <p className="text-xs text-destructive pt-1">Select at least 2 speakers for a multi-speaker report</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Section 3: Report Period ── */}
              {(selectedSpeakerId || (isMultiSpeakerMode && selectedSpeakerIds.length >= 2)) && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Report Period</Label>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Year</Label>
                      <ToggleGroup
                        type="single"
                        value={selectedYear.toString()}
                        onValueChange={(val) => { if (val) handleYearChange(val); }}
                        className="justify-start"
                      >
                        {[selectedYear - 1, selectedYear, selectedYear + 1].map(year => (
                          <ToggleGroupItem key={year} value={year.toString()} className="px-4 h-8 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                            {year}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Quarter</Label>
                      <ToggleGroup
                        type="single"
                        value={selectedQuarter}
                        onValueChange={(val) => { if (val) handleQuarterChange(val); }}
                        className="justify-start"
                      >
                        {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                          <ToggleGroupItem key={q} value={q} className="px-4 h-8 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                            {q}
                          </ToggleGroupItem>
                        ))}
                        <ToggleGroupItem value="custom" className="px-4 h-8 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                          Custom
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    {selectedQuarter === 'custom' && (
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <Label className="text-xs">Start Date</Label>
                          <Input type="date" value={dateRangeStart} onChange={(e) => setDateRangeStart(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">End Date</Label>
                          <Input type="date" value={dateRangeEnd} onChange={(e) => setDateRangeEnd(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Section 4: Data Sources (collapsible) ── */}
              {(selectedSpeakerId || (isMultiSpeakerMode && selectedSpeakerIds.length >= 2)) && dateRangeStart && dateRangeEnd && (
                <Collapsible open={dataSourcesOpen} onOpenChange={setDataSourcesOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
                    <Label className="text-sm font-medium uppercase tracking-wide text-muted-foreground cursor-pointer">Data Sources</Label>
                    <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${dataSourcesOpen ? 'rotate-90' : ''}`} />
                    {/* Status indicators */}
                    {!dataSourcesOpen && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        {(airtableSyncedData || airtableFile || Object.values(speakerSyncedData).some(Boolean)) && (
                          <span className="w-2 h-2 rounded-full bg-green-500" title="Airtable data ready" />
                        )}
                        {(batchFile || geoFile || contentGapFile) && (
                          <span className="w-2 h-2 rounded-full bg-green-500" title="CSV data uploaded" />
                        )}
                      </div>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    {/* Multi-speaker per-speaker CSV uploads */}
                    {isMultiSpeakerMode && selectedSpeakerIds.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-xs font-medium text-muted-foreground">Per-Speaker Data</Label>
                        {selectedSpeakerIds.map(speakerId => {
                          const speaker = speakers.find(s => s.id === speakerId);
                          const files = speakerFiles[speakerId] || { batchFile: null, airtableFile: null };
                          const syncedData = speakerSyncedData[speakerId];
                          const isExpanded = speakerFileExpanded[speakerId] ?? true;
                          const hasAirtableData = !!syncedData || !!files.airtableFile;
                          const isReady = files.batchFile && hasAirtableData;
                          
                          return (
                            <Collapsible key={speakerId} open={isExpanded} onOpenChange={(open) => setSpeakerFileExpanded(prev => ({ ...prev, [speakerId]: open }))}>
                              <div className="border border-border/60 rounded-lg">
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 rounded-t-lg">
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                    <span className="text-sm font-medium">{speaker?.name}</span>
                                    {isReady ? (
                                      <span className="w-2 h-2 rounded-full bg-green-500" />
                                    ) : (
                                      <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                                    )}
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="px-3 pb-3 space-y-3">
                                  <div>
                                    <Label className="text-xs">Rephonic CSV</Label>
                                    <Input
                                      type="file"
                                      accept=".csv"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setSpeakerFiles(prev => ({
                                          ...prev,
                                          [speakerId]: { ...prev[speakerId], batchFile: file }
                                        }));
                                      }}
                                    />
                                    {files.batchFile && <p className="text-xs text-muted-foreground mt-1">{files.batchFile.name}</p>}
                                    <p className="text-xs text-muted-foreground mt-1">Auto-fetch coming soon. Please upload List CSV from Rephonic.</p>
                                  </div>
                                  
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Label className="text-xs">Airtable Data *</Label>
                                      <Badge variant="secondary" className="text-[10px] bg-secondary text-muted-foreground">
                                        {syncedData ? `Synced (${syncedData.length})` : files.airtableFile ? "CSV" : "Required"}
                                      </Badge>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mb-2">
                                      <AirtableSyncButton
                                        companyId={selectedCompanyId || undefined}
                                        speakerId={speakerId}
                                        entityName={speaker?.name || 'Speaker'}
                                        dateRangeStart={dateRangeStart}
                                        dateRangeEnd={dateRangeEnd}
                                        onDataSynced={(data) => {
                                          setSpeakerSyncedData(prev => ({ ...prev, [speakerId]: data }));
                                          setSpeakerFiles(prev => ({ ...prev, [speakerId]: { ...prev[speakerId], airtableFile: null } }));
                                        }}
                                        variant="inline"
                                        size="sm"
                                      />
                                      {syncedData && (
                                        <Button variant="ghost" size="sm" onClick={() => setSpeakerSyncedData(prev => ({ ...prev, [speakerId]: null }))} title="Clear synced data">
                                          <X className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                    {syncedData && <AirtableDataPreview data={syncedData} />}
                                    
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Single-speaker CSV uploads */}
                    {!isMultiSpeakerMode && (
                      <>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Label className="text-xs">Rephonic CSV</Label>
                            <Badge variant="secondary" className="text-[10px] bg-secondary text-muted-foreground">
                              {batchFile ? "Uploaded" : "Optional"}
                            </Badge>
                          </div>
                          <Input type="file" accept=".csv" onChange={(e) => setBatchFile(e.target.files?.[0] || null)} />
                          {batchFile && <p className="text-xs text-muted-foreground mt-1">{batchFile.name}</p>}
                          <p className="text-xs text-muted-foreground mt-1">Auto-fetch coming soon. Please upload List CSV from Rephonic.</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Label className="text-xs">Airtable Data *</Label>
                            <Badge variant="secondary" className="text-[10px] bg-secondary text-muted-foreground">
                              {airtableSyncedData ? `Synced (${airtableSyncedData.length})` : airtableFile ? "CSV Uploaded" : "Required"}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <AirtableSyncButton
                              key={`sync-${connectionVersion}`}
                              companyId={selectedCompanyId || undefined}
                              speakerId={selectedSpeakerId || undefined}
                              entityName={speakerAsClient?.name || 'Speaker'}
                              dateRangeStart={dateRangeStart}
                              dateRangeEnd={dateRangeEnd}
                              onDataSynced={(data) => { setAirtableSyncedData(data); setAirtableFile(null); }}
                              variant="inline"
                              size="sm"
                            />
                            <Button variant="ghost" size="sm" onClick={() => setAirtableConnectionDialogOpen(true)} title="Configure Airtable connection">
                              <Link2 className="h-4 w-4" />
                            </Button>
                            {airtableSyncedData && (
                              <Button variant="ghost" size="sm" onClick={() => setAirtableSyncedData(null)} title="Clear synced data">
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {airtableSyncedData && <AirtableDataPreview data={airtableSyncedData} />}
                          
                        </div>
                      </>
                    )}

                    {/* Company-level CSVs (shared) */}
                    <div className="pt-3 border-t border-border/40">
                      <Label className="text-xs font-medium text-muted-foreground mb-3 block">{isMultiSpeakerMode ? 'Company-Level Data (Shared)' : 'Optional Data'}</Label>
                      
                      {/* SOV/Peer Comparison */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs font-medium">Peer Comparison</Label>
                            <Badge variant="secondary" className="text-[10px] bg-secondary text-muted-foreground">
                              {manualSOVMode && competitorInterviews.some(c => c.count > 0) ? "Manual Entry" : "Optional"}
                            </Badge>
                          </div>
                          {manualSOVMode && competitorInterviews.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={autoFetchPeerComparison}
                              disabled={isFetchingSOV || !dateRangeStart || !dateRangeEnd}
                            >
                              {isFetchingSOV ? (
                                <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Fetching...</>
                              ) : (
                                <><RefreshCw className="h-3 w-3 mr-1" />Auto-Fetch</>
                              )}
                            </Button>
                          )}
                        </div>
                        
                        {manualSOVMode && competitorInterviews.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              Use "Auto-Fetch" to populate counts, or enter manually.
                            </p>
                            {sovFetchError && (
                              <p className="text-xs text-destructive flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />{sovFetchError}
                              </p>
                            )}
                            {competitorInterviews.map((comp, index) => (
                              <div key={index} className="space-y-1.5">
                                <div className="flex items-center gap-3 p-2.5 bg-secondary/30 rounded-lg border border-border/40">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-xs truncate">{comp.name}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{comp.role}</p>
                                  </div>
                                  <Input type="number" min="0" className="w-16 h-7 text-xs" placeholder="0" value={comp.count || ''} onChange={(e) => updateCompetitorCount(index, parseInt(e.target.value) || 0)} />
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyListenNotesURL(comp.name)} title="Copy ListenNotes URL">
                                    <Clipboard className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setExpandedCompetitorEpisodes(prev => ({ ...prev, [index]: !prev[index] }))}
                                    title={expandedCompetitorEpisodes[index] ? "Hide episode URLs" : "Add episode URLs"}
                                  >
                                    {expandedCompetitorEpisodes[index] ? <ChevronDown className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                                  </Button>
                                </div>
                                {expandedCompetitorEpisodes[index] && (
                                  <div className="ml-4 space-y-1.5">
                                    {/* Show fetched episode metadata */}
                                    {(comp.episodes || []).length > 0 && (
                                      <div className="space-y-1">
                                        {comp.episodes!.map((ep, epIdx) => (
                                          <div key={epIdx} className="bg-muted/30 rounded-md p-2 space-y-0.5">
                                            <p className="text-xs font-medium text-foreground leading-tight">{ep.podcast_name || 'Unknown Podcast'}</p>
                                            <p className="text-[11px] text-muted-foreground leading-tight">{ep.title || 'Untitled Episode'}</p>
                                            {ep.air_date && (
                                              <p className="text-[10px] text-muted-foreground/70">{ep.air_date}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {/* URL inputs */}
                                    {(comp.episodeUrls || []).map((url, urlIdx) => (
                                      <div key={urlIdx} className="flex items-center gap-1.5">
                                        <Input
                                          className="h-7 text-xs flex-1"
                                          placeholder="Paste episode URL..."
                                          value={url}
                                          onChange={(e) => {
                                            setCompetitorInterviews(prev => prev.map((c, i) => {
                                              if (i !== index) return c;
                                              const urls = [...(c.episodeUrls || [])];
                                              urls[urlIdx] = e.target.value;
                                              return { ...c, episodeUrls: urls };
                                            }));
                                          }}
                                        />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                          onClick={() => {
                                            setCompetitorInterviews(prev => prev.map((c, i) => {
                                              if (i !== index) return c;
                                              const urls = (c.episodeUrls || []).filter((_, j) => j !== urlIdx);
                                              return { ...c, episodeUrls: urls };
                                            }));
                                          }}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-[10px] gap-1"
                                        onClick={() => {
                                          setCompetitorInterviews(prev => prev.map((c, i) => {
                                            if (i !== index) return c;
                                            return { ...c, episodeUrls: [...(c.episodeUrls || []), ''] };
                                          }));
                                        }}
                                      >
                                        <Plus className="h-3 w-3" />
                                        Add URL
                                      </Button>
                                      {(comp.episodeUrls || []).some(u => u.trim()) && (
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          className="h-6 text-[10px] gap-1"
                                          disabled={fetchingEpisodeMetadata[index]}
                                          onClick={async () => {
                                            const urls = (comp.episodeUrls || []).filter(u => u.trim());
                                            if (urls.length === 0) return;
                                            setFetchingEpisodeMetadata(prev => ({ ...prev, [index]: true }));
                                            try {
                                              const { data, error } = await supabase.functions.invoke('scrape-episode-metadata', {
                                                body: { urls },
                                              });
                                              if (error) throw error;
                                              if (data?.success && data.episodes) {
                                                setCompetitorInterviews(prev => prev.map((c, i) => {
                                                  if (i !== index) return c;
                                                  const episodes = data.episodes.map((ep: any) => ({
                                                    title: ep.episode_title || '',
                                                    podcast_name: ep.podcast_name || '',
                                                    air_date: ep.air_date || '',
                                                    role: c.role || '',
                                                  }));
                                                  return { ...c, episodes, episodeUrls: [] };
                                                }));
                                                toast({ title: 'Episode info fetched', description: `Found metadata for ${data.episodes.length} episodes.` });
                                              }
                                            } catch (err) {
                                              console.error('Error fetching episode metadata:', err);
                                              toast({ title: 'Fetch failed', description: 'Could not scrape episode metadata.', variant: 'destructive' });
                                            } finally {
                                              setFetchingEpisodeMetadata(prev => ({ ...prev, [index]: false }));
                                            }
                                          }}
                                        >
                                          {fetchingEpisodeMetadata[index] ? (
                                            <><Loader2 className="h-3 w-3 animate-spin" />Fetching...</>
                                          ) : (
                                            <><Search className="h-3 w-3" />Fetch Info</>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No competitors defined. Add competitors to the speaker profile to enable peer comparison.
                          </p>
                        )}
                      </div>
                      
                      {/* GEO */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Label className="text-xs">GEO CSV</Label>
                          <Badge variant="secondary" className="text-[10px] bg-secondary text-muted-foreground">{geoFile ? "Uploaded" : "Optional"}</Badge>
                        </div>
                        <Input type="file" accept=".csv" onChange={(e) => setGeoFile(e.target.files?.[0] || null)} />
                      </div>
                      
                      {/* Content Gap */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Label className="text-xs">Content Gap CSV</Label>
                          <Badge variant="secondary" className="text-[10px] bg-secondary text-muted-foreground">{contentGapFile ? "Uploaded" : "Optional"}</Badge>
                        </div>
                        <Input type="file" accept=".csv" onChange={(e) => setContentGapFile(e.target.files?.[0] || null)} />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* ── Advanced Settings ── */}
              <Collapsible open={advancedSettingsOpen} onOpenChange={setAdvancedSettingsOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-between py-2">
                  <span className="font-medium">Advanced Settings</span>
                  {advancedSettingsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-1 pb-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">CPM Rate ($)</Label>
                      <Input 
                        type="number" 
                        min={25} 
                        max={150} 
                        value={cpmRate} 
                        onChange={(e) => setCpmRate(Math.max(25, Math.min(150, parseInt(e.target.value) || 50)))}
                        className="h-8 text-xs mt-1"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Industry range: $25–$150</p>
                    </div>
                    <div>
                      <Label className="text-xs">Speaking Time %</Label>
                      <Input 
                        type="number" 
                        min={20} 
                        max={60} 
                        value={speakingTimePct} 
                        onChange={(e) => setSpeakingTimePct(Math.max(20, Math.min(60, parseInt(e.target.value) || 40)))}
                        className="h-8 text-xs mt-1"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Guest airtime: 20–60%</p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ── Section 5: Generate Button ── */}
              <Button
                onClick={handleGenerateReport}
                disabled={isProcessing || !dateRangeStart || !dateRangeEnd || 
                  (isMultiSpeakerMode 
                    ? selectedSpeakerIds.length < 2 || selectedSpeakerIds.some(id => {
                        const syncedData = speakerSyncedData[id];
                        const hasAirtable = !!syncedData || !!speakerFiles[id]?.airtableFile;
                        return !hasAirtable;
                      })
                    : !selectedSpeakerId || (!airtableSyncedData?.length && !airtableFile)
                  )
                }
                className="w-full"
                size="lg"
              >
                <Upload className="mr-2 h-5 w-5" />
                {isProcessing 
                  ? scoringProgress 
                    ? `Scoring podcast ${scoringProgress.completed} of ${scoringProgress.total}...`
                    : 'Processing...' 
                  : isMultiSpeakerMode ? 'Generate Multi-Speaker Report' : 'Generate Report'}
              </Button>
            </CardContent>
          </Card>

          {/* Report Display */}
          {reportData && (
            <>
              {/* Save Report Section */}
              <Card className="print:hidden border-border/60 shadow-none">
                <CardHeader>
                  <CardTitle className="text-[15px] font-semibold tracking-tight">Save Report</CardTitle>
                  <CardDescription>Save this report for future reference</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Report Name *</Label>
                      <Input
                        placeholder="Company - Q4 2025"
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Quarter</Label>
                      <Input
                        placeholder="Q4 2025"
                        value={quarter}
                        onChange={(e) => setQuarter(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveReport}
                    disabled={isSaving || !reportName}
                    className="w-full"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Report'}
                  </Button>
                </CardContent>
              </Card>


              {/* Print Button */}
              <div className="flex justify-end print:hidden">
                <Button onClick={handlePrint} variant="outline">
                  <Printer className="mr-2 h-4 w-4" />
                  Print Report
                </Button>
              </div>

              {/* Report Header */}
              <ReportHeader
                client={reportData.client}
                generated_at={reportData.generated_at}
                batch_name={reportData.batch_name}
              />

              {/* Hidden Items Restore Bar */}
              {(() => {
                const hiddenItems = [
                  { key: 'totalBooked', label: 'Total Booked', visible: visibleSections.totalBooked },
                  { key: 'totalPublished', label: 'Total Published', visible: visibleSections.totalPublished },
                  { key: 'totalRecorded', label: 'Total Recorded', visible: visibleSections.totalRecorded },
                  { key: 'totalIntroCalls', label: 'Intro Calls', visible: visibleSections.totalIntroCalls },
                  { key: 'socialReach', label: 'Social Reach', visible: visibleSections.socialReach },
                  { key: 'totalReach', label: 'Total Listenership', visible: visibleSections.totalReach },
                  { key: 'averageScore', label: 'Avg Score', visible: visibleSections.averageScore },
                  { key: 'emv', label: 'EMV', visible: visibleSections.emv },
                  { key: 'sov', label: 'Peer Comparison', visible: visibleSections.sov },
                  { key: 'geoScore', label: 'GEO', visible: visibleSections.geoScore },
                  { key: 'contentGap', label: 'Content Gap', visible: visibleSections.contentGap },
                  { key: 'socialValue', label: 'Social Value', visible: visibleSections.socialValue },
                  { key: 'campaignOverview', label: 'Campaign Overview', visible: visibleSections.campaignOverview },
                  { key: 'airtableEmbed', label: 'Activity Tracking', visible: visibleSections.airtableEmbed },
                  { key: 'topCategories', label: 'Top Categories', visible: visibleSections.topCategories },
                  { key: 'nextQuarterStrategy', label: 'Looking Ahead', visible: visibleSections.nextQuarterStrategy },
                  { key: 'targetPodcasts', label: 'Target Podcasts', visible: visibleSections.targetPodcasts },
                  { key: 'contentGapRecommendations', label: 'Gap Recommendations', visible: visibleSections.contentGapRecommendations },
                  { key: 'highlights', label: 'Interview Highlights', visible: visibleSections.highlights },
                ].filter(item => !item.visible);
                
                if (hiddenItems.length === 0) return null;
                
                return (
                  <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
                    <span className="text-muted-foreground">Hidden:</span>
                    {hiddenItems.map(item => (
                      <Button
                        key={item.key}
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => toggleSection(item.key as keyof typeof visibleSections)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {item.label}
                      </Button>
                    ))}
                  </div>
                );
              })()}

              {/* Core KPIs Section */}
              {coreKPIsVisible && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Core KPIs
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {visibleSections.totalBooked && (
                      <KPICard
                        title="Total Booked"
                        value={reportData.kpis.total_booked}
                        subtitle="Confirmed bookings"
                        icon={Calendar}
                        onClick={() => setBookedDialogOpen(true)}
                        onHide={() => toggleSection('totalBooked')}
                      />
                    )}
                    {visibleSections.totalPublished && (
                      <KPICard
                        title="Total Published"
                        value={reportData.kpis.total_published}
                        subtitle="Episodes live"
                        icon={Radio}
                        onClick={() => setPublishedDialogOpen(true)}
                        onHide={() => toggleSection('totalPublished')}
                      />
                    )}
                    {visibleSections.totalRecorded && (reportData.kpis.total_recorded ?? 0) > 0 && (
                      <KPICard
                        title="Total Recorded"
                        value={reportData.kpis.total_recorded || 0}
                        subtitle="Interviews completed"
                        icon={Mic}
                        onClick={() => setRecordedDialogOpen(true)}
                        onHide={() => toggleSection('totalRecorded')}
                      />
                    )}
                    {visibleSections.totalIntroCalls && (reportData.kpis.total_intro_calls ?? 0) > 0 && (
                      <KPICard
                        title="Intro Calls"
                        value={reportData.kpis.total_intro_calls || 0}
                        subtitle="Introduction calls completed"
                        icon={PhoneCall}
                        onClick={() => setIntroCallsDialogOpen(true)}
                        onHide={() => toggleSection('totalIntroCalls')}
                      />
                    )}
                    {visibleSections.socialReach && (
                      <KPICard
                        title={reportData.kpis.total_published === 0 ? "Projected Social Reach" : "Social Reach"}
                        value={reportData.kpis.total_social_reach.toLocaleString()}
                        subtitle={reportData.kpis.total_published === 0 ? "Based on booked shows" : "Combined social following"}
                        icon={Users}
                        tooltip="The combined number of followers across all of the social media accounts that we found for this podcast. Source: Rephonic"
                        onHide={() => toggleSection('socialReach')}
                      />
                    )}
                    {visibleSections.totalReach && (
                      <KPICard
                        title={reportData.kpis.total_published === 0 ? "Projected Listenership" : "Total Listenership"}
                        value={reportData.kpis.total_reach.toLocaleString()}
                        subtitle={reportData.kpis.total_published === 0 ? "Based on booked shows • Click for details" : "Total monthly listeners • Click for details"}
                        icon={Users}
                        onClick={() => setReachDialogOpen(true)}
                        onHide={() => toggleSection('totalReach')}
                      />
                    )}
                    {visibleSections.averageScore && (
                      reportData.kpis.avg_score === 0 && reportData.contains_live_scores ? (
                        <div className="group relative rounded-xl border border-border bg-card p-4 flex flex-col items-center justify-center gap-2 min-h-[120px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSection('averageScore');
                            }}
                            className="absolute top-2 right-2 p-1 rounded-full bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive print:hidden z-10"
                            title="Hide this metric"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <p className="text-sm font-medium text-foreground">Fit Scores</p>
                          <Button
                            size="sm"
                            onClick={handleGenerateFitScores}
                            disabled={isScoringFit}
                            className="gap-1"
                          >
                            {isScoringFit ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {scoringProgress ? `${scoringProgress.completed}/${scoringProgress.total}` : 'Scoring...'}
                              </>
                            ) : (
                              <>
                                <TrendingUp className="h-3 w-3" />
                                Generate Scores
                              </>
                            )}
                          </Button>
                          <p className="text-xs text-muted-foreground">Score from show notes</p>
                        </div>
                      ) : (
                        <KPICard
                          title="Average Score"
                          value={reportData.kpis.avg_score.toFixed(1)}
                          subtitle="Overall fit rating"
                          icon={TrendingUp}
                          onHide={() => toggleSection('averageScore')}
                        />
                      )
                    )}
                  </div>
                </div>
              )}

               {/* Additional Value Metrics Section */}
              {additionalMetricsVisible && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Additional Value Metrics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Campaign Value - rollup of EMV + Social Value */}
                    {visibleSections.emv && visibleSections.socialValue && reportData.kpis.total_social_reach > 0 && (reportData.kpis.total_emv || 0) > 0 && (() => {
                      const emv = reportData.kpis.total_emv || 0;
                      const totalSocialReach = reportData.kpis.total_social_reach;
                      const platformData = {
                        linkedin: { cpm: 60.00, allocation: 0.60 },
                        meta: { cpm: 10.50, allocation: 0.20 },
                        youtube: { cpm: 4.50, allocation: 0.10 },
                        tiktok: { cpm: 5.50, allocation: 0.07 },
                        x: { cpm: 1.50, allocation: 0.03 },
                      };
                      const visibilityFactor = 1.5;
                      const premiumFactor = 1.2;
                      const socialValue = Object.values(platformData).reduce((sum, p) => {
                        const allocatedReach = totalSocialReach * p.allocation;
                        const baseValue = (allocatedReach / 1000) * p.cpm;
                        return sum + baseValue * visibilityFactor * premiumFactor;
                      }, 0);
                      const totalCampaignValue = emv + socialValue;
                      let formatted: string;
                      if (totalCampaignValue >= 1000000) formatted = `$${(totalCampaignValue / 1000000).toFixed(1)}M`;
                      else if (totalCampaignValue >= 1000) formatted = `$${(totalCampaignValue / 1000).toFixed(0)}K`;
                      else formatted = `$${totalCampaignValue.toFixed(0)}`;
                      return (
                        <KPICard
                          title="Total Campaign Value"
                          value={formatted}
                          subtitle="EMV + Social Value combined"
                          icon={TrendingUp}
                          tooltip="Combined earned media value and social amplification value generated by this campaign."
                        />
                      );
                    })()}
                    {reportData.kpis.total_published === 0 && (visibleSections.emv || visibleSections.sov) && (
                      <div className="col-span-full flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-200 print:hidden">
                        <Info className="h-4 w-4 shrink-0 text-yellow-400" />
                        <span>
                          <strong>Heads up:</strong> EMV and Peer Comparison rely on published episode data. With 0 episodes published, these metrics won't have meaningful data yet.
                        </span>
                      </div>
                    )}
                    {visibleSections.emv && (
                      <KPICard
                        title="Earned Media Value"
                        value={`$${reportData.kpis.total_emv?.toLocaleString() || '0'}`}
                        subtitle={reportData.kpis.total_published === 0 ? "Requires published episodes" : "Total campaign EMV • Click to view analysis"}
                        icon={DollarSign}
                        tooltip="Based on audience size × industry CPM rate × guest speaking time. Reflects the equivalent cost to reach this audience through paid podcast advertising."
                        onClick={() => setEmvDialogOpen(true)}
                        onHide={() => toggleSection('emv')}
                      />
                    )}
                    {visibleSections.sov && (
                      <KPICard
                        title="Peer Comparison"
                        value={`${reportData.kpis.sov_percentage || reportData.sov_analysis?.client_percentage || 0}%`}
                        subtitle={reportData.kpis.total_published === 0 ? "Requires published episodes" : "vs. selected peers • Click to view analysis"}
                        icon={PieChart}
                        tooltip="Compares podcast interview volume against selected industry peers over the same period."
                        onClick={() => setSOVDialogOpen(true)}
                        onHide={() => toggleSection('sov')}
                      />
                    )}
                    {visibleSections.geoScore && (
                      <KPICard
                        title="GEO Score"
                        value={reportData.geo_analysis ? `${reportData.geo_analysis.geo_score}/100` : '0/100'}
                        subtitle={
                          reportData.geo_analysis 
                            ? `${reportData.geo_analysis.total_podcasts_indexed} podcasts • ${reportData.geo_analysis.unique_ai_engines.length} AI engines • Click for details`
                            : reportData.geo_csv_uploaded
                              ? "No podcast visibility found in AI search"
                              : "Upload GEO CSV to analyze"
                        }
                        icon={Sparkles}
                        tooltip="Generative Engine Optimization score measuring how often your podcast appearances surface in AI search engines like Perplexity, Gemini, and ChatGPT."
                        onClick={reportData.geo_analysis ? () => setGeoDialogOpen(true) : undefined}
                        onHide={() => toggleSection('geoScore')}
                      />
                    )}
                    {visibleSections.contentGap && (
                      <KPICard
                        title="Content Gap"
                        value={reportData.content_gap_analysis ? `${reportData.content_gap_analysis.coverage_percentage}%` : '—'}
                        subtitle={
                          reportData.content_gap_analysis 
                            ? `${reportData.content_gap_analysis.total_gaps} gaps • ${reportData.content_gap_analysis.total_prompts} prompts • Click for details`
                            : reportData.content_gap_csv_uploaded
                              ? "No content gap data found"
                              : "Upload Content Gap CSV to analyze"
                        }
                        icon={AlertTriangle}
                        tooltip="Analyzes AI search prompts where competitors appear but you don't, identifying content opportunities to close visibility gaps."
                        onClick={reportData.content_gap_analysis ? () => setContentGapDialogOpen(true) : undefined}
                        onHide={() => toggleSection('contentGap')}
                      />
                    )}
                    {visibleSections.socialValue && reportData.kpis.total_social_reach > 0 && (
                      <KPICard
                        title="Social Value"
                        value={(() => {
                          const totalSocialReach = reportData.kpis.total_social_reach;
                          const platformData = {
                            linkedin: { cpm: 60.00, allocation: 0.60 },
                            meta: { cpm: 10.50, allocation: 0.20 },
                            youtube: { cpm: 4.50, allocation: 0.10 },
                            tiktok: { cpm: 5.50, allocation: 0.07 },
                            x: { cpm: 1.50, allocation: 0.03 },
                          };
                          const visibilityFactor = 1.5;
                          const premiumFactor = 1.2;
                          const totalValue = Object.values(platformData).reduce((sum, p) => {
                            const allocatedReach = totalSocialReach * p.allocation;
                            const baseValue = (allocatedReach / 1000) * p.cpm;
                            return sum + baseValue * visibilityFactor * premiumFactor;
                          }, 0);
                          if (totalValue >= 1000000) return `$${(totalValue / 1000000).toFixed(1)}M`;
                          if (totalValue >= 1000) return `$${(totalValue / 1000).toFixed(0)}K`;
                          return `$${totalValue.toFixed(0)}`;
                        })()}
                        subtitle="Equivalent ad spend • Click to view breakdown"
                        icon={Share2}
                        tooltip="Calculated from follower reach across LinkedIn, Meta, YouTube, TikTok, and X using platform-specific ad rates with visibility and premium content multipliers."
                        onClick={() => setSocialValueDialogOpen(true)}
                        onHide={() => toggleSection('socialValue')}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Campaign Overview */}
              {visibleSections.campaignOverview && (
                <CampaignOverview
                  strategy={reportData.campaign_overview.strategy}
                  executive_summary={reportData.campaign_overview.executive_summary}
                  target_audiences={reportData.campaign_overview.target_audiences}
                  talking_points={reportData.campaign_overview.talking_points}
                  pitch_hooks={reportData.campaign_overview.pitch_hooks}
                  onHide={() => toggleSection('campaignOverview')}
                  onEdit={() => setCampaignOverviewEditOpen(true)}
                />
              )}

              {/* Interview Highlights */}
              {visibleSections.highlights && (
                <Card className="relative group border-border/60 shadow-none">
                  <button
                    onClick={() => toggleSection('highlights')}
                    className="absolute top-4 right-4 p-1 rounded-full bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive print:hidden z-10"
                    title="Hide this section"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-primary" />
                        Interview Highlights
                      </CardTitle>
                      <CardDescription>
                        {reportData.highlight_clips && reportData.highlight_clips.length > 0
                          ? `${reportData.highlight_clips.length} clip${reportData.highlight_clips.length !== 1 ? 's' : ''} added`
                          : 'Add video or audio clips from interviews'}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHighlightsDialogOpen(true)}
                      className="print:hidden"
                    >
                      <Video className="h-4 w-4 mr-2" />
                      {reportData.highlight_clips && reportData.highlight_clips.length > 0 ? 'Manage Clips' : 'Add Clips'}
                    </Button>
                  </CardHeader>
                  {reportData.highlight_clips && reportData.highlight_clips.length > 0 && (
                    <CardContent>
                      <ClientReportHighlights
                        clips={reportData.highlight_clips}
                        companyName={reportData.company_name || reportData.client?.company}
                      />
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Published Episodes Carousel (Single-speaker reports only) */}
              {reportData.report_type !== 'multi' && 
               reportData.podcasts && 
               reportData.podcasts.length > 0 && (
                <PublishedEpisodesCarousel 
                  podcasts={reportData.podcasts}
                  title="Published Episodes This Quarter"
                />
              )}

              {/* Airtable Embed (Company-level for multi-speaker, or single speaker) */}
              {visibleSections.airtableEmbed && (
                <AirtableEmbed
                  embedUrl={speakerAsClient?.airtable_embed_url}
                  onHide={() => toggleSection('airtableEmbed')}
                />
              )}

              {/* Speaker Breakdowns (Multi-speaker reports only) */}
              {reportData.report_type === 'multi' && 
               reportData.speaker_breakdowns && 
               reportData.speaker_breakdowns.length > 0 && (
                <SpeakerAccordion 
                  speakerBreakdowns={reportData.speaker_breakdowns}
                  defaultOpen={[reportData.speaker_breakdowns[0]?.speaker_id]}
                  visibleSections={visibleSections}
                />
              )}

              {/* Top Categories */}
              {visibleSections.topCategories && reportData.kpis.top_categories.length > 0 && (
                <Card className="relative group border-border/60 shadow-none">
                  <button
                    onClick={() => toggleSection('topCategories')}
                    className="absolute top-4 right-12 p-1 rounded-full bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive print:hidden z-10"
                    title="Hide this section"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Top Podcast Categories</CardTitle>
                      <CardDescription>
                        Audience types reached through booked podcasts
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateCategories}
                      disabled={isRegeneratingCategories}
                      className="print:hidden"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isRegeneratingCategories ? 'animate-spin' : ''}`} />
                      {isRegeneratingCategories ? 'Regenerating...' : 'Regenerate'}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {reportData.kpis.top_categories.map((cat, idx) => (
                        <Badge key={idx} variant="secondary" className="text-sm py-1 px-3">
                          {cat.name} ({cat.count})
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Next Quarter Strategy */}
              {visibleSections.nextQuarterStrategy && reportData.next_quarter_strategy && (
                <NextQuarterStrategy
                  quarter={reportData.next_quarter_strategy.quarter}
                  reportEndDate={reportData.date_range?.end}
                  intro_paragraph={reportData.next_quarter_strategy.intro_paragraph}
                  strategic_focus_areas={reportData.next_quarter_strategy.strategic_focus_areas}
                  talking_points_spotlight={reportData.next_quarter_strategy.talking_points_spotlight}
                  speaker_talking_points_spotlight={reportData.next_quarter_strategy.speaker_talking_points_spotlight}
                  closing_paragraph={reportData.next_quarter_strategy.closing_paragraph}
                  next_quarter_kpis={reportData.next_quarter_strategy.next_quarter_kpis}
                  onHide={() => toggleSection('nextQuarterStrategy')}
                  onEdit={() => setNextQuarterEditOpen(true)}
                  onRegenerateTalkingPoints={handleRegenerateTalkingPoints}
                  isRegenerating={isRegeneratingTalkingPoints}
                />
              )}

              {/* Target Podcasts for Next Quarter */}
              {visibleSections.targetPodcasts && reportData.next_quarter_strategy && reportData.client && (
                <TargetPodcastsSection
                  client={reportData.client}
                  nextQuarterStrategy={reportData.next_quarter_strategy}
                  topCategories={reportData.kpis.top_categories}
                  initialPodcasts={reportData.target_podcasts}
                  onPodcastsGenerated={(podcasts) => {
                    if (currentReportId) {
                      updateReportTargetPodcasts(podcasts);
                    } else {
                      setReportData(prev => prev ? { ...prev, target_podcasts: podcasts } : null);
                    }
                  }}
                  onHide={() => toggleSection('targetPodcasts')}
                />
              )}

              {/* Content Gap Recommendations */}
              {visibleSections.contentGapRecommendations && reportData.content_gap_analysis && (
                <ContentGapRecommendations
                  gapAnalysis={reportData.content_gap_analysis}
                  client={reportData.client}
                  onUpdate={handleContentGapRecommendationsUpdate}
                  onHide={() => toggleSection('contentGapRecommendations')}
                />
              )}

              {/* Dialogs */}
              <EMVAnalysisDialog
                open={emvDialogOpen}
                onOpenChange={setEmvDialogOpen}
                podcasts={reportData.podcasts}
                cpm={reportData.cpm || 50}
                speakingTimePct={reportData.speaking_time_pct || 0.40}
              />
              
              <SOVChartDialog
                open={sovDialogOpen}
                onOpenChange={setSOVDialogOpen}
                sovAnalysis={reportData.sov_analysis || null}
                clientName={speakerAsClient?.name}
                dateRange={reportData.date_range}
                podcasts={reportData.podcasts}
                publishedCount={reportData.kpis.total_published}
                onRefresh={async (updatedSOV) => {
                  if (!currentReportId) return;
                  const updatedReportData = {
                    ...reportData,
                    sov_analysis: updatedSOV,
                    kpis: {
                      ...reportData.kpis,
                      sov_percentage: updatedSOV?.client_percentage
                    },
                    visibleSections
                  };
                  setReportData(updatedReportData);
                  await supabase
                    .from('reports')
                    .update({ report_data: updatedReportData as any })
                    .eq('id', currentReportId);
                  toast({
                    title: "SOV Refreshed",
                    description: `Client interviews updated to ${updatedSOV?.client_interview_count} (${updatedSOV?.client_percentage}%)`,
                  });
                }}
              />
              
              <GEODialog
                open={geoDialogOpen}
                onOpenChange={setGeoDialogOpen}
                geoAnalysis={reportData.geo_analysis || null}
              />

              <ContentGapDialog
                open={contentGapDialogOpen}
                onOpenChange={setContentGapDialogOpen}
                gapAnalysis={reportData.content_gap_analysis || null}
              />
              
              <SocialValueDialog
                open={socialValueDialogOpen}
                onOpenChange={setSocialValueDialogOpen}
                totalSocialReach={reportData.kpis.total_social_reach}
              />
              
              <PodcastListDialog
                open={bookedDialogOpen}
                onOpenChange={setBookedDialogOpen}
                title="Booked Podcasts"
                description="Podcasts with confirmed bookings this period."
                icon={Calendar}
                podcasts={reportData.podcasts}
                dateField="date_booked"
                dateRange={reportData.date_range}
              />
              
              <PodcastListDialog
                open={publishedDialogOpen}
                onOpenChange={setPublishedDialogOpen}
                title="Published Episodes"
                description="Episodes that went live this period."
                icon={Radio}
                podcasts={reportData.podcasts}
                dateField="date_published"
                dateRange={reportData.date_range}
              />
              
              <PodcastListDialog
                open={recordedDialogOpen}
                onOpenChange={setRecordedDialogOpen}
                title="Recorded Podcasts"
                description="Podcast interviews recorded this period."
                icon={Radio}
                podcasts={reportData.podcasts}
                dateField="scheduled_date_time"
                dateRange={reportData.date_range}
              />
              
              <PodcastListDialog
                open={introCallsDialogOpen}
                onOpenChange={setIntroCallsDialogOpen}
                title="Intro Calls"
                description="Introduction calls completed this period."
                icon={PhoneCall}
                podcasts={reportData.intro_call_podcasts || []}
                dateField="scheduled_date_time"
                dateRange={reportData.date_range}
              />
              
              <ReachAnalysisDialog
                open={reachDialogOpen}
                onOpenChange={setReachDialogOpen}
                podcasts={reportData.podcasts}
                totalListenersPerEpisode={reportData.kpis.total_listeners_per_episode}
                quarter={quarter}
                dateRange={reportData.date_range}
                totalReach={reportData.kpis.total_reach}
              />

              <HighlightUploadDialog
                open={highlightsDialogOpen}
                onOpenChange={setHighlightsDialogOpen}
                existingClips={reportData.highlight_clips || []}
                onSave={updateReportHighlights}
                podcasts={reportData.podcasts?.map(p => p.show_title).filter(Boolean) as string[]}
                speakers={reportData.speaker_breakdowns?.map(s => s.speaker_name) || []}
              />

              <CampaignOverviewEditDialog
                open={campaignOverviewEditOpen}
                onOpenChange={setCampaignOverviewEditOpen}
                data={reportData.campaign_overview}
                onSave={updateReportCampaignOverview}
              />

              {reportData.next_quarter_strategy && (
                <NextQuarterEditDialog
                  open={nextQuarterEditOpen}
                  onOpenChange={setNextQuarterEditOpen}
                  data={reportData.next_quarter_strategy}
                  onSave={updateReportNextQuarterStrategy}
                  speakerNames={reportData.speaker_breakdowns?.map(s => s.speaker_name) || []}
                />
              )}
            </>
          )}

          {/* Update CSV Dialog - available globally */}
          <UpdateCSVDialog
            open={updateCSVDialogOpen}
            onOpenChange={setUpdateCSVDialogOpen}
            report={reportToUpdate}
            onUpdated={() => {
              loadAllReports();
              loadSavedReports();
              // If the currently viewed report was updated, reload it
              if (currentReportId && reportToUpdate?.id === currentReportId) {
                const refreshReport = async () => {
                  const { data } = await supabase
                    .from('reports')
                    .select('*')
                    .eq('id', currentReportId)
                    .single();
                  if (data) {
                    loadReport(data);
                  }
                };
                refreshReport();
              }
            }}
          />

          {/* Airtable Connection Dialog for initial report creation */}
          <AirtableConnectionDialog
            open={airtableConnectionDialogOpen}
            onOpenChange={setAirtableConnectionDialogOpen}
            companyId={selectedCompanyId || undefined}
            speakerId={selectedSpeakerId || undefined}
            entityName={speakerAsClient?.name || selectedCompany?.name || 'Company'}
            onConnectionSaved={() => setConnectionVersion(v => v + 1)}
          />
        </div>
      </main>
    </div>
  );
}
