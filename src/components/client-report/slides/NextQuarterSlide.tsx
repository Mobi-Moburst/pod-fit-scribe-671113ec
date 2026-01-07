import { useState } from "react";
import { ReportData } from "@/types/reports";
import { Compass, Target, Users } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { getNextQuarter } from "@/lib/utils";
import { HighImpactPodcastsDialog } from "@/components/reports/HighImpactPodcastsDialog";
import { TotalListenershipGoalDialog } from "@/components/reports/TotalListenershipGoalDialog";

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
  const [totalListenershipDialogOpen, setTotalListenershipDialogOpen] = useState(false);

  // Calculate the actual next quarter from the strategy's quarter
  const nextQuarterLabel = getNextQuarter(strategy.quarter);

  // Get values, preferring new fields over legacy fields
  const kpis = strategy.next_quarter_kpis;
  const totalListenershipGoal = kpis?.total_listenership_goal || 0;
  const currentTotalListenership = kpis?.current_total_listenership || 0;
  const estAnnualListenershipGoal = kpis?.est_annual_listenership_goal || kpis?.listenership_goal || 0;
  const currentEstAnnualListenership = kpis?.current_est_annual_listenership || kpis?.current_total_reach || 0;
  const highImpactGoal = kpis?.high_impact_podcasts_goal || 0;

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
        {kpis && (highImpactGoal > 0 || totalListenershipGoal > 0) && (
          <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto pt-2">
            <button
              onClick={() => setPodcastsDialogOpen(true)}
              className="flex items-center gap-4 bg-primary/10 rounded-2xl p-6 cursor-pointer hover:bg-primary/20 transition-colors group text-left"
            >
              <div className="p-3 bg-primary/20 rounded-full group-hover:scale-110 transition-transform">
                <Target className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-4xl font-bold">{highImpactGoal}</p>
                <p className="text-sm text-muted-foreground">High-Impact Podcasts</p>
              </div>
            </button>
            {totalListenershipGoal > 0 && (
              <button
                onClick={() => setTotalListenershipDialogOpen(true)}
                className="flex items-center gap-4 bg-secondary/50 rounded-2xl p-6 cursor-pointer hover:bg-secondary/70 transition-colors group text-left"
              >
                <div className="p-3 bg-secondary rounded-full group-hover:scale-110 transition-transform">
                  <Users className="h-7 w-7 text-foreground" />
                </div>
                <div>
                  <p className="text-4xl font-bold">{formatNumber(totalListenershipGoal)}</p>
                  <p className="text-sm text-muted-foreground">Total Listenership Goal</p>
                </div>
              </button>
            )}
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
        totalGoal={highImpactGoal}
        speakerBreakdown={kpis?.speaker_breakdown}
        quarter={nextQuarterLabel}
      />
      <TotalListenershipGoalDialog
        open={totalListenershipDialogOpen}
        onOpenChange={setTotalListenershipDialogOpen}
        totalListenershipGoal={totalListenershipGoal}
        currentTotalListenership={currentTotalListenership}
        estAnnualListenershipGoal={estAnnualListenershipGoal}
        currentEstAnnualListenership={currentEstAnnualListenership}
        quarter={nextQuarterLabel}
      />
    </>
  );
};
