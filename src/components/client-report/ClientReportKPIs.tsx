import { ReportData } from "@/types/reports";
import { Calendar, Podcast, Users, TrendingUp, Mic, PhoneCall } from "lucide-react";

interface ClientReportKPIsProps {
  kpis: ReportData["kpis"];
  visibleSections: {
    totalBooked?: boolean;
    totalPublished?: boolean;
    totalRecorded?: boolean;
    totalIntroCalls?: boolean;
    socialReach?: boolean;
    totalReach?: boolean;
    averageScore?: boolean;
  };
  onReachClick?: () => void;
  onBookedClick?: () => void;
  onPublishedClick?: () => void;
  onRecordedClick?: () => void;
  onIntroCallsClick?: () => void;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
};

export const ClientReportKPIs = ({ kpis, visibleSections, onReachClick, onBookedClick, onPublishedClick, onRecordedClick, onIntroCallsClick }: ClientReportKPIsProps) => {
  const kpiItems = [];

  if (visibleSections.totalBooked) {
    kpiItems.push({
      key: 'totalBooked',
      label: "Podcasts Booked",
      value: kpis.total_booked,
      description: "Confirmed bookings" + (onBookedClick ? " • Click for details" : ""),
      icon: Calendar,
      color: "hsl(var(--primary))",
      onClick: onBookedClick,
    });
  }

  if (visibleSections.totalPublished) {
    kpiItems.push({
      key: 'totalPublished',
      label: "Episodes Published",
      value: kpis.total_published,
      description: "Episodes live" + (onPublishedClick ? " • Click for details" : ""),
      icon: Podcast,
      color: "hsl(var(--accent))",
      onClick: onPublishedClick,
    });
  }

  if (visibleSections.totalRecorded && (kpis.total_recorded ?? 0) > 0) {
    kpiItems.push({
      key: 'totalRecorded',
      label: "Total Recorded",
      value: kpis.total_recorded || 0,
      description: "Interviews completed",
      icon: Mic,
      color: "hsl(var(--primary))",
      onClick: undefined as (() => void) | undefined,
    });
  }

  if (visibleSections.totalIntroCalls && (kpis.total_intro_calls ?? 0) > 0) {
    kpiItems.push({
      key: 'totalIntroCalls',
      label: "Intro Calls",
      value: kpis.total_intro_calls || 0,
      description: "Introduction calls completed",
      icon: PhoneCall,
      color: "hsl(var(--primary))",
      onClick: undefined as (() => void) | undefined,
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
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
