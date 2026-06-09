import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DEMO_CLIENTS, applyQuarterToReportData } from "@/data/demoClients";
import { ReportData } from "@/types/reports";
import { ReportHeader } from "@/components/reports/ReportHeader";
import { KPICard } from "@/components/reports/KPICard";
import { CampaignOverview } from "@/components/reports/CampaignOverview";
import { NextQuarterStrategy } from "@/components/reports/NextQuarterStrategy";
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
import {
  DollarSign, PieChart, Search, Globe, Share2,
  ChevronDown, ChevronRight, Radio, Users, TrendingUp,
  Sparkles, Loader2, Video
} from "lucide-react";

// Visibility profile passed to public/presentation views. Avg Fit Score and
// Target Podcasts are intentionally hidden from prospect-facing demos.
const DEMO_VISIBLE_SECTIONS = {
  totalBooked: true,
  totalPublished: true,
  socialReach: true,
  totalReach: true,
  averageScore: false,
  emv: true,
  sov: true,
  geoScore: true,
  contentGap: true,
  socialValue: true,
  campaignOverview: true,
  topCategories: true,
  nextQuarterStrategy: true,
  targetPodcasts: false,
  contentGapRecommendations: true,
  highlights: true,
};

export default function DemoReport() {
  const navigate = useNavigate();

  const [demoState, setDemoState] = useState<{
    clientId: string;
    quarter: string;
    reportName: string;
    selectedSpeakerIds?: string[];
  } | null>(null);

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportName, setReportName] = useState<string>("");
  const [quarter, setQuarter] = useState<string>("");

  // Dialog states
  const [emvDialogOpen, setEmvDialogOpen] = useState(false);
  const [reachDialogOpen, setReachDialogOpen] = useState(false);
  const [sovDialogOpen, setSOVDialogOpen] = useState(false);
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  const [contentGapDialogOpen, setContentGapDialogOpen] = useState(false);
  const [socialValueDialogOpen, setSocialValueDialogOpen] = useState(false);

  // Collapsible sections
  const [coreKPIsExpanded, setCoreKPIsExpanded] = useState(true);
  const [additionalMetricsExpanded, setAdditionalMetricsExpanded] = useState(true);

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

      if (client.isMultiSpeaker && parsed.selectedSpeakerIds && parsed.selectedSpeakerIds.length > 0) {
        const selectedIds = new Set(parsed.selectedSpeakerIds);

        if (processedData.speaker_breakdowns) {
          const originalBreakdowns = processedData.speaker_breakdowns;
          const filteredBreakdowns = originalBreakdowns.filter(sb => {
            const matchingSpeaker = client.speakers?.find(s => s.name === sb.speaker_name);
            return matchingSpeaker && selectedIds.has(matchingSpeaker.id);
          });

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

  const handlePublish = () => {
    sessionStorage.setItem("demoPublishedReport", JSON.stringify({
      reportData,
      reportName,
      quarter,
      visibleSections: DEMO_VISIBLE_SECTIONS,
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

  const aiRecommendations = reportData.content_gap_analysis?.ai_recommendations ?? [];

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
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KPICard
                    title="Podcasts Booked"
                    value={reportData.kpis.total_booked || 18}
                    icon={Radio}
                  />
                  <KPICard
                    title="Episodes Published"
                    value={reportData.kpis.total_published || 11}
                    icon={Radio}
                  />
                  <KPICard
                    title="Social Reach"
                    value={`${((reportData.kpis.total_social_reach || 0) / 1000).toFixed(0)}K`}
                    icon={Users}
                  />
                  <KPICard
                    title="Total Listenership"
                    value={`${((reportData.kpis.total_reach || 0) / 1000).toFixed(0)}K`}
                    icon={TrendingUp}
                    onClick={() => setReachDialogOpen(true)}
                  />
                </div>
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
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <KPICard
                    title="Earned Media Value"
                    value={`$${(totalEMV / 1000).toFixed(1)}K`}
                    icon={DollarSign}
                    onClick={() => setEmvDialogOpen(true)}
                  />
                  {reportData.sov_analysis && (
                    <KPICard
                      title="Share of Voice"
                      value={`${reportData.sov_analysis.client_percentage}%`}
                      icon={PieChart}
                      onClick={() => setSOVDialogOpen(true)}
                    />
                  )}
                  {reportData.geo_analysis && (() => {
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
                  {reportData.content_gap_analysis && (
                    <KPICard
                      title="Content Coverage"
                      value={`${reportData.content_gap_analysis.coverage_percentage}%`}
                      icon={Globe}
                      onClick={() => setContentGapDialogOpen(true)}
                    />
                  )}
                  <KPICard
                    title="Social Value"
                    value={`$${(totalSocialValue / 1000).toFixed(1)}K`}
                    icon={Share2}
                    onClick={() => setSocialValueDialogOpen(true)}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Campaign Overview */}
        {reportData.campaign_overview && (
          <CampaignOverview
            strategy={reportData.campaign_overview.strategy}
            executive_summary={reportData.campaign_overview.executive_summary}
            target_audiences={reportData.campaign_overview.target_audiences}
            talking_points={reportData.campaign_overview.talking_points}
            pitch_hooks={reportData.campaign_overview.pitch_hooks}
          />
        )}

        {/* Published Episodes / Speaker Breakdowns */}
        {reportData.report_type === 'multi' && reportData.speaker_breakdowns ? (
          <SpeakerAccordion
            speakerBreakdowns={reportData.speaker_breakdowns}
            visibleSections={DEMO_VISIBLE_SECTIONS}
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
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Interview Highlights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ClientReportHighlights
                clips={reportData.highlight_clips}
                companyName={reportData.company_name || reportData.client?.company}
              />
            </CardContent>
          </Card>
        )}

        {/* Top Categories */}
        {reportData.kpis.top_categories && reportData.kpis.top_categories.length > 0 && (
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
        {reportData.next_quarter_strategy && (
          <NextQuarterStrategy
            quarter={reportData.next_quarter_strategy.quarter}
            reportEndDate={reportData.date_range?.end}
            intro_paragraph={reportData.next_quarter_strategy.intro_paragraph}
            strategic_focus_areas={reportData.next_quarter_strategy.strategic_focus_areas}
            talking_points_spotlight={reportData.next_quarter_strategy.talking_points_spotlight}
            speaker_talking_points_spotlight={reportData.next_quarter_strategy.speaker_talking_points_spotlight}
            closing_paragraph={reportData.next_quarter_strategy.closing_paragraph}
            next_quarter_kpis={reportData.next_quarter_strategy.next_quarter_kpis}
          />
        )}

        {/* Content Gap Recommendations (read-only, pre-populated) */}
        {aiRecommendations.length > 0 && (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Content Strategy Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiRecommendations.map((rec, index) => (
                <div key={index} className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="font-medium">{rec.title}</h4>
                    <Badge
                      variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                      className="shrink-0"
                    >
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.description}</p>
                  {rec.related_topics && rec.related_topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {rec.related_topics.map((topic, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
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
        socialReach={(reportData.kpis as any).social_reach || 0}
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
    </div>
  );
}
