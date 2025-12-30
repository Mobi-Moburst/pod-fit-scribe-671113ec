import { ReportData } from "@/types/reports";
import { DollarSign, PieChart, Globe, Target } from "lucide-react";

interface AdditionalMetricsSlideProps {
  reportData: ReportData;
  visibleSections: {
    emv?: boolean;
    sov?: boolean;
    geoScore?: boolean;
    contentGap?: boolean;
  };
  onEmvClick: () => void;
  onSovClick: () => void;
  onGeoClick: () => void;
  onContentGapClick: () => void;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export const AdditionalMetricsSlide = ({
  reportData,
  visibleSections,
  onEmvClick,
  onSovClick,
  onGeoClick,
  onContentGapClick,
}: AdditionalMetricsSlideProps) => {
  const metrics = [];

  // EMV
  if (visibleSections.emv) {
    const totalEmv = reportData.podcasts?.reduce((sum, p) => sum + (p.true_emv || 0), 0) || 0;
    if (totalEmv > 0) {
      metrics.push({
        label: "Earned Media Value",
        value: formatCurrency(totalEmv),
        subtitle: "Total campaign value",
        icon: DollarSign,
        color: "hsl(142 76% 36%)",
        onClick: onEmvClick,
      });
    }
  }

  // SOV
  if (visibleSections.sov && reportData.sov_analysis) {
    const clientShare = reportData.sov_analysis.client_percentage || 0;
    metrics.push({
      label: "Share of Voice",
      value: `${clientShare.toFixed(0)}%`,
      subtitle: "vs. competitors",
      icon: PieChart,
      color: "hsl(262 83% 58%)",
      onClick: onSovClick,
    });
  }

  // GEO Score
  if (visibleSections.geoScore && reportData.geo_analysis) {
    const geoScore = reportData.geo_analysis.geo_score || 0;
    metrics.push({
      label: "GEO Score",
      value: geoScore.toFixed(0),
      subtitle: "AI visibility score",
      icon: Globe,
      color: "hsl(199 89% 48%)",
      onClick: onGeoClick,
    });
  }

  // Content Gap
  if (visibleSections.contentGap && reportData.content_gap_analysis) {
    const coverage = reportData.content_gap_analysis.coverage_percentage || 0;
    metrics.push({
      label: "Content Coverage",
      value: `${coverage.toFixed(0)}%`,
      subtitle: "Topic coverage",
      icon: Target,
      color: "hsl(25 95% 53%)",
      onClick: onContentGapClick,
    });
  }

  if (metrics.length === 0) return null;

  return (
    <div className="w-full space-y-12 text-center">
      <h2 className="text-4xl md:text-5xl font-bold">Additional Value Metrics</h2>

      <div className={`grid gap-6 md:gap-8 ${
        metrics.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
        metrics.length === 2 ? 'grid-cols-2 max-w-2xl mx-auto' :
        metrics.length === 3 ? 'grid-cols-3 max-w-4xl mx-auto' :
        'grid-cols-2 md:grid-cols-4'
      }`}>
        {metrics.map((metric, index) => (
          <button
            key={index}
            onClick={metric.onClick}
            className="group bg-card border border-border rounded-3xl p-8 space-y-4 transition-all duration-200 hover:scale-[1.03] hover:shadow-xl cursor-pointer text-left"
          >
            <div
              className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
              style={{ backgroundColor: `${metric.color}15` }}
            >
              <metric.icon className="h-8 w-8" style={{ color: metric.color }} />
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold">{metric.value}</div>
              <div className="text-lg text-muted-foreground mt-2">{metric.label}</div>
              <div className="text-sm text-muted-foreground/70 mt-1">{metric.subtitle}</div>
            </div>
            <div className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity text-center">
              Click for details
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
