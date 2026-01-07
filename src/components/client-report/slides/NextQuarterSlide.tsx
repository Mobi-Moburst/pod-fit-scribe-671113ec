import { ReportData } from "@/types/reports";
import { Compass, Target, TrendingUp } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

// Format numbers with K/M suffix
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toLocaleString();
}

interface NextQuarterSlideProps {
  strategy: NonNullable<ReportData["next_quarter_strategy"]>;
}

export const NextQuarterSlide = ({ strategy }: NextQuarterSlideProps) => {
  return (
    <div className="w-full space-y-10 max-w-4xl mx-auto text-center">
      <div className="space-y-4">
        <h2 className="text-4xl md:text-5xl font-bold">Looking Ahead</h2>
        <p className="text-2xl text-muted-foreground">{strategy.quarter}</p>
      </div>
      
      {strategy.intro_paragraph && (
        <MarkdownRenderer content={strategy.intro_paragraph} className="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto" />
      )}

      {/* Next Quarter KPIs */}
      {strategy.next_quarter_kpis && (strategy.next_quarter_kpis.high_impact_podcasts_goal > 0 || strategy.next_quarter_kpis.listenership_goal > 0) && (
        <div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto pt-2">
          <div className="flex items-center gap-4 bg-primary/10 rounded-2xl p-6">
            <div className="p-3 bg-primary/20 rounded-full">
              <Target className="h-7 w-7 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-4xl font-bold">{strategy.next_quarter_kpis.high_impact_podcasts_goal}</p>
              <p className="text-sm text-muted-foreground">High-Impact Podcasts</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-accent/10 rounded-2xl p-6">
            <div className="p-3 bg-accent/20 rounded-full">
              <TrendingUp className="h-7 w-7 text-accent" />
            </div>
            <div className="text-left">
              <p className="text-4xl font-bold">{formatNumber(strategy.next_quarter_kpis.listenership_goal)}</p>
              <p className="text-sm text-muted-foreground">Listenership Goal</p>
            </div>
          </div>
        </div>
      )}

      {strategy.strategic_focus_areas && strategy.strategic_focus_areas.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 text-left pt-4">
          {strategy.strategic_focus_areas.slice(0, 4).map((area, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-xl p-6 space-y-2"
            >
              <div className="flex items-center gap-3 mb-2">
                <Compass className="h-5 w-5 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-lg">{area.title}</h3>
              </div>
              <MarkdownRenderer content={area.description} className="text-muted-foreground" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};