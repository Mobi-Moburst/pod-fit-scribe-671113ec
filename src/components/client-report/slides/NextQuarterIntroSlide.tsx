import { useState } from "react";
import { ReportData } from "@/types/reports";
import { Target, TrendingUp, Sparkles } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { HighImpactPodcastsDialog } from "@/components/reports/HighImpactPodcastsDialog";
import { ListenershipGoalDialog } from "@/components/reports/ListenershipGoalDialog";

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toLocaleString();
}

interface NextQuarterIntroSlideProps {
  strategy: NonNullable<ReportData["next_quarter_strategy"]>;
}

export const NextQuarterIntroSlide = ({ strategy }: NextQuarterIntroSlideProps) => {
  const [podcastsDialogOpen, setPodcastsDialogOpen] = useState(false);
  const [listenershipDialogOpen, setListenershipDialogOpen] = useState(false);

  const hasValidQuarter = strategy.quarter && /Q\d\s*\d{4}/.test(strategy.quarter);
  const nextQuarterLabel = hasValidQuarter ? strategy.quarter : "Next Quarter";

  const hasKpis = strategy.next_quarter_kpis && 
    (strategy.next_quarter_kpis.high_impact_podcasts_goal > 0 || strategy.next_quarter_kpis.listenership_goal > 0);

  return (
    <>
      <div className="w-full space-y-8 max-w-4xl mx-auto px-4 py-6 flex flex-col items-center justify-center h-full">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Strategic Roadmap
          </div>
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Looking Ahead
          </h2>
          <p className="text-2xl md:text-3xl text-primary font-semibold">{nextQuarterLabel}</p>
        </div>

        {/* Intro */}
        {strategy.intro_paragraph && (
          <div className="bg-card/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm w-full">
            <MarkdownRenderer
              content={strategy.intro_paragraph}
              className="text-lg text-muted-foreground leading-relaxed text-center max-w-3xl mx-auto"
            />
          </div>
        )}

        {/* KPI Goals */}
        {hasKpis && (
          <div className="space-y-4 w-full">
            <h3 className="text-lg font-semibold text-center text-muted-foreground uppercase tracking-wider">
              {nextQuarterLabel} Goals
            </h3>
            <div className={`grid gap-4 ${strategy.next_quarter_kpis!.high_impact_podcasts_goal > 0 && strategy.next_quarter_kpis!.listenership_goal > 0 ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
              {strategy.next_quarter_kpis!.high_impact_podcasts_goal > 0 && (
                <button
                  onClick={() => setPodcastsDialogOpen(true)}
                  className="group relative overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-6 cursor-pointer hover:border-primary/40 transition-all duration-300 text-left"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                      <Target className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <p className="text-4xl font-bold">{strategy.next_quarter_kpis!.high_impact_podcasts_goal}</p>
                      <p className="text-sm text-muted-foreground">High-Impact Podcasts</p>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-3 text-xs text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                    Click for details →
                  </div>
                </button>
              )}
              {strategy.next_quarter_kpis!.listenership_goal > 0 && (
                <button
                  onClick={() => setListenershipDialogOpen(true)}
                  className="group relative overflow-hidden bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 rounded-2xl p-6 cursor-pointer hover:border-accent/40 transition-all duration-300 text-left"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center gap-4">
                    <div className="p-3 bg-accent/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="h-7 w-7 text-accent" />
                    </div>
                    <div>
                      <p className="text-4xl font-bold">{formatNumber(strategy.next_quarter_kpis!.listenership_goal)}</p>
                      <p className="text-sm text-muted-foreground">Listenership Goal</p>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-3 text-xs text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                    Click for details →
                  </div>
                </button>
              )}
            </div>
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
        monthlyListenersPerEpisodeGoal={strategy.next_quarter_kpis?.monthly_listeners_per_episode_goal}
        annualListenershipGoal={strategy.next_quarter_kpis?.annual_listenership_goal}
        growthPercentage={strategy.next_quarter_kpis?.growth_percentage}
        currentListenersPerEpisode={strategy.next_quarter_kpis?.current_listeners_per_episode}
      />
    </>
  );
};
