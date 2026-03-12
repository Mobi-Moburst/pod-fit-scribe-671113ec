import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ReportData } from "@/types/reports";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, AlertCircle } from "lucide-react";
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
import { SpeakerAccordion } from "@/components/reports/SpeakerAccordion";
import { PublishedEpisodesCarousel } from "@/components/reports/PublishedEpisodesCarousel";
import { EMVAnalysisDialog } from "@/components/reports/EMVAnalysisDialog";
import { ReachAnalysisDialog } from "@/components/reports/ReachAnalysisDialog";
import { SOVChartDialog } from "@/components/reports/SOVChartDialog";
import { GEODialog } from "@/components/reports/GEODialog";
import { ContentGapDialog } from "@/components/reports/ContentGapDialog";
import { SocialValueDialog } from "@/components/reports/SocialValueDialog";

interface VisibleSections {
  totalBooked?: boolean;
  totalPublished?: boolean;
  totalRecorded?: boolean;
  totalIntroCalls?: boolean;
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

export default function PublicReport() {
  const { slug } = useParams<{ slug: string }>();
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

  // Add cache-control meta tags to prevent browser caching
  useEffect(() => {
    const metaCacheControl = document.createElement('meta');
    metaCacheControl.httpEquiv = 'Cache-Control';
    metaCacheControl.content = 'no-cache, no-store, must-revalidate';
    document.head.appendChild(metaCacheControl);

    const metaPragma = document.createElement('meta');
    metaPragma.httpEquiv = 'Pragma';
    metaPragma.content = 'no-cache';
    document.head.appendChild(metaPragma);

    const metaExpires = document.createElement('meta');
    metaExpires.httpEquiv = 'Expires';
    metaExpires.content = '0';
    document.head.appendChild(metaExpires);

    return () => {
      document.head.removeChild(metaCacheControl);
      document.head.removeChild(metaPragma);
      document.head.removeChild(metaExpires);
    };
  }, []);

  useEffect(() => {
    const fetchReport = async () => {
      if (!slug) {
        setError("Report not found");
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("reports")
        .select("*")
        .eq("public_slug", slug)
        .eq("is_published", true)
        .single();

      if (fetchError || !data) {
        setError("Report not found or no longer available");
        setIsLoading(false);
        return;
      }

      let reportData = data.report_data as unknown as ReportData & { visibleSections?: VisibleSections };
      
      // Ensure date_range is populated from database row if not in report_data
      if (!reportData.date_range && data.date_range_start && data.date_range_end) {
        reportData = {
          ...reportData,
          date_range: {
            start: data.date_range_start,
            end: data.date_range_end,
          },
        };
      }
      
      // Ensure quarter is populated from database row if not in report_data
      if (!reportData.quarter && data.quarter) {
        reportData = {
          ...reportData,
          quarter: data.quarter,
        };
      }
      
      // Auto-populate next_quarter_kpis if missing or incomplete (for older reports)
      if (reportData.next_quarter_strategy) {
        const speakerBreakdowns = reportData.speaker_breakdowns || [];
        const speakerCount = speakerBreakdowns.length || 1;
        const currentListenership = reportData.kpis?.total_reach || 0;
        const currentAnnualListenership = (reportData.kpis?.total_listeners_per_episode || 0) * 12;
        
        // Build speaker breakdown array
        const speakerBreakdownArray = speakerBreakdowns.length > 0
          ? speakerBreakdowns.map(s => ({ speaker_name: s.speaker_name, goal: 9 }))
          : [{ speaker_name: reportData.client?.name || 'Speaker', goal: 9 }];
        
        const existingKpis = reportData.next_quarter_strategy.next_quarter_kpis;
        
        // Only update if missing or if speaker_breakdown is missing or if current_annual_listenership is missing
        if (!existingKpis || !existingKpis.speaker_breakdown || existingKpis.current_annual_listenership === undefined) {
          reportData = {
            ...reportData,
            next_quarter_strategy: {
              ...reportData.next_quarter_strategy,
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
      
      setReportData(reportData);
      setReportName(data.report_name);
      setQuarter(data.quarter || "");
      
      // Build data-aware defaults for visible sections
      const dataAwareDefaults: VisibleSections = {
        totalBooked: true,
        totalPublished: true,
        socialReach: true,
        totalReach: true,
        averageScore: true,
        campaignOverview: true,
        topCategories: true,
        nextQuarterStrategy: true,
        targetPodcasts: true,
        contentGapRecommendations: true,
        highlights: !!(reportData.highlight_clips && reportData.highlight_clips.length > 0),
        // Auto-detect additional metrics based on data presence
        emv: (reportData.podcasts?.some(p => p.true_emv && p.true_emv > 0)) || false,
        sov: !!reportData.sov_analysis,
        geoScore: !!reportData.geo_analysis,
        contentGap: !!reportData.content_gap_analysis,
        socialValue: (reportData.kpis?.total_social_reach || 0) > 0,
      };
      
      setVisibleSections(reportData.visibleSections || dataAwareDefaults);
      setIsLoading(false);
    };

    fetchReport();
  }, [slug]);

  const handlePresent = () => {
    navigate(`/report/${slug}/present`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background relative">
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
      <div className="min-h-screen bg-background flex items-center justify-center relative">
        <BackgroundFX />
        <div className="text-center space-y-4">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-semibold">{error || "Report not found"}</h1>
          <p className="text-muted-foreground">
            This report may have been unpublished or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  const coreKPIsVisible = visibleSections.totalBooked || visibleSections.totalPublished || 
    visibleSections.socialReach || visibleSections.totalReach || visibleSections.averageScore;

  const additionalMetricsVisible = visibleSections.emv || visibleSections.sov || 
    visibleSections.geoScore || visibleSections.contentGap || visibleSections.socialValue;

  return (
    <div className="min-h-screen bg-background relative">
      <BackgroundFX />
      {/* Fixed Present Button */}
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

        {/* Interview Highlights */}
        {visibleSections.highlights && reportData.highlight_clips && reportData.highlight_clips.length > 0 && (
          <ClientReportHighlights
            clips={reportData.highlight_clips}
            companyName={reportData.company_name || reportData.client?.company}
          />
        )}

        {/* Published Episodes Carousel (Single-speaker reports only) */}
        {reportData.report_type !== 'multi' && 
         reportData.podcasts && 
         reportData.podcasts.length > 0 && (
          <PublishedEpisodesCarousel 
            podcasts={reportData.podcasts}
            title="Published Episodes This Quarter"
            variant="list"
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
        {visibleSections.topCategories && reportData.kpis.top_categories?.length > 0 && (
          <ClientReportCategories 
            categories={reportData.kpis.top_categories}
          />
        )}

        {/* Next Quarter Strategy */}
        {visibleSections.nextQuarterStrategy && reportData.next_quarter_strategy && (
          <ClientReportNextQuarter 
            strategy={reportData.next_quarter_strategy}
            reportEndDate={reportData.date_range?.end}
          />
        )}

        {/* Target Podcasts */}
        {visibleSections.targetPodcasts && reportData.target_podcasts && reportData.target_podcasts.length > 0 && (
          <ClientReportTargetPodcasts 
            podcasts={reportData.target_podcasts}
          />
        )}

        {/* Footer */}
        <ClientReportFooter />
      </div>

      {/* Analysis Dialogs */}
      <EMVAnalysisDialog
        open={emvDialogOpen}
        onOpenChange={setEmvDialogOpen}
        podcasts={reportData.podcasts || []}
      />
      <ReachAnalysisDialog
        open={reachDialogOpen}
        onOpenChange={setReachDialogOpen}
        podcasts={reportData.podcasts || []}
        totalListenersPerEpisode={reportData.kpis.total_listeners_per_episode || 0}
        quarter={quarter}
        dateRange={reportData.date_range}
        totalReach={reportData.kpis.total_reach}
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