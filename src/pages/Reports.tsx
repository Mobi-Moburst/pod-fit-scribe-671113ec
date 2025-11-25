import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientCombobox } from "@/components/ClientCombobox";
import { MinimalClient } from "@/types/clients";
import { supabase } from "@/integrations/supabase/client";
import { TEAM_ORG_ID } from "@/integrations/supabase/client";
import { generateReportFromMultipleCSVs } from "@/utils/reportGenerator";
import { parseBatchCSV, parseAirtableCSV, parseSOVCSV, parseGEOCSV } from "@/utils/csvParsers";
import { ReportData } from "@/types/reports";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { KPICard } from "@/components/reports/KPICard";
import { CampaignOverview } from "@/components/reports/CampaignOverview";
import { PodcastTable } from "@/components/reports/PodcastTable";
import { EMVAnalysisDialog } from "@/components/reports/EMVAnalysisDialog";
import { SOVChartDialog } from "@/components/reports/SOVChartDialog";
import { GEODialog } from "@/components/reports/GEODialog";
import { Upload, FileText, TrendingUp, Users, Printer, Calendar, Radio, Trash2, Eye, DollarSign, PieChart, Sparkles, Search, Clipboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Reports() {
  const [clients, setClients] = useState<MinimalClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  // File uploads
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [airtableFile, setAirtableFile] = useState<File | null>(null);
  const [sovFile, setSOVFile] = useState<File | null>(null);
  const [geoFile, setGeoFile] = useState<File | null>(null);
  
  // Manual SOV inputs
  const [manualSOVMode, setManualSOVMode] = useState(false);
  const [competitorInterviews, setCompetitorInterviews] = useState<{ name: string; role: string; count: number }[]>([]);
  const [scrapingStates, setScrapingStates] = useState<Record<string, boolean>>({});
  const [scrapedEpisodesByCompetitor, setScrapedEpisodesByCompetitor] = useState<Record<string, any[]>>({});
  
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [emvDialogOpen, setEmvDialogOpen] = useState(false);
  const [sovDialogOpen, setSOVDialogOpen] = useState(false);
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  
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

  useEffect(() => {
    const loadClients = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        console.error('Error loading clients:', error);
        toast({
          title: "Error loading clients",
          description: "Failed to load client list from database.",
          variant: "destructive",
        });
        return;
      }
      
      // Map and cast competitors properly
      const mappedClients: MinimalClient[] = (data || []).map(c => ({
        id: c.id,
        name: c.name,
        company: c.company || '',
        company_url: c.company_url || '',
        media_kit_url: c.media_kit_url || '',
        target_audiences: c.target_audiences || [],
        talking_points: c.talking_points || [],
        avoid: c.avoid || [],
        notes: c.notes || '',
        campaign_strategy: c.campaign_strategy || '',
        campaign_manager: c.campaign_manager || '',
        pitch_template: c.pitch_template || '',
        title: c.title || '',
        gender: c.gender as any,
        guest_identity_tags: c.guest_identity_tags || [],
        professional_credentials: c.professional_credentials || [],
        competitors: (c.competitors as any) || []
      }));
      setClients(mappedClients);
    };
    
    loadClients();
  }, [toast]);

  useEffect(() => {
    if (selectedClientId) {
      loadSavedReports();
      // Load competitors for manual SOV mode
      const client = clients.find(c => c.id === selectedClientId);
      if (client?.competitors && client.competitors.length > 0) {
        setManualSOVMode(true);
        setCompetitorInterviews(
          client.competitors.map(comp => ({
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
  }, [selectedClientId, clients]);

  const loadSavedReports = async () => {
    if (!selectedClientId) return;
    
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', selectedClientId)
      .order('generated_at', { ascending: false });
    
    if (error) {
      console.error('Error loading reports:', error);
      return;
    }
    
    setSavedReports(data || []);
  };

  const handleGenerateReport = async () => {
    // Validation
    if (!selectedClientId) {
      toast({
        title: "Select a client first",
        description: "Please select a client before generating a report.",
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
    if (!dateRangeStart || !dateRangeEnd) {
      toast({
        title: "Missing date range",
        description: "Please select start and end dates.",
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
      
      // Parse CSVs
      const startDate = new Date(dateRangeStart);
      const endDate = new Date(dateRangeEnd);
      
      const batchRows = parseBatchCSV(batchText);
      const airtableRows = parseAirtableCSV(airtableText, startDate, endDate);
      const sovRows = sovText ? parseSOVCSV(sovText) : null;
      const geoRows = geoText ? parseGEOCSV(geoText) : [];
      
      // Prepare manual SOV data if in manual mode
      const manualSOVCompetitors = manualSOVMode && competitorInterviews.length > 0
        ? competitorInterviews.filter(c => c.count > 0)
        : null;
      
      // Find selected client
      const client = clients.find(c => c.id === selectedClientId);
      if (!client) {
        toast({
          title: "Client not found",
          description: "Selected client could not be found.",
          variant: "destructive",
        });
        return;
      }
      
      // Generate report
      const report = await generateReportFromMultipleCSVs(
        batchRows,
        airtableRows,
        sovRows,
        null, // Competitor names now come from CSV peer column or manual input
        geoRows,
        client,
        reportName || `${client.name} - ${quarter || 'Report'}`,
        quarter,
        { start: startDate, end: endDate },
        manualSOVCompetitors // Pass manual SOV data
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
    if (!reportData || !reportName || !selectedClientId) {
      toast({
        title: "Missing information",
        description: "Report name and client are required to save.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      const { error } = await supabase.from('reports').insert({
        org_id: TEAM_ORG_ID,
        client_id: selectedClientId,
        report_name: reportName,
        quarter: quarter || null,
        date_range_start: reportData.date_range?.start.split('T')[0] || new Date().toISOString().split('T')[0],
        date_range_end: reportData.date_range?.end.split('T')[0] || new Date().toISOString().split('T')[0],
        report_data: reportData as any,
      });
      
      if (error) throw error;
      
      toast({
        title: "Report saved",
        description: "Your report has been saved successfully.",
      });
      await loadSavedReports();
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

  const loadReport = (report: any) => {
    setReportData(report.report_data);
    setReportName(report.report_name);
    setQuarter(report.quarter || '');
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
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAutoScrapeRephonic = async (competitorName: string, competitorIndex: number) => {
    if (!dateRangeStart || !dateRangeEnd) {
      toast({
        title: "Date range required",
        description: "Please set the report date range first.",
        variant: "destructive",
      });
      return;
    }

    // Set scraping state
    setScrapingStates(prev => ({ ...prev, [competitorName]: true }));

    try {
      console.log('[Reports] Calling scrape-rephonic-sov for:', competitorName);
      
      const { data, error } = await supabase.functions.invoke('scrape-rephonic-sov', {
        body: {
          competitorName,
          startDate: dateRangeStart,
          endDate: dateRangeEnd
        }
      });

      if (error) {
        console.error('[Reports] Edge function error:', error);
        throw error;
      }

      console.log('[Reports] Scrape result:', data);

      if (data.success) {
        // Store scraped episodes
        setScrapedEpisodesByCompetitor(prev => ({
          ...prev,
          [competitorName]: data.episodes
        }));

        // Auto-populate interview count
        const updated = [...competitorInterviews];
        updated[competitorIndex].count = data.episode_count;
        setCompetitorInterviews(updated);

        toast({
          title: "Scrape successful",
          description: `Found ${data.episode_count} episodes for ${competitorName}${data.is_limited ? ' (limited to 6 results)' : ''}`,
        });
      } else {
        throw new Error(data.error || 'Scraping failed');
      }
    } catch (error) {
      console.error('[Reports] Scrape error:', error);
      toast({
        title: "Scrape failed",
        description: error instanceof Error ? error.message : "Could not scrape Rephonic data",
        variant: "destructive",
      });
    } finally {
      setScrapingStates(prev => ({ ...prev, [competitorName]: false }));
    }
  };

  return (
    <div className="min-h-screen w-full">
      <BackgroundFX />
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Saved Reports Section */}
          {selectedClientId && savedReports.length > 0 && (
            <Card className="print:hidden">
              <CardHeader>
                <CardTitle>Saved Reports</CardTitle>
                <CardDescription>Previously generated reports for this client</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Quarter</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {savedReports.map(report => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.report_name}</TableCell>
                        <TableCell>{report.quarter || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(report.date_range_start).toLocaleDateString()} - {new Date(report.date_range_end).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(report.generated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => loadReport(report)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteReport(report.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
              {/* Client Selection */}
              <div>
                <Label className="mb-2 block">Select Client *</Label>
                <ClientCombobox
                  clients={clients}
                  value={selectedClientId || ''}
                  onChange={(id) => setSelectedClientId(id)}
                />
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
                {/* Batch CSV - Required */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label>Batch Results CSV *</Label>
                    <Badge variant={batchFile ? "default" : "secondary"}>
                      {batchFile ? "Uploaded" : "Required"}
                    </Badge>
                  </div>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setBatchFile(e.target.files?.[0] || null)}
                  />
                  {batchFile && (
                    <p className="text-xs text-muted-foreground mt-1">{batchFile.name}</p>
                  )}
                </div>

                {/* Airtable CSV - Required */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label>Airtable Report CSV *</Label>
                    <Badge variant={airtableFile ? "default" : "secondary"}>
                      {airtableFile ? "Uploaded" : "Required"}
                    </Badge>
                  </div>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setAirtableFile(e.target.files?.[0] || null)}
                  />
                  {airtableFile && (
                    <p className="text-xs text-muted-foreground mt-1">{airtableFile.name}</p>
                  )}
                </div>

                {/* SOV CSV - Optional */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label>Share of Voice Data</Label>
                  </div>
                  
                  {manualSOVMode && competitorInterviews.length > 0 ? (
                    <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-3">
                        Quick Search: Click to search ListenNotes for each competitor's podcast appearances, then enter interview counts below.
                      </p>
                      
                      {competitorInterviews.map((comp, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{comp.name}</p>
                              <p className="text-xs text-muted-foreground">{comp.role}</p>
                            </div>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => handleAutoScrapeRephonic(comp.name, idx)}
                              disabled={scrapingStates[comp.name]}
                            >
                              <Search className="h-4 w-4 mr-2" />
                              {scrapingStates[comp.name] ? 'Scraping...' : 'Auto-Scrape Rephonic'}
                            </Button>
                          </div>
                          <div>
                            <Label className="text-xs">Interview Count</Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={comp.count || ''}
                              onChange={(e) => {
                                const updated = [...competitorInterviews];
                                updated[idx].count = parseInt(e.target.value) || 0;
                                setCompetitorInterviews(updated);
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      
                      <div className="pt-3 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Or upload CSV instead:</p>
                        <Input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setSOVFile(file);
                            if (file) setManualSOVMode(false);
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <Badge variant={sovFile ? "default" : "outline"} className="mb-2">
                        {sovFile ? "Uploaded" : "Optional"}
                      </Badge>
                      <Input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setSOVFile(file);
                        }}
                      />
                      {sovFile && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {sovFile.name} - Competitor names will be read from the "peer" column
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* GEO CSV - Optional */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label>GEO CSV (Optional)</Label>
                    <Badge variant={geoFile ? "default" : "outline"}>
                      {geoFile ? "Uploaded" : "Optional"}
                    </Badge>
                  </div>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setGeoFile(file);
                    }}
                  />
                  {geoFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {geoFile.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Upload Spotlight GEO export - will filter for podcasts.apple.com domain entries only
                  </p>
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerateReport}
                disabled={isProcessing || !selectedClientId || !batchFile || !airtableFile || !dateRangeStart || !dateRangeEnd}
                className="w-full"
                size="lg"
              >
                <Upload className="mr-2 h-5 w-5" />
                {isProcessing ? 'Processing...' : 'Generate Report'}
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

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="Earned Media Value"
                  value={`$${reportData.kpis.total_emv?.toLocaleString() || '0'}`}
                  subtitle="Total campaign EMV • Click to view analysis"
                  icon={DollarSign}
                  onClick={() => setEmvDialogOpen(true)}
                />
                <KPICard
                  title="Share of Voice"
                  value={`${reportData.kpis.sov_percentage || reportData.sov_analysis?.client_percentage || 0}%`}
                  subtitle="Market presence • Click to view analysis"
                  icon={PieChart}
                  onClick={() => setSOVDialogOpen(true)}
                />
                <KPICard
                  title="GEO Score"
                  value={reportData.geo_analysis ? `${reportData.geo_analysis.geo_score}/100` : '0/100'}
                  subtitle={
                    reportData.geo_analysis 
                      ? `${reportData.geo_analysis.total_podcasts_indexed} podcasts • ${reportData.geo_analysis.unique_ai_engines.length} AI engines • Click for details`
                      : "Upload GEO CSV to analyze"
                  }
                  icon={Sparkles}
                  onClick={reportData.geo_analysis ? () => setGeoDialogOpen(true) : undefined}
                />
                <KPICard
                  title="Average Score"
                  value={reportData.kpis.avg_score.toFixed(1)}
                  subtitle="Overall fit rating"
                  icon={TrendingUp}
                />
                <KPICard
                  title="Total Reach"
                  value={reportData.kpis.total_reach.toLocaleString()}
                  subtitle="Listeners per episode"
                  icon={Users}
                />
                <KPICard
                  title="Total Booked"
                  value={reportData.kpis.total_booked}
                  subtitle="Confirmed bookings"
                  icon={Calendar}
                />
                <KPICard
                  title="Total Published"
                  value={reportData.kpis.total_published}
                  subtitle="Episodes live"
                  icon={Radio}
                />
                <KPICard
                  title="Social Reach"
                  value={reportData.kpis.total_social_reach.toLocaleString()}
                  subtitle="Combined social following"
                  icon={Users}
                />
              </div>

              {/* Campaign Overview */}
              <CampaignOverview
                strategy={reportData.campaign_overview.strategy}
                target_audiences={reportData.campaign_overview.target_audiences}
                talking_points={reportData.campaign_overview.talking_points}
              />

              {/* Top Categories */}
              {reportData.kpis.top_categories.length > 0 && (
                <Card>
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

              {/* Podcast Table */}
              <PodcastTable podcasts={reportData.podcasts} />
              
              {/* EMV Scatter Dialog */}
              <EMVAnalysisDialog
                open={emvDialogOpen}
                onOpenChange={setEmvDialogOpen}
                podcasts={reportData.podcasts}
              />
              
              <SOVChartDialog
                open={sovDialogOpen}
                onOpenChange={setSOVDialogOpen}
                sovAnalysis={reportData.sov_analysis || null}
                clientName={clients.find(c => c.id === selectedClientId)?.name}
              />
              
              <GEODialog
                open={geoDialogOpen}
                onOpenChange={setGeoDialogOpen}
                geoAnalysis={reportData.geo_analysis || null}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
