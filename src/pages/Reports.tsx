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
import { generateReportFromMultipleCSVs, generateMultiSpeakerReport, SpeakerDataInput } from "@/utils/reportGenerator";
import { parseBatchCSV, parseAirtableCSV, parseSOVCSV, parseGEOCSV, parseContentGapCSV, parseRephonicCSV } from "@/utils/csvParsers";
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
import { ContentGapRecommendations } from "@/components/reports/ContentGapRecommendations";
import { AirtableEmbed } from "@/components/reports/AirtableEmbed";
import { SpeakerAccordion } from "@/components/reports/SpeakerAccordion";
import { PublishedEpisodesCarousel } from "@/components/reports/PublishedEpisodesCarousel";
import { Upload, FileText, TrendingUp, Users, Printer, Calendar, Radio, Trash2, Eye, DollarSign, PieChart, Sparkles, Search, Clipboard, X, AlertTriangle, ChevronDown, ChevronRight, Globe, Link, Copy, ExternalLink, Video, RefreshCw, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { HighlightClip } from "@/types/reports";
import HighlightUploadDialog from "@/components/reports/HighlightUploadDialog";
import ClientReportHighlights from "@/components/client-report/ClientReportHighlights";
import { CampaignOverviewEditDialog } from "@/components/reports/CampaignOverviewEditDialog";
import { NextQuarterEditDialog } from "@/components/reports/NextQuarterEditDialog";
import { UpdateCSVDialog } from "@/components/reports/UpdateCSVDialog";

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
  const [speakerFileExpanded, setSpeakerFileExpanded] = useState<{ [speakerId: string]: boolean }>({});
  
  // Single-speaker file uploads
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [airtableFile, setAirtableFile] = useState<File | null>(null);
  
  // Company-level file uploads (shared for multi-speaker)
  const [sovFile, setSOVFile] = useState<File | null>(null);
  const [geoFile, setGeoFile] = useState<File | null>(null);
  const [contentGapFile, setContentGapFile] = useState<File | null>(null);
  const [rephonicEmvFile, setRephonicEmvFile] = useState<File | null>(null);
  
  // Manual SOV inputs
  const [manualSOVMode, setManualSOVMode] = useState(false);
  const [competitorInterviews, setCompetitorInterviews] = useState<{ name: string; role: string; count: number }[]>([]);
  
  // Report metadata
  const [reportName, setReportName] = useState<string>('');
  const [quarter, setQuarter] = useState<string>('');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // State
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [allReports, setAllReports] = useState<any[]>([]);
  const [allReportsSearchQuery, setAllReportsSearchQuery] = useState('');
  const [allReportsExpanded, setAllReportsExpanded] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emvDialogOpen, setEmvDialogOpen] = useState(false);
  const [reachDialogOpen, setReachDialogOpen] = useState(false);
  const [sovDialogOpen, setSOVDialogOpen] = useState(false);
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  const [contentGapDialogOpen, setContentGapDialogOpen] = useState(false);
  const [socialValueDialogOpen, setSocialValueDialogOpen] = useState(false);
  const [highlightsDialogOpen, setHighlightsDialogOpen] = useState(false);
  const [campaignOverviewEditOpen, setCampaignOverviewEditOpen] = useState(false);
  const [nextQuarterEditOpen, setNextQuarterEditOpen] = useState(false);
  const [updateCSVDialogOpen, setUpdateCSVDialogOpen] = useState(false);
  const [reportToUpdate, setReportToUpdate] = useState<any>(null);
  
  
  // Visibility state for report sections
  const [visibleSections, setVisibleSections] = useState({
    // Core KPIs
    totalBooked: true,
    totalPublished: true,
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
  
  const coreKPIsVisible = visibleSections.totalBooked || visibleSections.totalPublished || 
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
        supabase.from('companies').select('*').order('name', { ascending: true }),
        supabase.from('speakers').select('*').order('name', { ascending: true }),
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
  
  const speakerAsClient: MinimalClient | null = useMemo(() => {
    if (!selectedSpeaker || !selectedCompany) return null;
    return {
      id: selectedSpeaker.id,
      name: selectedSpeaker.name,
      company: selectedCompany.name,
      company_url: selectedCompany.company_url || '',
      logo_url: (selectedCompany as any).logo_url || '',
      brand_colors: (selectedCompany as any).brand_colors || undefined,
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
      
      // Validate all speakers have both files
      for (const speakerId of selectedSpeakerIds) {
        const files = speakerFiles[speakerId];
        if (!files?.batchFile || !files?.airtableFile) {
          const speaker = speakers.find(s => s.id === speakerId);
          toast({
            title: "Missing CSV files",
            description: `${speaker?.name || 'Speaker'} is missing required Batch or Airtable CSV.`,
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
          
          if (!speaker || !files?.batchFile || !files?.airtableFile) continue;
          
          const batchText = await files.batchFile.text();
          const airtableText = await files.airtableFile.text();
          
          const batchRows = parseBatchCSV(batchText);
          const airtableRows = parseAirtableCSV(airtableText, startDate, endDate);
          
          speakerDataInputs.push({
            speaker: speaker as Speaker,
            batchRows,
            airtableRows,
          });
        }
        
        // Parse company-level CSVs
        const sovText = sovFile ? await sovFile.text() : null;
        const geoText = geoFile ? await geoFile.text() : null;
        const contentGapText = contentGapFile ? await contentGapFile.text() : null;
        const rephonicEmvText = rephonicEmvFile ? await rephonicEmvFile.text() : null;
        
        const sovRows = sovText ? parseSOVCSV(sovText) : null;
        const geoRows = geoText ? parseGEOCSV(geoText) : [];
        const contentGapRows = contentGapText ? parseContentGapCSV(contentGapText) : [];
        const rephonicRows = rephonicEmvText ? parseRephonicCSV(rephonicEmvText) : undefined;
        
        // Prepare manual SOV data
        const manualSOVCompetitors = manualSOVMode && competitorInterviews.length > 0
          ? competitorInterviews.filter(c => c.count > 0)
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
          50, // CPM
          rephonicRows,
          !!geoFile, // geoCsvProvided
          !!contentGapFile // contentGapCsvProvided
        );
        
        setReportData(report);
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
    if (!batchFile) {
      toast({
        title: "Missing required CSV",
        description: "Batch Results CSV is required.",
        variant: "destructive",
      });
      return;
    }
    if (!airtableFile) {
      toast({
        title: "Missing required CSV",
        description: "Airtable Report CSV is required.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Read CSV files
      const batchText = await batchFile.text();
      const airtableText = await airtableFile.text();
      const sovText = sovFile ? await sovFile.text() : null;
      const geoText = geoFile ? await geoFile.text() : null;
      const contentGapText = contentGapFile ? await contentGapFile.text() : null;
      const rephonicEmvText = rephonicEmvFile ? await rephonicEmvFile.text() : null;
      
      // Parse CSVs
      const batchRows = parseBatchCSV(batchText);
      const airtableRows = parseAirtableCSV(airtableText, startDate, endDate);
      const sovRows = sovText ? parseSOVCSV(sovText) : null;
      const geoRows = geoText ? parseGEOCSV(geoText) : [];
      const contentGapRows = contentGapText ? parseContentGapCSV(contentGapText) : [];
      const rephonicRows = rephonicEmvText ? parseRephonicCSV(rephonicEmvText) : undefined;
      
      // Prepare manual SOV data if in manual mode
      const manualSOVCompetitors = manualSOVMode && competitorInterviews.length > 0
        ? competitorInterviews.filter(c => c.count > 0)
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
        50, // CPM
        rephonicRows,
        !!geoFile, // geoCsvProvided
        !!contentGapFile // contentGapCsvProvided
      );
      
      setReportData(report);
      toast({
        title: "Report generated",
        description: `Successfully processed ${report.kpis.total_evaluated} podcasts with ${report.kpis.total_interviews} interviews.`,
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
      const { error } = await supabase.from('reports').insert({
        org_id: TEAM_ORG_ID,
        speaker_id: isMultiSpeakerMode ? null : selectedSpeakerId, // null for multi-speaker
        company_id: selectedCompanyId,
        report_name: reportName,
        quarter: quarter || null,
        date_range_start: reportData.date_range?.start.split('T')[0] || new Date().toISOString().split('T')[0],
        date_range_end: reportData.date_range?.end.split('T')[0] || new Date().toISOString().split('T')[0],
        report_data: {
          ...reportData,
          selected_speaker_ids: isMultiSpeakerMode ? selectedSpeakerIds : undefined,
          visibleSections, // Include visible sections for public view
        } as any,
      });
      
      if (error) throw error;
      
      toast({
        title: "Report saved",
        description: "Your report has been saved successfully.",
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
    if (!currentReportId || !reportData) return;
    
    const updatedReportData = { ...reportData, target_podcasts: podcasts, visibleSections };
    setReportData(updatedReportData);
    
    try {
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

  const handleContentGapRecommendationsUpdate = async (recommendations: ReportData['content_gap_analysis']['ai_recommendations']) => {
    if (!reportData || !reportData.content_gap_analysis) return;
    
    const updatedReportData = {
      ...reportData,
      content_gap_analysis: {
        ...reportData.content_gap_analysis,
        ai_recommendations: recommendations
      },
      visibleSections
    };
    setReportData(updatedReportData);
    
    // Auto-save to database if report is saved
    if (currentReportId) {
      try {
        await supabase
          .from('reports')
          .update({ report_data: updatedReportData as any })
          .eq('id', currentReportId);
      } catch (error) {
        console.error('Error saving content gap recommendations:', error);
      }
    }
  };

  // Update saved report with highlight clips
  const updateReportHighlights = async (clips: HighlightClip[]) => {
    if (!currentReportId || !reportData) return;
    
    const updatedReportData = { ...reportData, highlight_clips: clips, visibleSections };
    setReportData(updatedReportData);
    
    try {
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

    // Create a completely new reportData object to ensure React detects the change
    const updatedReportData = {
      ...reportData,
      campaign_overview: nextCampaignOverview,
      visibleSections,
    };
    setReportData(updatedReportData);
    
    // Only save to database if report is already saved
    if (currentReportId) {
      try {
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
    } else {
      toast({
        title: "Campaign overview updated",
        description: "Changes applied. Save report to persist.",
      });
    }
  };

  // Update report with next quarter strategy edits (works for both saved and unsaved reports)
  const updateReportNextQuarterStrategy = async (strategy: NonNullable<ReportData["next_quarter_strategy"]>) => {
    if (!reportData) return;
    
    const updatedReportData = { ...reportData, next_quarter_strategy: strategy, visibleSections };
    setReportData(updatedReportData);
    
    // Only save to database if report is already saved
    if (currentReportId) {
      try {
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

  return (
    <div className="min-h-screen w-full">
      <BackgroundFX />
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* All Saved Reports Section */}
          {allReports.length > 0 && (
            <Collapsible open={allReportsExpanded} onOpenChange={setAllReportsExpanded}>
              <Card className="print:hidden">
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
                          <CardTitle className="text-base">All Saved Reports</CardTitle>
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
                            <TableRow key={report.id}>
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
                                    variant="outline"
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
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
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
                                    <Video className="h-4 w-4 mr-1" />
                                    Highlights
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setReportToUpdate(report);
                                      setUpdateCSVDialogOpen(true);
                                    }}
                                    title="Update CSV data"
                                  >
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                    Update
                                  </Button>
                                  {report.is_published ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleUnpublishReport(report.id)}
                                    >
                                      Unpublish
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => handlePublishReport(report.id)}
                                    >
                                      <Globe className="h-4 w-4 mr-1" />
                                      Publish
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      deleteReport(report.id);
                                      loadAllReports();
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
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
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle>Generate Client Report</CardTitle>
              <CardDescription>
                Upload CSVs to generate a comprehensive campaign report with KPIs and metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Company/Speaker Selection */}
              <div className="space-y-4">
                <Label className="mb-2 block">Select Company{!isMultiSpeakerMode && ' & Speaker'} *</Label>
                
                {!isMultiSpeakerMode ? (
                  <CompanySpeakerSelector
                    companies={companies}
                    speakers={speakers}
                    selectedCompanyId={selectedCompanyId}
                    selectedSpeakerId={selectedSpeakerId}
                    onCompanyChange={(id) => {
                      setSelectedCompanyId(id);
                      setSelectedSpeakerId(null);
                    }}
                    onSpeakerChange={setSelectedSpeakerId}
                  />
                ) : (
                  <Select
                    value={selectedCompanyId || ''}
                    onValueChange={(id) => {
                      setSelectedCompanyId(id);
                      setSelectedSpeakerIds([]);
                      setSpeakerFiles({});
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(company => (
                        <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {/* Multi-speaker toggle - only show when company has 2+ speakers */}
                {selectedCompanyId && companySpeakers.length >= 2 && (
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Multi-Speaker Report</Label>
                      <p className="text-xs text-muted-foreground">
                        Generate a single report combining multiple speakers
                      </p>
                    </div>
                    <Switch
                      checked={isMultiSpeakerMode}
                      onCheckedChange={(checked) => {
                        setIsMultiSpeakerMode(checked);
                        if (checked) {
                          setSelectedSpeakerId(null);
                          setSelectedSpeakerIds([]);
                          setSpeakerFiles({});
                          setBatchFile(null);
                          setAirtableFile(null);
                        } else {
                          setSelectedSpeakerIds([]);
                          setSpeakerFiles({});
                        }
                      }}
                    />
                  </div>
                )}
                
                {/* Multi-speaker selection checkboxes */}
                {isMultiSpeakerMode && selectedCompanyId && companySpeakers.length >= 2 && (
                  <div className="space-y-3 border rounded-lg p-4">
                    <Label className="text-sm">Select Speakers (minimum 2)</Label>
                    <div className="space-y-2">
                      {companySpeakers.map(speaker => (
                        <div key={speaker.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`speaker-${speaker.id}`}
                            checked={selectedSpeakerIds.includes(speaker.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSpeakerIds(prev => [...prev, speaker.id]);
                                setSpeakerFileExpanded(prev => ({ ...prev, [speaker.id]: true }));
                              } else {
                                setSelectedSpeakerIds(prev => prev.filter(id => id !== speaker.id));
                                setSpeakerFiles(prev => {
                                  const updated = { ...prev };
                                  delete updated[speaker.id];
                                  return updated;
                                });
                              }
                            }}
                          />
                          <label
                            htmlFor={`speaker-${speaker.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {speaker.name}
                            {speaker.title && <span className="text-muted-foreground"> – {speaker.title}</span>}
                          </label>
                        </div>
                      ))}
                    </div>
                    {selectedSpeakerIds.length > 0 && selectedSpeakerIds.length < 2 && (
                      <p className="text-xs text-destructive">Select at least 2 speakers for a multi-speaker report</p>
                    )}
                  </div>
                )}
              </div>

              {/* Date Range */}
              <div className="space-y-4">
                <Label>Report Period *</Label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Year Selector */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Year</Label>
                    <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {[selectedYear - 1, selectedYear, selectedYear + 1].map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Quarter Selector */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Quarter</Label>
                    <Select value={selectedQuarter} onValueChange={handleQuarterChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Quarter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Q1">Q1 (Jan - Mar)</SelectItem>
                        <SelectItem value="Q2">Q2 (Apr - Jun)</SelectItem>
                        <SelectItem value="Q3">Q3 (Jul - Sep)</SelectItem>
                        <SelectItem value="Q4">Q4 (Oct - Dec)</SelectItem>
                        <SelectItem value="custom">Custom Date Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Custom Date Pickers - Only shown when "custom" selected */}
                {selectedQuarter === 'custom' && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={dateRangeStart}
                        onChange={(e) => setDateRangeStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={dateRangeEnd}
                        onChange={(e) => setDateRangeEnd(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* CSV Uploads */}
              <div className="space-y-4">
                {/* Multi-speaker per-speaker CSV uploads */}
                {isMultiSpeakerMode && selectedSpeakerIds.length > 0 && (
                  <div className="space-y-3">
                    <Label className="font-medium">Per-Speaker CSV Files</Label>
                    {selectedSpeakerIds.map(speakerId => {
                      const speaker = speakers.find(s => s.id === speakerId);
                      const files = speakerFiles[speakerId] || { batchFile: null, airtableFile: null };
                      const isExpanded = speakerFileExpanded[speakerId] ?? true;
                      
                      return (
                        <Collapsible key={speakerId} open={isExpanded} onOpenChange={(open) => setSpeakerFileExpanded(prev => ({ ...prev, [speakerId]: open }))}>
                          <div className="border rounded-lg">
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50">
                              <div className="flex items-center gap-2">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <span className="font-medium">{speaker?.name}</span>
                                {files.batchFile && files.airtableFile && (
                                  <Badge variant="default" className="ml-2">Ready</Badge>
                                )}
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-4 pb-4 space-y-3">
                              <div>
                                <Label className="text-xs">Batch Results CSV *</Label>
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
                              </div>
                              <div>
                                <Label className="text-xs">Airtable Report CSV *</Label>
                                <Input
                                  type="file"
                                  accept=".csv"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    setSpeakerFiles(prev => ({
                                      ...prev,
                                      [speakerId]: { ...prev[speakerId], airtableFile: file }
                                    }));
                                  }}
                                />
                                {files.airtableFile && <p className="text-xs text-muted-foreground mt-1">{files.airtableFile.name}</p>}
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
                        <Label>Batch Results CSV *</Label>
                        <Badge variant={batchFile ? "default" : "secondary"}>
                          {batchFile ? "Uploaded" : "Required"}
                        </Badge>
                      </div>
                      <Input type="file" accept=".csv" onChange={(e) => setBatchFile(e.target.files?.[0] || null)} />
                      {batchFile && <p className="text-xs text-muted-foreground mt-1">{batchFile.name}</p>}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Label>Airtable Report CSV *</Label>
                        <Badge variant={airtableFile ? "default" : "secondary"}>
                          {airtableFile ? "Uploaded" : "Required"}
                        </Badge>
                      </div>
                      <Input type="file" accept=".csv" onChange={(e) => setAirtableFile(e.target.files?.[0] || null)} />
                      {airtableFile && <p className="text-xs text-muted-foreground mt-1">{airtableFile.name}</p>}
                    </div>
                  </>
                )}

                {/* Company-level CSVs (shared) */}
                <div className="pt-4 border-t">
                  <Label className="font-medium mb-3 block">{isMultiSpeakerMode ? 'Company-Level Data (Shared)' : 'Optional Data'}</Label>
                  
                  {/* SOV/Peer Comparison */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">Peer Comparison</Label>
                        <Badge variant={manualSOVMode && competitorInterviews.some(c => c.count > 0) ? "default" : sovFile ? "default" : "outline"}>
                          {manualSOVMode && competitorInterviews.some(c => c.count > 0) 
                            ? "Manual Entry" 
                            : sovFile 
                              ? "CSV Uploaded" 
                              : "Optional"}
                        </Badge>
                      </div>
                    </div>
                    
                    {manualSOVMode && competitorInterviews.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Enter podcast appearance counts for each competitor in this period. 
                          Click the copy button to get a pre-filled ListenNotes search URL.
                        </p>
                        
                        {competitorInterviews.map((comp, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg border">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{comp.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{comp.role}</p>
                            </div>
                            <Input
                              type="number"
                              min="0"
                              className="w-20"
                              placeholder="0"
                              value={comp.count || ''}
                              onChange={(e) => updateCompetitorCount(index, parseInt(e.target.value) || 0)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyListenNotesURL(comp.name)}
                              title="Copy ListenNotes search URL"
                            >
                              <Clipboard className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        
                        {/* CSV upload fallback */}
                        <div className="pt-2 border-t mt-3">
                          <p className="text-xs text-muted-foreground mb-2">Or upload CSV instead:</p>
                          <Input type="file" accept=".csv" onChange={(e) => setSOVFile(e.target.files?.[0] || null)} />
                          {sovFile && <p className="text-xs text-muted-foreground mt-1">{sovFile.name}</p>}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground mb-2">
                          No competitors defined for {isMultiSpeakerMode ? 'selected speakers' : 'this speaker'}. 
                          Upload a SOV CSV or add competitors to the speaker profile.
                        </p>
                        <Input type="file" accept=".csv" onChange={(e) => setSOVFile(e.target.files?.[0] || null)} />
                        {sovFile && <p className="text-xs text-muted-foreground mt-1">{sovFile.name}</p>}
                      </>
                    )}
                  </div>
                  
                  {/* GEO */}
                  <div className="mb-4">
                    <Label className="text-sm">GEO CSV</Label>
                    <Badge variant={geoFile ? "default" : "outline"} className="ml-2 mb-2">{geoFile ? "Uploaded" : "Optional"}</Badge>
                    <Input type="file" accept=".csv" onChange={(e) => setGeoFile(e.target.files?.[0] || null)} />
                  </div>
                  
                  {/* Content Gap */}
                  <div className="mb-4">
                    <Label className="text-sm">Content Gap Analysis CSV</Label>
                    <Badge variant={contentGapFile ? "default" : "outline"} className="ml-2 mb-2">{contentGapFile ? "Uploaded" : "Optional"}</Badge>
                    <Input type="file" accept=".csv" onChange={(e) => setContentGapFile(e.target.files?.[0] || null)} />
                  </div>
                  
                  {/* Rephonic EMV */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-sm">Rephonic EMV CSV</Label>
                      <Badge variant={rephonicEmvFile ? "default" : "outline"}>{rephonicEmvFile ? "Uploaded" : "Optional"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Upload a Rephonic export with podcast EMV data. For multi-speaker reports, all EMV values will be combined.
                    </p>
                    <Input type="file" accept=".csv" onChange={(e) => setRephonicEmvFile(e.target.files?.[0] || null)} />
                    {rephonicEmvFile && <p className="text-xs text-muted-foreground mt-1">{rephonicEmvFile.name}</p>}
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerateReport}
                disabled={isProcessing || !dateRangeStart || !dateRangeEnd || 
                  (isMultiSpeakerMode 
                    ? selectedSpeakerIds.length < 2 || selectedSpeakerIds.some(id => !speakerFiles[id]?.batchFile || !speakerFiles[id]?.airtableFile)
                    : !selectedSpeakerId || !batchFile || !airtableFile
                  )
                }
                className="w-full"
                size="lg"
              >
                <Upload className="mr-2 h-5 w-5" />
                {isProcessing ? 'Processing...' : isMultiSpeakerMode ? 'Generate Multi-Speaker Report' : 'Generate Report'}
              </Button>
            </CardContent>
          </Card>

          {/* Report Display */}
          {reportData && (
            <>
              {/* Save Report Section */}
              <Card className="print:hidden">
                <CardHeader>
                  <CardTitle>Save Report</CardTitle>
                  <CardDescription>Save this report for future reference</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Report Name *</Label>
                      <Input
                        placeholder="Q4 2025 Campaign Report"
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
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Core KPIs
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {visibleSections.totalBooked && (
                      <KPICard
                        title="Total Booked"
                        value={reportData.kpis.total_booked}
                        subtitle="Confirmed bookings"
                        icon={Calendar}
                        onHide={() => toggleSection('totalBooked')}
                      />
                    )}
                    {visibleSections.totalPublished && (
                      <KPICard
                        title="Total Published"
                        value={reportData.kpis.total_published}
                        subtitle="Episodes live"
                        icon={Radio}
                        onHide={() => toggleSection('totalPublished')}
                      />
                    )}
                    {visibleSections.socialReach && (
                      <KPICard
                        title="Social Reach"
                        value={reportData.kpis.total_social_reach.toLocaleString()}
                        subtitle="Combined social following"
                        icon={Users}
                        onHide={() => toggleSection('socialReach')}
                      />
                    )}
                    {visibleSections.totalReach && (
                      <KPICard
                        title="Total Listenership"
                        value={reportData.kpis.total_reach.toLocaleString()}
                        subtitle="Total monthly listeners • Click for details"
                        icon={Users}
                        onClick={() => setReachDialogOpen(true)}
                        onHide={() => toggleSection('totalReach')}
                      />
                    )}
                    {visibleSections.averageScore && (
                      <KPICard
                        title="Average Score"
                        value={reportData.kpis.avg_score.toFixed(1)}
                        subtitle="Overall fit rating"
                        icon={TrendingUp}
                        onHide={() => toggleSection('averageScore')}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Additional Value Metrics Section */}
              {additionalMetricsVisible && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                    <Sparkles className="h-5 w-5 text-accent" />
                    Additional Value Metrics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {visibleSections.emv && (
                      <KPICard
                        title="Earned Media Value"
                        value={`$${reportData.kpis.total_emv?.toLocaleString() || '0'}`}
                        subtitle="Total campaign EMV • Click to view analysis"
                        icon={DollarSign}
                        onClick={() => setEmvDialogOpen(true)}
                        onHide={() => toggleSection('emv')}
                      />
                    )}
                    {visibleSections.sov && (
                      <KPICard
                        title="Peer Comparison"
                        value={`${reportData.kpis.sov_percentage || reportData.sov_analysis?.client_percentage || 0}%`}
                        subtitle="vs. selected peers • Click to view analysis"
                        icon={PieChart}
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
                <Card className="relative group">
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
                <Card className="relative group">
                  <button
                    onClick={() => toggleSection('topCategories')}
                    className="absolute top-4 right-4 p-1 rounded-full bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive print:hidden z-10"
                    title="Hide this section"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <CardHeader>
                    <CardTitle>Top Categories</CardTitle>
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
                  intro_paragraph={reportData.next_quarter_strategy.intro_paragraph}
                  strategic_focus_areas={reportData.next_quarter_strategy.strategic_focus_areas}
                  talking_points_spotlight={reportData.next_quarter_strategy.talking_points_spotlight}
                  speaker_talking_points_spotlight={reportData.next_quarter_strategy.speaker_talking_points_spotlight}
                  closing_paragraph={reportData.next_quarter_strategy.closing_paragraph}
                  next_quarter_kpis={reportData.next_quarter_strategy.next_quarter_kpis}
                  onHide={() => toggleSection('nextQuarterStrategy')}
                  onEdit={() => setNextQuarterEditOpen(true)}
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
              
              <ReachAnalysisDialog
                open={reachDialogOpen}
                onOpenChange={setReachDialogOpen}
                podcasts={reportData.podcasts}
                totalListenersPerEpisode={reportData.kpis.total_listeners_per_episode}
                quarter={quarter}
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
        </div>
      </main>
    </div>
  );
}
