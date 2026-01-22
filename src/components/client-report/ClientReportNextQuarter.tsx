import { useState } from "react";
import { ReportData } from "@/types/reports";
import { Compass, Lightbulb, Target, TrendingUp } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

import { HighImpactPodcastsDialog } from "@/components/reports/HighImpactPodcastsDialog";
import { ListenershipGoalDialog } from "@/components/reports/ListenershipGoalDialog";

// Format numbers with K/M suffix
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toLocaleString();
}

interface ClientReportNextQuarterProps {
  strategy: NonNullable<ReportData["next_quarter_strategy"]>;
  reportEndDate?: string;
}

export const ClientReportNextQuarter = ({ strategy, reportEndDate }: ClientReportNextQuarterProps) => {
  const [podcastsDialogOpen, setPodcastsDialogOpen] = useState(false);
  const [listenershipDialogOpen, setListenershipDialogOpen] = useState(false);

  // The quarter field stores the intended "next quarter" label directly when manually edited.
  // For valid quarter strings (e.g., "Q1 2026"), use the value as-is.
  // For empty/invalid values (custom date ranges), use static "Next Quarter" label.
  const hasValidQuarter = strategy.quarter && /Q\d\s*\d{4}/.test(strategy.quarter);
  const nextQuarterLabel = hasValidQuarter ? strategy.quarter : "Next Quarter";

  return (
    <>
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Looking Ahead: {nextQuarterLabel}</h2>
        
        <div className="bg-card border border-border rounded-2xl p-8 space-y-8">
          {/* Intro */}
          {strategy.intro_paragraph && (
            <MarkdownRenderer content={strategy.intro_paragraph} className="text-lg text-muted-foreground leading-relaxed" />
          )}

          {/* Strategic Focus Areas */}
          {strategy.strategic_focus_areas && strategy.strategic_focus_areas.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Compass className="h-5 w-5 text-primary" />
                Strategic Focus Areas
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {strategy.strategic_focus_areas.map((area, index) => (
                  <div 
                    key={index}
                    className="bg-muted/50 rounded-xl p-4 space-y-2"
                  >
                    <h4 className="font-medium">{area.title}</h4>
                    <MarkdownRenderer content={area.description} className="text-sm text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Talking Points Spotlight */}
          {((strategy.talking_points_spotlight && strategy.talking_points_spotlight.length > 0) ||
            (strategy.speaker_talking_points_spotlight && strategy.speaker_talking_points_spotlight.length > 0)) && (
            <div className="space-y-4">
              <h3 className="text-base font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-accent" />
                Talking Points Spotlight
              </h3>
              
              {/* General Talking Points */}
              {strategy.talking_points_spotlight && strategy.talking_points_spotlight.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {strategy.talking_points_spotlight.map((point, index) => (
                    <div 
                      key={index}
                      className="bg-muted/50 rounded-lg p-3"
                    >
                      <h4 className="font-medium text-sm mb-1">{point.title}</h4>
                      <MarkdownRenderer content={point.description} className="text-xs text-muted-foreground leading-snug" />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Per-Speaker Talking Points */}
              {strategy.speaker_talking_points_spotlight && strategy.speaker_talking_points_spotlight.length > 0 && (
                <div className="space-y-4">
                  {strategy.speaker_talking_points_spotlight.map((speaker, speakerIndex) => (
                    <div key={speakerIndex} className="space-y-2">
                      <h4 className="font-medium text-sm text-primary flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {speaker.speaker_name}
                      </h4>
                      <div className="grid gap-3 md:grid-cols-2">
                        {speaker.points.map((point, pointIndex) => (
                          <div 
                            key={pointIndex}
                            className="bg-muted/50 rounded-lg p-3"
                          >
                            <h4 className="font-medium text-sm mb-1">{point.title}</h4>
                            <MarkdownRenderer content={point.description} className="text-xs text-muted-foreground leading-snug" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Next Quarter KPIs */}
          {strategy.next_quarter_kpis && (strategy.next_quarter_kpis.high_impact_podcasts_goal > 0 || strategy.next_quarter_kpis.listenership_goal > 0) && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{nextQuarterLabel} Goals</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  onClick={() => setPodcastsDialogOpen(true)}
                  className="flex items-center gap-4 bg-primary/10 rounded-xl p-5 cursor-pointer hover:bg-primary/20 transition-colors group text-left"
                >
                  <div className="p-3 bg-primary/20 rounded-full group-hover:scale-110 transition-transform">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{strategy.next_quarter_kpis.high_impact_podcasts_goal}</p>
                    <p className="text-sm text-muted-foreground">High-Impact Podcasts</p>
                  </div>
                </button>
                <button
                  onClick={() => setListenershipDialogOpen(true)}
                  className="flex items-center gap-4 bg-accent/10 rounded-xl p-5 cursor-pointer hover:bg-accent/20 transition-colors group text-left"
                >
                  <div className="p-3 bg-accent/20 rounded-full group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{formatNumber(strategy.next_quarter_kpis.listenership_goal)}</p>
                    <p className="text-sm text-muted-foreground">Listenership Goal</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Closing */}
          {strategy.closing_paragraph && (
            <div className="border-t border-border pt-6">
              <MarkdownRenderer content={strategy.closing_paragraph} className="text-muted-foreground leading-relaxed" />
            </div>
          )}
        </div>
      </section>

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
