import { useState } from "react";
import { ReportData } from "@/types/reports";
import { Compass, Lightbulb, Target, TrendingUp } from "lucide-react";
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

interface ClientReportNextQuarterProps {
  strategy: NonNullable<ReportData["next_quarter_strategy"]>;
}

export const ClientReportNextQuarter = ({ strategy }: ClientReportNextQuarterProps) => {
  const [podcastsDialogOpen, setPodcastsDialogOpen] = useState(false);
  const [listenershipDialogOpen, setListenershipDialogOpen] = useState(false);

  // Calculate the actual next quarter from the strategy's quarter (which is the current report quarter)
  const nextQuarterLabel = getNextQuarter(strategy.quarter);

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
          {strategy.talking_points_spotlight && strategy.talking_points_spotlight.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-accent" />
                Talking Points Spotlight
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {strategy.talking_points_spotlight.map((point, index) => (
                  <div 
                    key={index}
                    className="bg-muted/50 rounded-xl p-4 space-y-2"
                  >
                    <h4 className="font-medium">{point.title}</h4>
                    <MarkdownRenderer content={point.description} className="text-sm text-muted-foreground" />
                  </div>
                ))}
              </div>
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
                    <p className="text-sm text-muted-foreground">Est. Annual Listenership</p>
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
        quarter={nextQuarterLabel}
      />
    </>
  );
};
