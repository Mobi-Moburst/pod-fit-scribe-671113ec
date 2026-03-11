import { Card } from "@/components/ui/card";
import { DollarSign, Users, Brain, Target, Sparkles, Share2, TrendingUp } from "lucide-react";
import { ReportData } from "@/types/reports";

interface VisibleSections {
  emv?: boolean;
  sov?: boolean;
  geoScore?: boolean;
  contentGap?: boolean;
  socialValue?: boolean;
}

interface ClientReportAdditionalMetricsProps {
  reportData: ReportData;
  visibleSections: VisibleSections;
  onEmvClick: () => void;
  onSovClick: () => void;
  onGeoClick: () => void;
  onContentGapClick: () => void;
  onSocialValueClick: () => void;
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
};

// Platform data for social value calculation (allocation and CPM rates)
const PLATFORM_DATA = {
  linkedin: { cpm: 60.00, allocation: 0.60 },
  meta: { cpm: 10.50, allocation: 0.20 },
  youtube: { cpm: 4.50, allocation: 0.10 },
  tiktok: { cpm: 5.50, allocation: 0.07 },
  x: { cpm: 1.50, allocation: 0.03 },
};

const VISIBILITY_FACTOR = 1.5;
const PREMIUM_CONTENT_FACTOR = 1.2;

const calculateTotalSocialValue = (totalSocialReach: number): number => {
  return Object.values(PLATFORM_DATA).reduce((sum, platform) => {
    const allocatedReach = totalSocialReach * platform.allocation;
    const baseValue = (allocatedReach / 1000) * platform.cpm;
    return sum + baseValue * VISIBILITY_FACTOR * PREMIUM_CONTENT_FACTOR;
  }, 0);
};

export function ClientReportAdditionalMetrics({
  reportData,
  visibleSections,
  onEmvClick,
  onSovClick,
  onGeoClick,
  onContentGapClick,
  onSocialValueClick,
}: ClientReportAdditionalMetricsProps) {
  // Calculate total EMV from podcasts
  const totalEmv = reportData.kpis?.total_emv || reportData.podcasts?.reduce((sum, p) => sum + (p.true_emv || 0), 0) || 0;
  
  // Get SOV percentage
  const sovPercentage = reportData.sov_analysis?.client_percentage || 0;
  
  // Get GEO score
  const geoScore = reportData.geo_analysis?.geo_score || 0;
  
  // Get Content Gap coverage
  const contentGapCoverage = reportData.content_gap_analysis?.coverage_percentage || 0;
  
  // Calculate Social Value
  const totalSocialReach = reportData.kpis?.total_social_reach || 0;
  const totalSocialValue = calculateTotalSocialValue(totalSocialReach);

  // Total Campaign Value (EMV + Social Value)
  const totalCampaignValue = totalEmv + totalSocialValue;
  const showCampaignValue = visibleSections.emv && visibleSections.socialValue && totalEmv > 0 && totalSocialReach > 0;

  const metrics = [
    // Total Campaign Value rollup card
    {
      key: 'campaignValue',
      visible: showCampaignValue,
      icon: TrendingUp,
      value: formatCurrency(totalCampaignValue),
      label: "Total Campaign Value",
      subtitle: "EMV + Social Value combined",
      onClick: onEmvClick,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      key: 'emv',
      visible: visibleSections.emv !== false,
      icon: DollarSign,
      value: formatCurrency(totalEmv),
      label: "Earned Media Value",
      subtitle: "Total campaign EMV",
      onClick: onEmvClick,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      key: 'sov',
      visible: visibleSections.sov !== false,
      icon: Users,
      value: `${sovPercentage.toFixed(0)}%`,
      label: "Peer Comparison",
      subtitle: "Share of voice",
      onClick: reportData.sov_analysis ? onSovClick : undefined,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      key: 'geoScore',
      visible: visibleSections.geoScore !== false,
      icon: Brain,
      value: reportData.geo_analysis ? `${geoScore.toFixed(0)}/100` : '0/100',
      label: "GEO Score",
      subtitle: reportData.geo_analysis
        ? `${reportData.geo_analysis.total_podcasts_indexed} podcasts • ${reportData.geo_analysis.unique_ai_engines.length} AI engines`
        : "AI engine indexing",
      onClick: reportData.geo_analysis ? onGeoClick : undefined,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      key: 'contentGap',
      visible: visibleSections.contentGap !== false,
      icon: Target,
      value: reportData.content_gap_analysis ? `${contentGapCoverage.toFixed(0)}%` : '—',
      label: "Content Gap",
      subtitle: reportData.content_gap_analysis
        ? `${reportData.content_gap_analysis.total_gaps} gaps • ${reportData.content_gap_analysis.total_prompts} prompts`
        : "Topic coverage",
      onClick: reportData.content_gap_analysis ? onContentGapClick : undefined,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      key: 'socialValue',
      visible: visibleSections.socialValue !== false && totalSocialReach > 0,
      icon: Share2,
      value: formatCurrency(totalSocialValue),
      label: "Social Value",
      subtitle: "Equivalent ad spend",
      onClick: onSocialValueClick,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
  ];

  const visibleMetrics = metrics.filter(m => m.visible);

  if (visibleMetrics.length === 0) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-semibold">Additional Value Metrics</h2>
      </div>

      <div className={`grid gap-6 ${
        visibleMetrics.length === 1 ? 'grid-cols-1' :
        visibleMetrics.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
        visibleMetrics.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        {visibleMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card
              key={metric.key}
              onClick={metric.onClick}
              className={`p-6 transition-all duration-200 hover:shadow-lg group ${metric.onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${metric.bgColor}`}>
                  <Icon className={`h-6 w-6 ${metric.color}`} />
                </div>
                {metric.onClick && (
                  <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    Click for details
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold">{metric.value}</p>
                <p className="text-sm font-medium text-foreground mt-1">{metric.label}</p>
                <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
