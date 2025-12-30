import { Card } from "@/components/ui/card";
import { DollarSign, Users, Brain, Target, Sparkles } from "lucide-react";
import { ReportData } from "@/types/reports";

interface VisibleSections {
  emv?: boolean;
  sov?: boolean;
  geoScore?: boolean;
  contentGap?: boolean;
}

interface ClientReportAdditionalMetricsProps {
  reportData: ReportData;
  visibleSections: VisibleSections;
  onEmvClick: () => void;
  onSovClick: () => void;
  onGeoClick: () => void;
  onContentGapClick: () => void;
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
};

export function ClientReportAdditionalMetrics({
  reportData,
  visibleSections,
  onEmvClick,
  onSovClick,
  onGeoClick,
  onContentGapClick,
}: ClientReportAdditionalMetricsProps) {
  // Calculate total EMV from podcasts
  const totalEmv = reportData.podcasts?.reduce((sum, p) => sum + (p.true_emv || 0), 0) || 0;
  
  // Get SOV percentage
  const sovPercentage = reportData.sov_analysis?.client_percentage || 0;
  
  // Get GEO score
  const geoScore = reportData.geo_analysis?.geo_score || 0;
  
  // Get Content Gap coverage
  const contentGapCoverage = reportData.content_gap_analysis?.coverage_percentage || 0;

  const metrics = [
    {
      key: 'emv',
      visible: visibleSections.emv && totalEmv > 0,
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
      visible: visibleSections.sov && reportData.sov_analysis,
      icon: Users,
      value: `${sovPercentage.toFixed(0)}%`,
      label: "Peer Comparison",
      subtitle: "Share of voice",
      onClick: onSovClick,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      key: 'geoScore',
      visible: visibleSections.geoScore && reportData.geo_analysis,
      icon: Brain,
      value: geoScore.toFixed(0),
      label: "GEO Score",
      subtitle: "AI engine indexing",
      onClick: onGeoClick,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      key: 'contentGap',
      visible: visibleSections.contentGap && reportData.content_gap_analysis,
      icon: Target,
      value: `${contentGapCoverage.toFixed(0)}%`,
      label: "Content Gap",
      subtitle: "Topic coverage",
      onClick: onContentGapClick,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
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
        'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
      }`}>
        {visibleMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card
              key={metric.key}
              onClick={metric.onClick}
              className="p-6 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group"
            >
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${metric.bgColor}`}>
                  <Icon className={`h-6 w-6 ${metric.color}`} />
                </div>
                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  Click for details
                </span>
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
