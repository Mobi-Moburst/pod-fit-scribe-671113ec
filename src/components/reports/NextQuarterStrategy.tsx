import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, X, Pencil, Target, TrendingUp, RefreshCw, Lightbulb } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { HighImpactPodcastsDialog } from "./HighImpactPodcastsDialog";
import { ListenershipGoalDialog } from "./ListenershipGoalDialog";
import { getNextQuarter, getNextQuarterFromDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NextQuarterStrategyProps {
  quarter: string; // This is the CURRENT quarter label (e.g., "Q4 2025"), we calculate next quarter for display
  reportEndDate?: string; // ISO date string for fallback when quarter is empty/custom
  intro_paragraph: string;
  strategic_focus_areas: Array<{
    title: string;
    description: string;
  }>;
  talking_points_spotlight: Array<{
    title: string;
    description: string;
  }>;
  speaker_talking_points_spotlight?: Array<{
    speaker_name: string;
    points: Array<{
      title: string;
      description: string;
    }>;
  }>;
  closing_paragraph: string;
  next_quarter_kpis?: {
    high_impact_podcasts_goal: number;
    listenership_goal: number;
    speaker_breakdown?: Array<{
      speaker_name: string;
      goal: number;
    }>;
    current_total_reach?: number;
    current_annual_listenership?: number;
    monthly_listeners_per_episode_goal?: number;
    annual_listenership_goal?: number;
    growth_percentage?: number;
    current_listeners_per_episode?: number;
  };
  onHide?: () => void;
  onEdit?: () => void;
  onRegenerateTalkingPoints?: () => void;
  isRegenerating?: boolean;
}

// Format numbers with K/M suffix
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function NextQuarterStrategy({
  quarter,
  reportEndDate,
  intro_paragraph,
  strategic_focus_areas,
  talking_points_spotlight,
  speaker_talking_points_spotlight,
  closing_paragraph,
  next_quarter_kpis,
  onHide,
  onEdit,
  onRegenerateTalkingPoints,
  isRegenerating = false
}: NextQuarterStrategyProps) {
  const [podcastsDialogOpen, setPodcastsDialogOpen] = useState(false);
  const [listenershipDialogOpen, setListenershipDialogOpen] = useState(false);

  // Detect if quarter is already the "next" quarter (old format) or current quarter (new format)
  // Old format: intro says "As we move into Q1 2026" and quarter="Q1 2026" 
  // New format: intro says "As we move into Q1 2026" and quarter="Q4 2025"
  // Check if intro mentions moving into the stored quarter value
  const introMentionsMovingIntoQuarter = intro_paragraph?.includes(`into ${quarter}`);
  
  // Derive next quarter label - use quarter prop if valid, otherwise derive from report end date
  const hasValidQuarter = quarter && /Q\d\s*\d{4}/.test(quarter);
  const nextQuarterLabel = hasValidQuarter
    ? (introMentionsMovingIntoQuarter ? quarter : getNextQuarter(quarter))
    : (reportEndDate ? getNextQuarterFromDate(reportEndDate) : getNextQuarter(quarter));

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
          {(talking_points_spotlight.length > 0 || (speaker_talking_points_spotlight && speaker_talking_points_spotlight.length > 0)) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-accent" />
                  Talking Points to Spotlight
                </h4>
                {onRegenerateTalkingPoints && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRegenerateTalkingPoints}
                    disabled={isRegenerating}
                    className="text-xs text-muted-foreground hover:text-foreground print:hidden"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${isRegenerating ? 'animate-spin' : ''}`} />
                    {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                  </Button>
                )}
              </div>
              
              {/* General Talking Points */}
              {talking_points_spotlight.length > 0 && (
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
              )}
              
              {/* Per-Speaker Talking Points */}
              {speaker_talking_points_spotlight && speaker_talking_points_spotlight.length > 0 && (
                <div className="space-y-4">
                  {speaker_talking_points_spotlight.map((speaker, speakerIdx) => (
                    <div key={speakerIdx} className="space-y-2">
                      <h5 className="font-medium text-primary text-sm">{speaker.speaker_name}</h5>
                      <ul className="space-y-2 pl-4">
                        {speaker.points.map((point, pointIdx) => (
                          <li key={pointIdx} className="flex gap-2">
                            <span className="text-accent font-bold">•</span>
                            <div>
                              <span className="font-semibold text-foreground">{point.title}:</span>{' '}
                              <MarkdownRenderer content={point.description} className="text-muted-foreground inline" />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Closing Paragraph */}
          <div className="italic border-l-2 border-primary/30 pl-4">
            <MarkdownRenderer content={closing_paragraph} className="text-muted-foreground leading-relaxed" />
          </div>

          {/* Next Quarter KPIs */}
          {next_quarter_kpis && (next_quarter_kpis.high_impact_podcasts_goal > 0 || next_quarter_kpis.listenership_goal > 0) && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h4 className="font-semibold text-foreground">{nextQuarterLabel} Goals</h4>
              <div className="grid grid-cols-2 gap-4">
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
                <button
                  onClick={() => setListenershipDialogOpen(true)}
                  className="flex items-center gap-3 p-4 bg-accent/10 rounded-lg cursor-pointer hover:bg-accent/20 transition-colors group/card text-left"
                >
                  <div className="p-2 bg-accent/20 rounded-full group-hover/card:scale-110 transition-transform">
                    <TrendingUp className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{formatNumber(next_quarter_kpis.listenership_goal)}</p>
                    <p className="text-xs text-muted-foreground">Listenership Goal</p>
                  </div>
                </button>
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
      <ListenershipGoalDialog
        open={listenershipDialogOpen}
        onOpenChange={setListenershipDialogOpen}
        listenershipGoal={next_quarter_kpis?.listenership_goal || 0}
        currentListenership={next_quarter_kpis?.current_total_reach}
        currentAnnualListenership={next_quarter_kpis?.current_annual_listenership}
        quarter={nextQuarterLabel}
        monthlyListenersPerEpisodeGoal={next_quarter_kpis?.monthly_listeners_per_episode_goal}
        annualListenershipGoal={next_quarter_kpis?.annual_listenership_goal}
        growthPercentage={next_quarter_kpis?.growth_percentage}
        currentListenersPerEpisode={next_quarter_kpis?.current_listeners_per_episode}
      />
    </>
  );
}
