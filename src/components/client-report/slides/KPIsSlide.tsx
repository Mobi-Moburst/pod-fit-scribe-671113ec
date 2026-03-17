import { ReportData } from "@/types/reports";
import { Calendar, Podcast, Users, TrendingUp, Mic, PhoneCall } from "lucide-react";

interface KPIsSlideProps {
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
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
};

export const KPIsSlide = ({ kpis, visibleSections, onReachClick }: KPIsSlideProps) => {
  const kpiItems: Array<{
    label: string;
    description: string;
    value: string | number;
    icon: typeof Calendar;
    color: string;
    onClick?: () => void;
  }> = [];

  if (visibleSections.totalBooked) {
    kpiItems.push({
      label: "Podcasts Booked",
      description: "Confirmed bookings",
      value: kpis.total_booked,
      icon: Calendar,
      color: "hsl(var(--primary))",
    });
  }

  if (visibleSections.totalPublished) {
    kpiItems.push({
      label: "Episodes Published",
      description: "Episodes live",
      value: kpis.total_published,
      icon: Podcast,
      color: "hsl(var(--accent))",
    });
  }

  if (visibleSections.totalRecorded && (kpis.total_recorded ?? 0) > 0) {
    kpiItems.push({
      label: "Total Recorded",
      description: "Interviews completed",
      value: kpis.total_recorded || 0,
      icon: Mic,
      color: "hsl(var(--primary))",
    });
  }

  if (visibleSections.totalIntroCalls && (kpis.total_intro_calls ?? 0) > 0) {
    kpiItems.push({
      label: "Intro Calls",
      description: "Introduction calls completed",
      value: kpis.total_intro_calls || 0,
      icon: PhoneCall,
      color: "hsl(var(--primary))",
    });
  }

  if (visibleSections.socialReach) {
    kpiItems.push({
      label: "Social Reach",
      description: "Combined social following",
      value: formatNumber(kpis.total_social_reach || 0),
      icon: Users,
      color: "hsl(280 70% 60%)",
    });
  }

  if (visibleSections.totalReach) {
    kpiItems.push({
      label: "Total Listenership",
      description: "Total monthly listeners",
      value: formatNumber(kpis.total_reach),
      icon: Users,
      color: "hsl(var(--primary))",
      onClick: onReachClick,
    });
  }

  if (visibleSections.averageScore) {
    kpiItems.push({
      label: "Average Fit Score",
      description: "Podcast alignment score",
      value: kpis.avg_score.toFixed(1),
      icon: TrendingUp,
      color: "hsl(var(--gold))",
    });
  }

  return (
    <div className="w-full space-y-12 text-center">
      <h2 className="text-4xl md:text-5xl font-bold">Campaign Performance</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
        {kpiItems.map((kpi, index) => {
          const isClickable = !!kpi.onClick;
          const CardComponent = isClickable ? 'button' : 'div';
          
          return (
            <CardComponent
              key={index}
              onClick={kpi.onClick}
              className={`group bg-card border border-border rounded-3xl p-8 space-y-4 transition-all duration-200 ${
                isClickable ? 'cursor-pointer hover:scale-[1.03] hover:shadow-xl' : ''
              }`}
            >
              <div 
                className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center transition-transform duration-200 ${
                  isClickable ? 'group-hover:scale-110' : ''
                }`}
                style={{ backgroundColor: `${kpi.color}15` }}
              >
                <kpi.icon className="h-8 w-8" style={{ color: kpi.color }} />
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold">{kpi.value}</div>
                <div className="text-lg text-muted-foreground mt-2">{kpi.label}</div>
                <div className="text-sm text-muted-foreground/70 mt-1">{kpi.description}</div>
              </div>
              {isClickable && (
                <div className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Click for details
                </div>
              )}
            </CardComponent>
          );
        })}
      </div>
    </div>
  );
};
