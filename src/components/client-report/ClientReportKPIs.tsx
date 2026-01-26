import { ReportData } from "@/types/reports";
import { Calendar, Podcast, Users, TrendingUp } from "lucide-react";
import { differenceInMonths, parseISO } from "date-fns";

interface ClientReportKPIsProps {
  kpis: ReportData["kpis"];
  visibleSections: {
    totalBooked?: boolean;
    totalPublished?: boolean;
    socialReach?: boolean;
    totalReach?: boolean;
    averageScore?: boolean;
  };
  onReachClick?: () => void;
  dateRange?: {
    start: string;
    end: string;
  };
  quarter?: string;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
};

// Calculate months in reporting period
const calculatePeriodMonths = (dateRange?: { start: string; end: string }, quarter?: string): number => {
  // If it's a quarter-based report, always return 3
  if (quarter && /^Q\d\s*\d{4}$/.test(quarter)) {
    return 3;
  }
  
  // For custom date ranges, calculate actual months
  if (dateRange?.start && dateRange?.end) {
    const startDate = parseISO(dateRange.start);
    const endDate = parseISO(dateRange.end);
    // Add 1 because differenceInMonths doesn't include partial months
    const months = differenceInMonths(endDate, startDate) + 1;
    return Math.max(1, months); // Minimum 1 month
  }
  
  // Default to 3 months (quarterly)
  return 3;
};

export const ClientReportKPIs = ({ kpis, visibleSections, onReachClick, dateRange, quarter }: ClientReportKPIsProps) => {
  const periodMonths = calculatePeriodMonths(dateRange, quarter);
  const periodReach = kpis.total_reach * periodMonths;
  
  const kpiItems = [];

  if (visibleSections.totalBooked) {
    kpiItems.push({
      key: 'totalBooked',
      label: "Podcasts Booked",
      value: kpis.total_booked,
      description: "Confirmed bookings",
      icon: Calendar,
      color: "hsl(var(--primary))",
      onClick: undefined as (() => void) | undefined,
      subMetric: undefined as { value: string; label: string } | undefined,
    });
  }

  if (visibleSections.totalPublished) {
    kpiItems.push({
      key: 'totalPublished',
      label: "Episodes Published",
      value: kpis.total_published,
      description: "Episodes live",
      icon: Podcast,
      color: "hsl(var(--accent))",
      onClick: undefined as (() => void) | undefined,
      subMetric: undefined as { value: string; label: string } | undefined,
    });
  }
  if (visibleSections.socialReach) {
    kpiItems.push({
      key: 'socialReach',
      label: "Social Reach",
      value: formatNumber(kpis.total_social_reach || 0),
      description: "Combined social following",
      icon: Users,
      color: "hsl(280 70% 60%)",
      onClick: undefined as (() => void) | undefined,
      subMetric: undefined as { value: string; label: string } | undefined,
    });
  }

  if (visibleSections.totalReach) {
    kpiItems.push({
      key: 'totalReach',
      label: "Total Listenership",
      value: formatNumber(kpis.total_reach),
      description: "Total monthly listeners" + (onReachClick ? " • Click for details" : ""),
      icon: Users,
      color: "hsl(191 100% 62%)",
      onClick: onReachClick,
      subMetric: {
        value: formatNumber(periodReach),
        label: `${periodMonths}-month period reach`,
      },
    });
  }

  if (visibleSections.averageScore) {
    kpiItems.push({
      key: 'averageScore',
      label: "Average Fit Score",
      value: kpis.avg_score.toFixed(1),
      description: "Podcast alignment score",
      icon: TrendingUp,
      color: "hsl(51 100% 61%)",
      onClick: undefined as (() => void) | undefined,
      subMetric: undefined as { value: string; label: string } | undefined,
    });
  }

  if (kpiItems.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Campaign Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiItems.map((kpi) => {
          const isClickable = !!kpi.onClick;
          return (
            <div 
              key={kpi.key}
              onClick={kpi.onClick}
              className={`bg-card border border-border rounded-2xl p-6 space-y-3 transition-all duration-200 ${
                isClickable 
                  ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg group' 
                  : ''
              }`}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${kpi.color}15` }}
              >
                <kpi.icon className="h-6 w-6" style={{ color: kpi.color }} />
              </div>
              <div>
                <div className="text-3xl font-bold">{kpi.value}</div>
                <div className="text-sm text-muted-foreground">{kpi.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{kpi.description}</div>
                {kpi.subMetric && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="text-lg font-semibold text-primary">{kpi.subMetric.value}</div>
                    <div className="text-xs text-muted-foreground">{kpi.subMetric.label}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
