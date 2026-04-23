import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DEMO_CLIENTS, applyQuarterToReportData } from "@/data/demoClients";
import { ReportData, TargetPodcast } from "@/types/reports";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { KPICard } from "@/components/reports/KPICard";
import { CampaignOverview } from "@/components/reports/CampaignOverview";
import { NextQuarterStrategy } from "@/components/reports/NextQuarterStrategy";
import { TargetPodcastsSection } from "@/components/reports/TargetPodcastsSection";
import { ContentGapRecommendations } from "@/components/reports/ContentGapRecommendations";
import { PublishedEpisodesCarousel } from "@/components/reports/PublishedEpisodesCarousel";
import { SpeakerAccordion } from "@/components/reports/SpeakerAccordion";
import ClientReportHighlights from "@/components/client-report/ClientReportHighlights";
import { EMVAnalysisDialog } from "@/components/reports/EMVAnalysisDialog";
import { ReachAnalysisDialog } from "@/components/reports/ReachAnalysisDialog";
import { SOVChartDialog } from "@/components/reports/SOVChartDialog";
import { GEODialog } from "@/components/reports/GEODialog";
import { getGEOFraming, getGEOCardSubtitle } from "@/lib/geoFraming";
import { ContentGapDialog } from "@/components/reports/ContentGapDialog";
import { SocialValueDialog } from "@/components/reports/SocialValueDialog";
import { CampaignOverviewEditDialog } from "@/components/reports/CampaignOverviewEditDialog";
import { NextQuarterEditDialog } from "@/components/reports/NextQuarterEditDialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Eye, DollarSign, PieChart, Search, Globe, Share2, 
  ChevronDown, ChevronRight, Radio, Users, TrendingUp, 
  Sparkles, Target, ExternalLink, Loader2, Play, Edit2, Video
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function DemoReport() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load demo state from sessionStorage
  const [demoState, setDemoState] = useState<{
    clientId: string;
    quarter: string;
    reportName: string;
    selectedSpeakerIds?: string[];
  } | null>(null);

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportName, setReportName] = useState<string>("");
  const [quarter, setQuarter] = useState<string>("");

  // Visibility toggles
  const [visibleSections, setVisibleSections] = useState({
    totalBooked: true,
    totalPublished: true,
    socialReach: true,
    totalReach: true,
    averageScore: true,
    emv: true,
    sov: true,
    geoScore: true,
    contentGap: true,
    socialValue: true,
    campaignOverview: true,
    topCategories: true,
    nextQuarterStrategy: true,
    targetPodcasts: true,
    contentGapRecommendations: true,
    highlights: true,
  });

  // Dialog states
  const [emvDialogOpen, setEmvDialogOpen] = useState(false);
  const [reachDialogOpen, setReachDialogOpen] = useState(false);
  const [sovDialogOpen, setSOVDialogOpen] = useState(false);
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  const [contentGapDialogOpen, setContentGapDialogOpen] = useState(false);
  const [socialValueDialogOpen, setSocialValueDialogOpen] = useState(false);
  const [campaignOverviewEditOpen, setCampaignOverviewEditOpen] = useState(false);
  const [nextQuarterEditOpen, setNextQuarterEditOpen] = useState(false);

  // Collapsible sections
  const [coreKPIsExpanded, setCoreKPIsExpanded] = useState(true);
  const [additionalMetricsExpanded, setAdditionalMetricsExpanded] = useState(true);

  // Target Podcasts generation state
  const [isGeneratingPodcasts, setIsGeneratingPodcasts] = useState(false);
  const [targetPodcasts, setTargetPodcasts] = useState<TargetPodcast[]>([]);

  // Content Gap Recommendations generation state
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [contentGapRecommendations, setContentGapRecommendations] = useState<any[]>([]);

  useEffect(() => {
    const storedState = sessionStorage.getItem("demoState");
    if (!storedState) {
      navigate("/demo");
      return;
    }

    const parsed = JSON.parse(storedState);
    setDemoState(parsed);
    setReportName(parsed.reportName);
    setQuarter(parsed.quarter);

    const client = DEMO_CLIENTS[parsed.clientId];
    if (client) {
      let processedData = applyQuarterToReportData(client.reportData, parsed.quarter);
      
      // Filter speaker breakdowns if specific speakers are selected for multi-speaker clients
      if (client.isMultiSpeaker && parsed.selectedSpeakerIds && parsed.selectedSpeakerIds.length > 0) {
        const selectedIds = new Set(parsed.selectedSpeakerIds);
        
        // Filter speaker_breakdowns to only include selected speakers
        if (processedData.speaker_breakdowns) {
          const originalBreakdowns = processedData.speaker_breakdowns;
          const filteredBreakdowns = originalBreakdowns.filter(sb => {
            // Match speaker breakdown to selected speaker by name
            const matchingSpeaker = client.speakers?.find(s => s.name === sb.speaker_name);
            return matchingSpeaker && selectedIds.has(matchingSpeaker.id);
          });
          
          // Recalculate aggregated KPIs based on filtered speakers
          if (filteredBreakdowns.length > 0) {
            const aggregatedKpis = {
              total_booked: filteredBreakdowns.reduce((sum, sb) => sum + sb.kpis.total_booked, 0),
              total_published: filteredBreakdowns.reduce((sum, sb) => sum + sb.kpis.total_published, 0),
              total_reach: filteredBreakdowns.reduce((sum, sb) => sum + sb.kpis.total_reach, 0),
              total_social_reach: filteredBreakdowns.reduce((sum, sb) => sum + sb.kpis.total_social_reach, 0),
              avg_score: filteredBreakdowns.reduce((sum, sb) => sum + sb.kpis.avg_score, 0) / filteredBreakdowns.length,
            };
            
            processedData = {
              ...processedData,
              speaker_breakdowns: filteredBreakdowns,
              kpis: {
                ...processedData.kpis,
                total_booked: aggregatedKpis.total_booked,
                total_published: aggregatedKpis.total_published,
                total_reach: aggregatedKpis.total_reach,
                total_social_reach: aggregatedKpis.total_social_reach,
                avg_score: Math.round(aggregatedKpis.avg_score * 10) / 10,
              },
            };
          }
        }
      }
      
      setReportData(processedData);
    }
  }, [navigate]);

  const toggleSection = (key: keyof typeof visibleSections) => {
    setVisibleSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerateTargetPodcasts = async () => {
    if (!demoState || !reportData) return;

    const client = DEMO_CLIENTS[demoState.clientId];
    if (!client) return;

    setIsGeneratingPodcasts(true);

    try {
      // For multi-speaker clients, use the first speaker or combined data
      const speakerData = client.isMultiSpeaker && client.speakers?.[0]
        ? {
            name: client.speakers[0].name,
            company: client.company.name,
            title: client.speakers[0].title,
            talking_points: client.speakers[0].talking_points,
            target_audiences: client.speakers[0].target_audiences,
            campaign_strategy: client.speakers[0].campaign_strategy,
          }
        : {
            name: client.speaker?.name || "",
            company: client.company.name,
            title: client.speaker?.title || "",
            talking_points: client.speaker?.talking_points || [],
            target_audiences: client.speaker?.target_audiences || [],
            campaign_strategy: client.speaker?.campaign_strategy || "",
          };

      const { data, error } = await supabase.functions.invoke("suggest-target-podcasts", {
        body: {
          client: speakerData,
          next_quarter_strategy: reportData.next_quarter_strategy,
          top_categories: reportData.kpis.top_categories,
          num_suggestions: 10,
          exclude_podcasts: reportData.podcasts?.map(p => p.show_title) || [],
        },
      });

      if (error) throw error;

      const podcasts = data.podcasts || [];
      setTargetPodcasts(podcasts);
      setReportData(prev => prev ? { ...prev, target_podcasts: podcasts } : null);

      toast({
        title: "Target Podcasts Generated",
        description: `Generated ${podcasts.length} podcast recommendations.`,
      });
    } catch (error) {
      console.error("Error generating target podcasts:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate target podcasts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPodcasts(false);
    }
  };

  const handleGenerateContentGapRecommendations = async () => {
    if (!demoState || !reportData?.content_gap_analysis) return;

    const client = DEMO_CLIENTS[demoState.clientId];
    if (!client) return;

    setIsGeneratingRecommendations(true);

    try {
      // For multi-speaker clients, use the first speaker or combined data
      const speakerData = client.isMultiSpeaker && client.speakers?.[0]
        ? {
            name: client.speakers[0].name,
            company: client.company.name,
            title: client.speakers[0].title,
            talking_points: client.speakers[0].talking_points,
            target_audiences: client.speakers[0].target_audiences,
            campaign_strategy: client.speakers[0].campaign_strategy,
          }
        : {
            name: client.speaker?.name || "",
            company: client.company.name,
            title: client.speaker?.title || "",
            talking_points: client.speaker?.talking_points || [],
            target_audiences: client.speaker?.target_audiences || [],
            campaign_strategy: client.speaker?.campaign_strategy || "",
          };

      const { data, error } = await supabase.functions.invoke("content-gap-recommendations", {
        body: {
          client: speakerData,
          gap_analysis: reportData.content_gap_analysis,
        },
      });

      if (error) throw error;

      const recommendations = data.recommendations || [];
      setContentGapRecommendations(recommendations);

      // Update report data with recommendations
      if (reportData.content_gap_analysis) {
        const updatedAnalysis = {
          ...reportData.content_gap_analysis,
          ai_recommendations: recommendations,
        };
        setReportData(prev => prev ? { ...prev, content_gap_analysis: updatedAnalysis } : null);
      }

      toast({
        title: "Recommendations Generated",
        description: `Generated ${recommendations.length} content recommendations.`,
      });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate recommendations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRecommendations(false);
    }
  };

  const handleCampaignOverviewSave = (updates: any) => {
    if (!reportData) return;
    setReportData({
      ...reportData,
      campaign_overview: {
        ...reportData.campaign_overview,
        ...updates,
      },
    });
    setCampaignOverviewEditOpen(false);
    toast({ title: "Campaign Overview Updated" });
  };

  const handleNextQuarterSave = (updates: any) => {
    if (!reportData?.next_quarter_strategy) return;
    setReportData({
      ...reportData,
      next_quarter_strategy: {
        ...reportData.next_quarter_strategy,
        ...updates,
      },
    });
    setNextQuarterEditOpen(false);
    toast({ title: "Next Quarter Strategy Updated" });
  };

  const handlePublish = () => {
    // Store the current report state for the public view
    sessionStorage.setItem("demoPublishedReport", JSON.stringify({
      reportData,
      reportName,
      quarter,
      visibleSections,
    }));
    navigate("/demo/report/public");
  };

  if (!reportData || !demoState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const client = DEMO_CLIENTS[demoState.clientId];
  const primarySpeaker = client?.isMultiSpeaker ? client.speakers?.[0] : client?.speaker;
  const aiClientForGeneration = {
    id: "demo-client",
    name: primarySpeaker?.name || reportData.client?.name || client?.company.name || "",
    company: client?.company.name || reportData.company_name || "",
    title: primarySpeaker?.title || "",
    talking_points: primarySpeaker?.talking_points || [],
    target_audiences: primarySpeaker?.target_audiences || [],
    campaign_strategy: primarySpeaker?.campaign_strategy || "",
    media_kit_url: "",
  };

  const coreKPIsVisible = visibleSections.totalBooked || visibleSections.totalPublished || 
    visibleSections.socialReach || visibleSections.totalReach || visibleSections.averageScore;
  const additionalMetricsVisible = visibleSections.emv || visibleSections.sov || 
    visibleSections.geoScore || visibleSections.contentGap || visibleSections.socialValue;

  // Calculate total EMV
  const totalEMV = reportData.podcasts?.reduce((sum, p) => sum + (p.true_emv || 0), 0) || 0;

  // Calculate social value - uses same formula as SocialValueDialog
  const PLATFORM_CPM_RATES_SV = {
    linkedin: { cpm: 60.00, allocation: 0.60 },
    meta: { cpm: 10.50, allocation: 0.20 },
    youtube: { cpm: 4.50, allocation: 0.10 },
    tiktok: { cpm: 5.50, allocation: 0.07 },
    x: { cpm: 1.50, allocation: 0.03 },
  };
  const VISIBILITY_FACTOR = 1.5;
  const PREMIUM_CONTENT_FACTOR = 1.2;
  const totalSocialValue = Object.values(PLATFORM_CPM_RATES_SV).reduce((sum, platform) => {
    const allocatedReach = (reportData.kpis.total_social_reach || 0) * platform.allocation;
    const baseValue = (allocatedReach / 1000) * platform.cpm;
    return sum + baseValue * VISIBILITY_FACTOR * PREMIUM_CONTENT_FACTOR;
  }, 0);

  return (
    <div className="min-h-screen relative">
      <BackgroundFX />
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl relative z-10 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <ReportHeader
            client={reportData.client}
            generated_at={reportData.generated_at}
            batch_name={reportName || reportData.batch_name}
          />
          <Button onClick={handlePublish} className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Publish Report
          </Button>
        </div>

        {/* Core KPIs Section */}
        <Collapsible open={coreKPIsExpanded} onOpenChange={setCoreKPIsExpanded}>
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Core KPIs
                  </CardTitle>
                  {coreKPIsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">Podcasts Booked</span>
                    <Switch checked={visibleSections.totalBooked} onCheckedChange={() => toggleSection("totalBooked")} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">Episodes Published</span>
                    <Switch checked={visibleSections.totalPublished} onCheckedChange={() => toggleSection("totalPublished")} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">Social Reach</span>
                    <Switch checked={visibleSections.socialReach} onCheckedChange={() => toggleSection("socialReach")} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">Listenership</span>
                    <Switch checked={visibleSections.totalReach} onCheckedChange={() => toggleSection("totalReach")} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">Avg Fit Score</span>
                    <Switch checked={visibleSections.averageScore} onCheckedChange={() => toggleSection("averageScore")} />
                  </div>
                </div>
                
                {coreKPIsVisible && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4">
                    {visibleSections.totalBooked && (
                      <KPICard
                        title="Podcasts Booked"
                        value={reportData.kpis.total_booked || 18}
                        icon={Radio}
                      />
                    )}
                    {visibleSections.totalPublished && (
                      <KPICard
                        title="Episodes Published"
                        value={reportData.kpis.total_published || 11}
                        icon={Radio}
                      />
                    )}
                    {visibleSections.socialReach && (
                      <KPICard
                        title="Social Reach"
                        value={`${((reportData.kpis.total_social_reach || 0) / 1000).toFixed(0)}K`}
                        icon={Users}
                      />
                    )}
                    {visibleSections.totalReach && (
                      <KPICard
                        title="Total Listenership"
                        value={`${((reportData.kpis.total_reach || 0) / 1000).toFixed(0)}K`}
                        icon={TrendingUp}
                        onClick={() => setReachDialogOpen(true)}
                      />
                    )}
                    {visibleSections.averageScore && (
                      <KPICard
                        title="Avg Fit Score"
                        value={(reportData.kpis.avg_score || 9.6).toFixed(1)}
                        icon={Target}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Additional Value Metrics Section */}
        <Collapsible open={additionalMetricsExpanded} onOpenChange={setAdditionalMetricsExpanded}>
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Additional Value Metrics
                  </CardTitle>
                  {additionalMetricsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">EMV</span>
                    <Switch checked={visibleSections.emv} onCheckedChange={() => toggleSection("emv")} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">Share of Voice</span>
                    <Switch checked={visibleSections.sov} onCheckedChange={() => toggleSection("sov")} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">GEO Score</span>
                    <Switch checked={visibleSections.geoScore} onCheckedChange={() => toggleSection("geoScore")} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">Content Gap</span>
                    <Switch checked={visibleSections.contentGap} onCheckedChange={() => toggleSection("contentGap")} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">Social Value</span>
                    <Switch checked={visibleSections.socialValue} onCheckedChange={() => toggleSection("socialValue")} />
                  </div>
                </div>
                
                {additionalMetricsVisible && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4">
                    {visibleSections.emv && (
                      <KPICard
                        title="Earned Media Value"
                        value={`$${(totalEMV / 1000).toFixed(1)}K`}
                        icon={DollarSign}
                        onClick={() => setEmvDialogOpen(true)}
                      />
                    )}
                    {visibleSections.sov && reportData.sov_analysis && (
                      <KPICard
                        title="Share of Voice"
                        value={`${reportData.sov_analysis.client_percentage}%`}
                        icon={PieChart}
                        onClick={() => setSOVDialogOpen(true)}
                      />
                    )}
                    {visibleSections.geoScore && reportData.geo_analysis && (() => {
                      const geoFraming = getGEOFraming(reportData.geo_analysis, reportData.client?.name);
                      return (
                        <KPICard
                          title="AI Visibility"
                          value={geoFraming?.tier.label ?? '—'}
                          subtitle={getGEOCardSubtitle(geoFraming)}
                          icon={Search}
                          onClick={() => setGeoDialogOpen(true)}
                        />
                      );
                    })()}
                    {visibleSections.contentGap && reportData.content_gap_analysis && (
                      <KPICard
                        title="Content Coverage"
                        value={`${reportData.content_gap_analysis.coverage_percentage}%`}
                        icon={Globe}
                        onClick={() => setContentGapDialogOpen(true)}
                      />
                    )}
                    {visibleSections.socialValue && (
                      <KPICard
                        title="Social Value"
                        value={`$${(totalSocialValue / 1000).toFixed(1)}K`}
                        icon={Share2}
                        onClick={() => setSocialValueDialogOpen(true)}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Campaign Overview */}
        {visibleSections.campaignOverview && reportData.campaign_overview && (
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 z-10"
              onClick={() => setCampaignOverviewEditOpen(true)}
            >
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <CampaignOverview
              strategy={reportData.campaign_overview.strategy}
              executive_summary={reportData.campaign_overview.executive_summary}
              target_audiences={reportData.campaign_overview.target_audiences}
              talking_points={reportData.campaign_overview.talking_points}
              pitch_hooks={reportData.campaign_overview.pitch_hooks}
              onEdit={() => setCampaignOverviewEditOpen(true)}
              onHide={() => toggleSection("campaignOverview")}
            />
          </div>
        )}

        {/* Published Episodes / Speaker Breakdowns */}
        {reportData.report_type === 'multi' && reportData.speaker_breakdowns ? (
          <SpeakerAccordion 
            speakerBreakdowns={reportData.speaker_breakdowns}
            visibleSections={visibleSections}
          />
        ) : (
          reportData.podcasts && reportData.podcasts.length > 0 && (
            <PublishedEpisodesCarousel 
              podcasts={reportData.podcasts}
              title="Published Episodes This Quarter"
              variant="list"
            />
          )
        )}

        {/* Interview Highlights */}
        {reportData.highlight_clips && reportData.highlight_clips.length > 0 && (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  Interview Highlights
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show</span>
                  <Switch 
                    checked={visibleSections.highlights} 
                    onCheckedChange={() => toggleSection("highlights")} 
                  />
                </div>
              </div>
            </CardHeader>
            {visibleSections.highlights && (
              <CardContent>
                <ClientReportHighlights
                  clips={reportData.highlight_clips}
                  companyName={reportData.company_name || reportData.client?.company}
                />
              </CardContent>
            )}
          </Card>
        )}

        {/* Top Categories */}
        {visibleSections.topCategories && reportData.kpis.top_categories?.length > 0 && (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Top Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {reportData.kpis.top_categories.map((cat, i) => (
                  <Badge key={i} variant="secondary" className="text-sm py-1 px-3">
                    {cat.name} ({cat.count})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Quarter Strategy */}
        {visibleSections.nextQuarterStrategy && reportData.next_quarter_strategy && (
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 z-10"
              onClick={() => setNextQuarterEditOpen(true)}
            >
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <NextQuarterStrategy
              quarter={reportData.next_quarter_strategy.quarter}
              reportEndDate={reportData.date_range?.end}
              intro_paragraph={reportData.next_quarter_strategy.intro_paragraph}
              strategic_focus_areas={reportData.next_quarter_strategy.strategic_focus_areas}
              talking_points_spotlight={reportData.next_quarter_strategy.talking_points_spotlight}
              speaker_talking_points_spotlight={reportData.next_quarter_strategy.speaker_talking_points_spotlight}
              closing_paragraph={reportData.next_quarter_strategy.closing_paragraph}
              next_quarter_kpis={reportData.next_quarter_strategy.next_quarter_kpis}
              onEdit={() => setNextQuarterEditOpen(true)}
              onHide={() => toggleSection("nextQuarterStrategy")}
            />
          </div>
        )}

        {/* Target Podcasts */}
        {visibleSections.targetPodcasts && (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Target Podcasts for Next Quarter
                </CardTitle>
                <Button
                  onClick={handleGenerateTargetPodcasts}
                  disabled={isGeneratingPodcasts}
                >
                  {isGeneratingPodcasts ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Podcasts
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {reportData.target_podcasts && reportData.target_podcasts.length > 0 ? (
                <TargetPodcastsSection
                  client={aiClientForGeneration}
                  nextQuarterStrategy={reportData.next_quarter_strategy!}
                  topCategories={reportData.kpis.top_categories}
                  initialPodcasts={reportData.target_podcasts}
                  onPodcastsGenerated={(podcasts) => setReportData(prev => prev ? { ...prev, target_podcasts: podcasts } : null)}
                  onHide={() => toggleSection("targetPodcasts")}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Generate Podcasts" to get AI-powered podcast recommendations</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Content Gap Recommendations */}
        {visibleSections.contentGapRecommendations && reportData.content_gap_analysis && (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Content Gap Recommendations
                </CardTitle>
                <Button
                  onClick={handleGenerateContentGapRecommendations}
                  disabled={isGeneratingRecommendations}
                >
                  {isGeneratingRecommendations ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Recommendations
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {reportData.content_gap_analysis.ai_recommendations && reportData.content_gap_analysis.ai_recommendations.length > 0 ? (
                <ContentGapRecommendations
                  gapAnalysis={reportData.content_gap_analysis}
                  client={aiClientForGeneration}
                  onUpdate={(recommendations) => {
                    const updatedAnalysis = { ...reportData.content_gap_analysis!, ai_recommendations: recommendations };
                    setReportData(prev => prev ? { ...prev, content_gap_analysis: updatedAnalysis } : null);
                  }}
                  onHide={() => toggleSection("contentGapRecommendations")}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Generate Recommendations" to get AI-powered content suggestions</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <EMVAnalysisDialog
        open={emvDialogOpen}
        onOpenChange={setEmvDialogOpen}
        podcasts={reportData.podcasts || []}
        hideCorrelationChart
      />
      <ReachAnalysisDialog
        open={reachDialogOpen}
        onOpenChange={setReachDialogOpen}
        podcasts={reportData.podcasts || []}
        totalListenersPerEpisode={reportData.kpis.total_listeners_per_episode || 36100}
        quarter={quarter}
        dateRange={reportData.date_range}
        totalReach={reportData.kpis.total_reach}
      />
      <SOVChartDialog
        open={sovDialogOpen}
        onOpenChange={setSOVDialogOpen}
        sovAnalysis={reportData.sov_analysis}
        clientName={reportData.client?.name}
      />
      <GEODialog
        open={geoDialogOpen}
        onOpenChange={setGeoDialogOpen}
        geoAnalysis={reportData.geo_analysis}
      />
      <ContentGapDialog
        open={contentGapDialogOpen}
        onOpenChange={setContentGapDialogOpen}
        gapAnalysis={reportData.content_gap_analysis}
        hasSOVPeers={(reportData.sov_analysis?.competitors?.length ?? 0) > 0}
      />
      <SocialValueDialog
        open={socialValueDialogOpen}
        onOpenChange={setSocialValueDialogOpen}
        totalSocialReach={reportData.kpis.total_social_reach || 0}
      />
      <CampaignOverviewEditDialog
        open={campaignOverviewEditOpen}
        onOpenChange={setCampaignOverviewEditOpen}
        data={reportData.campaign_overview}
        onSave={handleCampaignOverviewSave}
      />
      {reportData.next_quarter_strategy && (
        <NextQuarterEditDialog
          open={nextQuarterEditOpen}
          onOpenChange={setNextQuarterEditOpen}
          data={reportData.next_quarter_strategy}
          onSave={handleNextQuarterSave}
          speakerNames={client?.isMultiSpeaker ? (client.speakers?.map(s => s.name) ?? []) : [client?.speaker?.name || ""].filter(Boolean)}
        />
      )}
    </div>
  );
}
