import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, X, Pencil, Target, Users } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { HighImpactPodcastsDialog } from "./HighImpactPodcastsDialog";
import { TotalListenershipGoalDialog } from "./TotalListenershipGoalDialog";

interface NextQuarterStrategyProps {
  quarter: string; // This is already the NEXT quarter label (e.g., "Q1 2026")
  intro_paragraph: string;
  strategic_focus_areas: Array<{
    title: string;
    description: string;
  }>;
  talking_points_spotlight: Array<{
    title: string;
    description: string;
  }>;
  closing_paragraph: string;
  next_quarter_kpis?: {
    high_impact_podcasts_goal: number;
    // New fields
    total_listenership_goal?: number;
    current_total_listenership?: number;
    est_annual_listenership_goal?: number;
    current_est_annual_listenership?: number;
    // Legacy fields (for backward compat)
    listenership_goal?: number;
    current_total_reach?: number;
    speaker_breakdown?: Array<{
      speaker_name: string;
      goal: number;
    }>;
  };
  onHide?: () => void;
  onEdit?: () => void;
}

// Format numbers with K/M suffix
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function NextQuarterStrategy({
  quarter,
  intro_paragraph,
  strategic_focus_areas,
  talking_points_spotlight,
  closing_paragraph,
  next_quarter_kpis,
  onHide,
  onEdit
}: NextQuarterStrategyProps) {
  const [podcastsDialogOpen, setPodcastsDialogOpen] = useState(false);
  const [totalListenershipDialogOpen, setTotalListenershipDialogOpen] = useState(false);

  // quarter prop is already the next quarter label (e.g., "Q1 2026"), use it directly
  const nextQuarterLabel = quarter;

  // Get values, preferring new fields over legacy fields
  const totalListenershipGoal = next_quarter_kpis?.total_listenership_goal || 0;
  const currentTotalListenership = next_quarter_kpis?.current_total_listenership || 0;
  const estAnnualListenershipGoal = next_quarter_kpis?.est_annual_listenership_goal || next_quarter_kpis?.listenership_goal || 0;
  const currentEstAnnualListenership = next_quarter_kpis?.current_est_annual_listenership || next_quarter_kpis?.current_total_reach || 0;

  return (
    <>
      <Card className="relative group">
        <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden z-10">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 rounded-full bg-muted/80 text-muted-foreground hover:bg-muted"
              title="Edit this section"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {onHide && (
            <button
              onClick={onHide}
              className="p-1 rounded-full bg-muted/80 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
              title="Hide this section"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Looking Ahead: {nextQuarterLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Intro Paragraph */}
          <MarkdownRenderer content={intro_paragraph} className="text-muted-foreground leading-relaxed" />

          {/* Strategic Focus Areas */}
          {strategic_focus_areas.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Strategic Focus Areas</h4>
              <ul className="space-y-3">
                {strategic_focus_areas.map((area, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-primary font-bold">•</span>
                    <div>
                      <span className="font-semibold text-foreground">{area.title}:</span>{' '}
                      <MarkdownRenderer content={area.description} className="text-muted-foreground inline" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Talking Points to Spotlight */}
          {talking_points_spotlight.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Talking Points to Spotlight</h4>
              <ul className="space-y-3">
                {talking_points_spotlight.map((point, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-accent font-bold">•</span>
                    <div>
                      <span className="font-semibold text-foreground">{point.title}:</span>{' '}
                      <MarkdownRenderer content={point.description} className="text-muted-foreground inline" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Closing Paragraph */}
          <div className="italic border-l-2 border-primary/30 pl-4">
            <MarkdownRenderer content={closing_paragraph} className="text-muted-foreground leading-relaxed" />
          </div>

          {/* Next Quarter KPIs */}
          {next_quarter_kpis && (next_quarter_kpis.high_impact_podcasts_goal > 0 || totalListenershipGoal > 0) && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h4 className="font-semibold text-foreground">{nextQuarterLabel} Goals</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setPodcastsDialogOpen(true)}
                  className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors group/card text-left"
                >
                  <div className="p-2 bg-primary/20 rounded-full group-hover/card:scale-110 transition-transform">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{next_quarter_kpis.high_impact_podcasts_goal}</p>
                    <p className="text-xs text-muted-foreground">High-Impact Podcasts</p>
                  </div>
                </button>
                {totalListenershipGoal > 0 && (
                  <button
                    onClick={() => setTotalListenershipDialogOpen(true)}
                    className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary/70 transition-colors group/card text-left"
                  >
                    <div className="p-2 bg-secondary rounded-full group-hover/card:scale-110 transition-transform">
                      <Users className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{formatNumber(totalListenershipGoal)}</p>
                      <p className="text-xs text-muted-foreground">Total Listenership Goal</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <HighImpactPodcastsDialog
        open={podcastsDialogOpen}
        onOpenChange={setPodcastsDialogOpen}
        totalGoal={next_quarter_kpis?.high_impact_podcasts_goal || 0}
        speakerBreakdown={next_quarter_kpis?.speaker_breakdown}
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
}
