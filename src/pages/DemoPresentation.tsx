import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ReportData } from "@/types/reports";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { BackgroundFX } from "@/components/BackgroundFX";
import { SlideContainer } from "@/components/client-report/SlideContainer";
import { SlideNavigation } from "@/components/client-report/SlideNavigation";
import { TitleSlide } from "@/components/client-report/slides/TitleSlide";
import { KPIsSlide } from "@/components/client-report/slides/KPIsSlide";
import { AdditionalMetricsSlide } from "@/components/client-report/slides/AdditionalMetricsSlide";
import { CampaignOverviewSlide } from "@/components/client-report/slides/CampaignOverviewSlide";
import { CategoriesSlide } from "@/components/client-report/slides/CategoriesSlide";
import { NextQuarterSlide } from "@/components/client-report/slides/NextQuarterSlide";
import { TargetPodcastsSlide } from "@/components/client-report/slides/TargetPodcastsSlide";
import { ThankYouSlide } from "@/components/client-report/slides/ThankYouSlide";

import { SpeakerSpotlightSlide } from "@/components/client-report/slides/SpeakerSpotlightSlide";
import { EMVAnalysisDialog } from "@/components/reports/EMVAnalysisDialog";
import { ReachAnalysisDialog } from "@/components/reports/ReachAnalysisDialog";
import { SOVChartDialog } from "@/components/reports/SOVChartDialog";
import { GEODialog } from "@/components/reports/GEODialog";
import { ContentGapDialog } from "@/components/reports/ContentGapDialog";
import { SocialValueDialog } from "@/components/reports/SocialValueDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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

export default function DemoPresentation() {
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

  useEffect(() => {
    // Try to load from demoPresentationData first (from public report), then from demoPublishedReport
    const presentationData = sessionStorage.getItem("demoPresentationData");
    const publishedData = sessionStorage.getItem("demoPublishedReport");
    
    const storedData = presentationData || publishedData;
    
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

    // Speaker Spotlight Slides (for multi-speaker reports) - with their highlight clips
    if (reportData.report_type === 'multi' && reportData.speaker_breakdowns) {
      reportData.speaker_breakdowns.forEach((speaker) => {
        // Filter highlight clips for this speaker by matching speaker_name
        const speakerClips = visibleSections.highlights !== false && reportData.highlight_clips
          ? reportData.highlight_clips.filter(clip => clip.speaker_name === speaker.speaker_name)
          : [];
        
        slides.push({
          id: `speaker-${speaker.speaker_id}`,
          component: (
            <SpeakerSpotlightSlide
              speaker={speaker}
              highlightClips={speakerClips}
              visibleSections={visibleSections}
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
    navigate("/demo/report/public");
  }, [navigate]);

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

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <BackgroundFX />
      <SlideContainer scrollable={slides[currentSlide].id === 'campaign-overview' || slides[currentSlide].id === 'categories' || slides[currentSlide].id === 'target-podcasts'}>
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
        dateRange={reportData?.date_range}
        totalReach={reportData?.kpis?.total_reach || 0}
      />
      <EMVAnalysisDialog
        open={emvDialogOpen}
        onOpenChange={setEmvDialogOpen}
        podcasts={reportData?.podcasts || []}
        hideCorrelationChart
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
    </div>
  );
}
