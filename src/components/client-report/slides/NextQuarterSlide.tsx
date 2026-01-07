import { useState } from "react";
import { ReportData } from "@/types/reports";
import { Compass, Target, TrendingUp } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { getNextQuarter } from "@/lib/utils";
import { HighImpactPodcastsDialog } from "@/components/reports/HighImpactPodcastsDialog";
import { ListenershipGoalDialog } from "@/components/reports/ListenershipGoalDialog";

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
  const [podcastsDialogOpen, setPodcastsDialogOpen] = useState(false);
  const [listenershipDialogOpen, setListenershipDialogOpen] = useState(false);

  // Calculate the actual next quarter from the strategy's quarter
  const nextQuarterLabel = getNextQuarter(strategy.quarter);

  return (
    <>
      <div className="w-full space-y-10 max-w-4xl mx-auto text-center">
        <div className="space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">Looking Ahead</h2>
          <p className="text-2xl text-muted-foreground">{nextQuarterLabel}</p>
        </div>
        
        {strategy.intro_paragraph && (
          <MarkdownRenderer content={strategy.intro_paragraph} className="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto" />
        )}

        {/* Next Quarter KPIs */}
        {strategy.next_quarter_kpis && (strategy.next_quarter_kpis.high_impact_podcasts_goal > 0 || strategy.next_quarter_kpis.listenership_goal > 0) && (
          <div className="grid gap-6 md:grid-cols-2 max-w-2xl mx-auto pt-2">
            <button
              onClick={() => setPodcastsDialogOpen(true)}
              className="flex items-center gap-4 bg-primary/10 rounded-2xl p-6 cursor-pointer hover:bg-primary/20 transition-colors group text-left"
            >
              <div className="p-3 bg-primary/20 rounded-full group-hover:scale-110 transition-transform">
                <Target className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-4xl font-bold">{strategy.next_quarter_kpis.high_impact_podcasts_goal}</p>
                <p className="text-sm text-muted-foreground">High-Impact Podcasts</p>
              </div>
            </button>
            <button
              onClick={() => setListenershipDialogOpen(true)}
              className="flex items-center gap-4 bg-accent/10 rounded-2xl p-6 cursor-pointer hover:bg-accent/20 transition-colors group text-left"
            >
              <div className="p-3 bg-accent/20 rounded-full group-hover:scale-110 transition-transform">
                <TrendingUp className="h-7 w-7 text-accent" />
              </div>
              <div>
                <p className="text-4xl font-bold">{formatNumber(strategy.next_quarter_kpis.listenership_goal)}</p>
                <p className="text-sm text-muted-foreground">Listenership Goal</p>
              </div>
            </button>
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

      {/* Dialogs */}
      <HighImpactPodcastsDialog
        open={podcastsDialogOpen}
        onOpenChange={setPodcastsDialogOpen}
        totalGoal={strategy.next_quarter_kpis?.high_impact_podcasts_goal || 0}
        speakerBreakdown={strategy.next_quarter_kpis?.speaker_breakdown}
        quarter={nextQuarterLabel}
      />
      <ListenershipGoalDialog
        open={listenershipDialogOpen}
        onOpenChange={setListenershipDialogOpen}
        listenershipGoal={strategy.next_quarter_kpis?.listenership_goal || 0}
        currentListenership={strategy.next_quarter_kpis?.current_total_reach}
        currentAnnualListenership={strategy.next_quarter_kpis?.current_annual_listenership}
        quarter={nextQuarterLabel}
      />
    </>
  );
};
