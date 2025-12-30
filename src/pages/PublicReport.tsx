import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ReportData } from "@/types/reports";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, AlertCircle } from "lucide-react";
import { ClientReportHeader } from "@/components/client-report/ClientReportHeader";
import { ClientReportKPIs } from "@/components/client-report/ClientReportKPIs";
import { ClientReportCampaignOverview } from "@/components/client-report/ClientReportCampaignOverview";
import { ClientReportCategories } from "@/components/client-report/ClientReportCategories";
import { ClientReportNextQuarter } from "@/components/client-report/ClientReportNextQuarter";
import { ClientReportTargetPodcasts } from "@/components/client-report/ClientReportTargetPodcasts";
import { ClientReportFooter } from "@/components/client-report/ClientReportFooter";

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

export default function PublicReport() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportName, setReportName] = useState<string>("");
  const [quarter, setQuarter] = useState<string>("");
  const [visibleSections, setVisibleSections] = useState<VisibleSections>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        emv: true,
        sov: true,
        geoScore: true,
        contentGap: true,
        campaignOverview: true,
        topCategories: true,
        nextQuarterStrategy: true,
        targetPodcasts: true,
        contentGapRecommendations: true,
      });
      setIsLoading(false);
    };

    fetchReport();
  }, [slug]);

  const handlePresent = () => {
    navigate(`/report/${slug}/present`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-background">
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
          />
        )}

        {/* Campaign Overview */}
        {visibleSections.campaignOverview && reportData.campaign_overview && (
          <ClientReportCampaignOverview 
            campaignOverview={reportData.campaign_overview}
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

        {/* Footer */}
        <ClientReportFooter />
      </div>
    </div>
  );
}