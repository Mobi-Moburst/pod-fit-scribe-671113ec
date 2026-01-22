import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ReportData } from "@/types/reports";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { BackgroundFX } from "@/components/BackgroundFX";
import { SlideContainer } from "@/components/client-report/SlideContainer";
import { SlideNavigation } from "@/components/client-report/SlideNavigation";
import { TitleSlide } from "@/components/client-report/slides/TitleSlide";
import { KPIsSlide } from "@/components/client-report/slides/KPIsSlide";
import { AdditionalMetricsSlide } from "@/components/client-report/slides/AdditionalMetricsSlide";
import { SpeakerSpotlightSlide } from "@/components/client-report/slides/SpeakerSpotlightSlide";
import { CampaignOverviewSlide } from "@/components/client-report/slides/CampaignOverviewSlide";
import { CategoriesSlide } from "@/components/client-report/slides/CategoriesSlide";
import { NextQuarterSlide } from "@/components/client-report/slides/NextQuarterSlide";
import { TargetPodcastsSlide } from "@/components/client-report/slides/TargetPodcastsSlide";
import { ThankYouSlide } from "@/components/client-report/slides/ThankYouSlide";
import HighlightsSlide from "@/components/client-report/slides/HighlightsSlide";
import { EMVAnalysisDialog } from "@/components/reports/EMVAnalysisDialog";
import { ReachAnalysisDialog } from "@/components/reports/ReachAnalysisDialog";
import { SOVChartDialog } from "@/components/reports/SOVChartDialog";
import { GEODialog } from "@/components/reports/GEODialog";
import { ContentGapDialog } from "@/components/reports/ContentGapDialog";
import { SocialValueDialog } from "@/components/reports/SocialValueDialog";
import { AirtableDialog } from "@/components/client-report/AirtableDialog";

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

interface Slide {
  id: string;
  component: React.ReactNode;
}

export default function ReportPresentation() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportName, setReportName] = useState<string>("");
  const [quarter, setQuarter] = useState<string>("");
  const [visibleSections, setVisibleSections] = useState<VisibleSections>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Dialog states
  const [reachDialogOpen, setReachDialogOpen] = useState(false);
  const [emvDialogOpen, setEmvDialogOpen] = useState(false);
  const [sovDialogOpen, setSovDialogOpen] = useState(false);
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  const [contentGapDialogOpen, setContentGapDialogOpen] = useState(false);
  const [socialValueDialogOpen, setSocialValueDialogOpen] = useState(false);
  const [airtableDialogOpen, setAirtableDialogOpen] = useState(false);
  const [selectedSpeakerAirtable, setSelectedSpeakerAirtable] = useState<{
    url: string;
    name: string;
  } | null>(null);

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

  // Build slides based on visible sections
  const slides: Slide[] = [];
  
  if (reportData) {
    // Title slide always first
    slides.push({
      id: "title",
      component: (
        <TitleSlide 
          client={reportData.client}
          reportName={reportName}
          quarter={quarter}
        />
      ),
    });

    // Campaign Overview (moved before metrics)
    if (visibleSections.campaignOverview && reportData.campaign_overview) {
      slides.push({
        id: "campaign-overview",
        component: (
          <CampaignOverviewSlide 
            campaignOverview={reportData.campaign_overview}
          />
        ),
      });
    }

    // KPIs slide
    const hasKPIs = visibleSections.totalBooked || visibleSections.totalPublished || 
      visibleSections.socialReach || visibleSections.totalReach || visibleSections.averageScore;
    if (hasKPIs) {
      slides.push({
        id: "kpis",
        component: (
          <KPIsSlide 
            kpis={reportData.kpis}
            visibleSections={visibleSections}
            onReachClick={() => setReachDialogOpen(true)}
          />
        ),
      });
    }

    // Additional Value Metrics slide
    const hasAdditionalMetrics = visibleSections.emv || visibleSections.sov || 
      visibleSections.geoScore || visibleSections.contentGap || visibleSections.socialValue;
    if (hasAdditionalMetrics) {
      slides.push({
        id: "additional-metrics",
        component: (
          <AdditionalMetricsSlide 
            reportData={reportData}
            visibleSections={visibleSections}
            onEmvClick={() => setEmvDialogOpen(true)}
            onSovClick={() => setSovDialogOpen(true)}
            onGeoClick={() => setGeoDialogOpen(true)}
            onContentGapClick={() => setContentGapDialogOpen(true)}
            onSocialValueClick={() => setSocialValueDialogOpen(true)}
          />
        ),
      });
    }

    // For multi-speaker reports: add highlights to each speaker slide
    // For single-speaker reports: keep dedicated highlights slide
    const isMultiSpeaker = reportData.report_type === 'multi' && reportData.speaker_breakdowns && reportData.speaker_breakdowns.length > 0;

    if (!isMultiSpeaker && visibleSections.highlights && reportData.highlight_clips && reportData.highlight_clips.length > 0) {
      // Single-speaker: dedicated highlights slide
      slides.push({
        id: "highlights",
        component: (
          <HighlightsSlide
            clips={reportData.highlight_clips}
            companyName={reportData.company_name || reportData.client?.company}
          />
        ),
      });
    }

    // Speaker Spotlight slides (for multi-speaker reports)
    if (isMultiSpeaker && reportData.speaker_breakdowns) {
      reportData.speaker_breakdowns.forEach((speaker) => {
        // Filter highlight clips for this specific speaker
        const speakerClips = reportData.highlight_clips?.filter(
          clip => clip.speaker_name === speaker.speaker_name
        ) || [];

        slides.push({
          id: `speaker-${speaker.speaker_id}`,
          component: (
            <SpeakerSpotlightSlide
              speaker={speaker}
              highlightClips={speakerClips}
              visibleSections={visibleSections}
              onAirtableClick={() => {
                if (speaker.airtable_embed_url) {
                  setSelectedSpeakerAirtable({
                    url: speaker.airtable_embed_url,
                    name: speaker.speaker_name,
                  });
                  setAirtableDialogOpen(true);
                }
              }}
            />
          ),
        });
      });
    }

    // Categories
    if (visibleSections.topCategories && reportData.kpis.top_categories?.length > 0) {
      slides.push({
        id: "categories",
        component: (
          <CategoriesSlide 
            categories={reportData.kpis.top_categories}
          />
        ),
      });
    }

    // Next Quarter Strategy
    if (visibleSections.nextQuarterStrategy && reportData.next_quarter_strategy) {
      slides.push({
        id: "next-quarter",
        component: (
          <NextQuarterSlide 
            strategy={reportData.next_quarter_strategy}
            reportEndDate={reportData.date_range?.end}
          />
        ),
      });
    }

    // Target Podcasts
    if (visibleSections.targetPodcasts && reportData.target_podcasts && reportData.target_podcasts.length > 0) {
      slides.push({
        id: "target-podcasts",
        component: (
          <TargetPodcastsSlide 
            podcasts={reportData.target_podcasts}
          />
        ),
      });
    }

    // Thank you slide always last
    slides.push({
      id: "thank-you",
      component: (
        <ThankYouSlide 
          client={reportData.client}
        />
      ),
    });
  }

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlide(index);
    }
  }, [slides.length]);

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  const exitPresentation = useCallback(() => {
    navigate(`/report/${slug}`);
  }, [navigate, slug]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          nextSlide();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevSlide();
          break;
        case "Escape":
          e.preventDefault();
          exitPresentation();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, exitPresentation]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Skeleton className="h-96 w-[600px]" />
      </div>
    );
  }

  if (error || !reportData || slides.length === 0) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
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

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <BackgroundFX />
      <SlideContainer scrollable={slides[currentSlide].id.startsWith('speaker-') || slides[currentSlide].id === 'campaign-overview' || slides[currentSlide].id === 'categories'}>
        {slides[currentSlide].component}
      </SlideContainer>
      
      <SlideNavigation
        currentSlide={currentSlide}
        totalSlides={slides.length}
        onPrev={prevSlide}
        onNext={nextSlide}
        onExit={exitPresentation}
      />

      {/* Analysis Dialogs */}
      <ReachAnalysisDialog
        open={reachDialogOpen}
        onOpenChange={setReachDialogOpen}
        podcasts={reportData?.podcasts || []}
        totalListenersPerEpisode={reportData?.kpis?.total_listeners_per_episode || 0}
        quarter={quarter}
      />
      <EMVAnalysisDialog
        open={emvDialogOpen}
        onOpenChange={setEmvDialogOpen}
        podcasts={reportData?.podcasts || []}
      />
      <SOVChartDialog
        open={sovDialogOpen}
        onOpenChange={setSovDialogOpen}
        sovAnalysis={reportData?.sov_analysis || null}
        clientName={reportData?.client?.name}
      />
      <GEODialog
        open={geoDialogOpen}
        onOpenChange={setGeoDialogOpen}
        geoAnalysis={reportData?.geo_analysis || null}
      />
      <ContentGapDialog
        open={contentGapDialogOpen}
        onOpenChange={setContentGapDialogOpen}
        gapAnalysis={reportData?.content_gap_analysis || null}
      />
      <SocialValueDialog
        open={socialValueDialogOpen}
        onOpenChange={setSocialValueDialogOpen}
        totalSocialReach={reportData?.kpis?.total_social_reach || 0}
        hideMethodology
      />
      {selectedSpeakerAirtable && (
        <AirtableDialog
          open={airtableDialogOpen}
          onOpenChange={setAirtableDialogOpen}
          embedUrl={selectedSpeakerAirtable.url}
          speakerName={selectedSpeakerAirtable.name}
        />
      )}
    </div>
  );
}