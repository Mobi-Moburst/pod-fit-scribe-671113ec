import { ReportData } from "@/types/reports";
import { Calendar, Podcast, Users, TrendingUp } from "lucide-react";

interface ClientReportKPIsProps {
  kpis: ReportData["kpis"];
  visibleSections: {
    totalBooked?: boolean;
    totalPublished?: boolean;
    socialReach?: boolean;
    totalReach?: boolean;
    averageScore?: boolean;
  };
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
};

export const ClientReportKPIs = ({ kpis, visibleSections }: ClientReportKPIsProps) => {
  const kpiItems = [];

  if (visibleSections.totalBooked) {
    kpiItems.push({
      label: "Podcasts Booked",
      value: kpis.total_booked,
      icon: Calendar,
      color: "hsl(var(--primary))",
    });
  }

  if (visibleSections.totalPublished) {
    kpiItems.push({
      label: "Episodes Published",
      value: kpis.total_published,
      icon: Podcast,
      color: "hsl(var(--accent))",
    });
  }

  if (visibleSections.totalReach) {
    kpiItems.push({
      label: "Total Reach",
      value: formatNumber(kpis.total_reach),
      icon: Users,
      color: "hsl(191 100% 62%)",
    });
  }

  if (visibleSections.averageScore) {
    kpiItems.push({
      label: "Average Fit Score",
      value: kpis.avg_score.toFixed(1),
      icon: TrendingUp,
      color: "hsl(51 100% 61%)",
    });
  }

  if (kpiItems.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Campaign Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiItems.map((kpi, index) => (
          <div 
            key={index}
            className="bg-card border border-border rounded-2xl p-6 space-y-3"
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
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};