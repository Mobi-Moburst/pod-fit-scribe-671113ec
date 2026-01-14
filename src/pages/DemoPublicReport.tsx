import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ReportData } from "@/types/reports";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, AlertCircle, ArrowLeft } from "lucide-react";
import { BackgroundFX } from "@/components/BackgroundFX";
import { ClientReportHeader } from "@/components/client-report/ClientReportHeader";
import { ClientReportKPIs } from "@/components/client-report/ClientReportKPIs";
import { ClientReportAdditionalMetrics } from "@/components/client-report/ClientReportAdditionalMetrics";
import { ClientReportCampaignOverview } from "@/components/client-report/ClientReportCampaignOverview";
import { ClientReportCategories } from "@/components/client-report/ClientReportCategories";
import { ClientReportNextQuarter } from "@/components/client-report/ClientReportNextQuarter";
import { ClientReportTargetPodcasts } from "@/components/client-report/ClientReportTargetPodcasts";
import { ClientReportFooter } from "@/components/client-report/ClientReportFooter";
import ClientReportHighlights from "@/components/client-report/ClientReportHighlights";
import { PublishedEpisodesCarousel } from "@/components/reports/PublishedEpisodesCarousel";
import { SpeakerAccordion } from "@/components/reports/SpeakerAccordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { EMVAnalysisDialog } from "@/components/reports/EMVAnalysisDialog";
import { ReachAnalysisDialog } from "@/components/reports/ReachAnalysisDialog";
import { SOVChartDialog } from "@/components/reports/SOVChartDialog";
import { GEODialog } from "@/components/reports/GEODialog";
import { ContentGapDialog } from "@/components/reports/ContentGapDialog";
import { SocialValueDialog } from "@/components/reports/SocialValueDialog";

interface VisibleSections {
  totalBooked?: boolean;
  totalPublished?: boolean;
  socialReach?: boolean;
  totalReach?: boolean;
  averageScore?: boolean;
  emv?: boolean;
  sov?: boolean;
  geoScore?: boolean;
  contentGap?: boolean;
  socialValue?: boolean;
  campaignOverview?: boolean;
  topCategories?: boolean;
  nextQuarterStrategy?: boolean;
  targetPodcasts?: boolean;
  contentGapRecommendations?: boolean;
  highlights?: boolean;
}

export default function DemoPublicReport() {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportName, setReportName] = useState<string>("");
  const [quarter, setQuarter] = useState<string>("");
  const [visibleSections, setVisibleSections] = useState<VisibleSections>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [emvDialogOpen, setEmvDialogOpen] = useState(false);
  const [reachDialogOpen, setReachDialogOpen] = useState(false);
  const [sovDialogOpen, setSovDialogOpen] = useState(false);
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  const [contentGapDialogOpen, setContentGapDialogOpen] = useState(false);
  const [socialValueDialogOpen, setSocialValueDialogOpen] = useState(false);

  useEffect(() => {
    const storedData = sessionStorage.getItem("demoPublishedReport");
    if (!storedData) {
      setError("No demo report found");
      setIsLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(storedData);
      setReportData(parsed.reportData);
      setReportName(parsed.reportName);
      setQuarter(parsed.quarter);
      setVisibleSections(parsed.visibleSections || {
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
      setIsLoading(false);
    } catch (e) {
      setError("Failed to load demo report");
      setIsLoading(false);
    }
  }, []);

  const handlePresent = () => {
    // Store report data for presentation mode
    sessionStorage.setItem("demoPresentationData", JSON.stringify({
      reportData,
      reportName,
      quarter,
      visibleSections,
    }));
    navigate("/demo/report/present");
  };

  const handleBack = () => {
    navigate("/demo/report");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen relative">
        <BackgroundFX />
        <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
          <Skeleton className="h-16 w-48" />
          <Skeleton className="h-1 w-full" />
          <Skeleton className="h-12 w-96" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <BackgroundFX />
        <div className="text-center space-y-4">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-semibold">{error || "Report not found"}</h1>
          <p className="text-muted-foreground">
            Please generate a demo report first.
          </p>
          <Button onClick={() => navigate("/demo")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go to Demo
          </Button>
        </div>
      </div>
    );
  }

  const coreKPIsVisible = visibleSections.totalBooked || visibleSections.totalPublished || 
    visibleSections.socialReach || visibleSections.totalReach || visibleSections.averageScore;

  const additionalMetricsVisible = visibleSections.emv || visibleSections.sov || 
    visibleSections.geoScore || visibleSections.contentGap || visibleSections.socialValue;

  return (
    <div className="min-h-screen relative">
      <BackgroundFX />
      
      {/* Fixed Action Buttons */}
      <div className="fixed top-6 left-6 z-50">
        <Button 
          onClick={handleBack}
          variant="outline"
          size="lg"
          className="shadow-lg"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Editor
        </Button>
      </div>
      <div className="fixed top-6 right-6 z-50">
        <Button 
          onClick={handlePresent}
          size="lg"
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
        >
          <Play className="h-5 w-5 mr-2" />
          Present
        </Button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        {/* Header */}
        <ClientReportHeader 
          client={reportData.client}
          reportName={reportName}
          quarter={quarter}
          generatedAt={reportData.generated_at}
        />

        {/* Core KPIs */}
        {coreKPIsVisible && (
          <ClientReportKPIs 
            kpis={reportData.kpis}
            visibleSections={visibleSections}
            onReachClick={() => setReachDialogOpen(true)}
          />
        )}

        {/* Additional Value Metrics */}
        {additionalMetricsVisible && (
          <ClientReportAdditionalMetrics
            reportData={reportData}
            visibleSections={visibleSections}
            onEmvClick={() => setEmvDialogOpen(true)}
            onSovClick={() => setSovDialogOpen(true)}
            onGeoClick={() => setGeoDialogOpen(true)}
            onContentGapClick={() => setContentGapDialogOpen(true)}
            onSocialValueClick={() => setSocialValueDialogOpen(true)}
          />
        )}

        {/* Campaign Overview */}
        {visibleSections.campaignOverview && reportData.campaign_overview && (
          <ClientReportCampaignOverview 
            campaignOverview={reportData.campaign_overview}
          />
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
        {visibleSections.highlights !== false && reportData.highlight_clips && reportData.highlight_clips.length > 0 && (
          <ClientReportHighlights
            clips={reportData.highlight_clips}
            companyName={reportData.company_name || reportData.client?.company}
          />
        )}

        {/* Top Categories */}
        {visibleSections.topCategories && reportData.kpis.top_categories?.length > 0 && (
          <ClientReportCategories 
            categories={reportData.kpis.top_categories}
          />
        )}

        {/* Next Quarter Strategy */}
        {visibleSections.nextQuarterStrategy && reportData.next_quarter_strategy && (
          <ClientReportNextQuarter 
            strategy={reportData.next_quarter_strategy}
          />
        )}

        {/* Target Podcasts */}
        {visibleSections.targetPodcasts && reportData.target_podcasts && reportData.target_podcasts.length > 0 && (
          <ClientReportTargetPodcasts 
            podcasts={reportData.target_podcasts}
          />
        )}

        {/* Content Gap Recommendations */}
        {visibleSections.contentGapRecommendations && 
         reportData.content_gap_analysis?.ai_recommendations && 
         reportData.content_gap_analysis.ai_recommendations.length > 0 && (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Content Strategy Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {reportData.content_gap_analysis.ai_recommendations.map((rec, index) => (
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

        {/* Footer */}
        <ClientReportFooter />
      </div>

      {/* Analysis Dialogs */}
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
        totalListenersPerEpisode={reportData.kpis.total_listeners_per_episode || 0}
        quarter={quarter}
      />
      <SOVChartDialog
        open={sovDialogOpen}
        onOpenChange={setSovDialogOpen}
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
      />
      <SocialValueDialog
        open={socialValueDialogOpen}
        onOpenChange={setSocialValueDialogOpen}
        totalSocialReach={reportData.kpis?.total_social_reach || 0}
        hideMethodology
      />
    </div>
  );
}
