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
import { CampaignOverviewSlide } from "@/components/client-report/slides/CampaignOverviewSlide";
import { CategoriesSlide } from "@/components/client-report/slides/CategoriesSlide";
import { NextQuarterSlide } from "@/components/client-report/slides/NextQuarterSlide";
import { TargetPodcastsSlide } from "@/components/client-report/slides/TargetPodcastsSlide";
import { ThankYouSlide } from "@/components/client-report/slides/ThankYouSlide";
import { EMVAnalysisDialog } from "@/components/reports/EMVAnalysisDialog";
import { ReachAnalysisDialog } from "@/components/reports/ReachAnalysisDialog";
import { SOVChartDialog } from "@/components/reports/SOVChartDialog";
import { GEODialog } from "@/components/reports/GEODialog";
import { ContentGapDialog } from "@/components/reports/ContentGapDialog";

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
  campaignOverview?: boolean;
  topCategories?: boolean;
  nextQuarterStrategy?: boolean;
  targetPodcasts?: boolean;
  contentGapRecommendations?: boolean;
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

      const reportData = data.report_data as unknown as ReportData & { visibleSections?: VisibleSections };
      setReportData(reportData);
      setReportName(data.report_name);
      setQuarter(data.quarter || "");
      setVisibleSections(reportData.visibleSections || {
        totalBooked: true,
        totalPublished: true,
        socialReach: true,
        totalReach: true,
        averageScore: true,
        campaignOverview: true,
        topCategories: true,
        nextQuarterStrategy: true,
        targetPodcasts: true,
      });
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
      visibleSections.geoScore || visibleSections.contentGap;
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
          />
        ),
      });
    }

    // Campaign Overview
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
      <SlideContainer>
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
        totalListenersPerEpisode={reportData?.kpis?.total_reach || 0}
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
    </div>
  );
}