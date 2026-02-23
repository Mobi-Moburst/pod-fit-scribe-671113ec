import { useState } from "react";
import { supabase, TEAM_ORG_ID } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
  Copy,
  Save,
  Check,
  Target,
  MessageSquare,
  Compass,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import type { Speaker } from "@/types/clients";

interface StrategyInsights {
  strategy_updates: {
    new_audiences: string[];
    new_talking_points: string[];
    positioning_shifts: string[];
  };
  pitch_angles: string[];
  quarterly_summary: string;
}

interface StrategyInsightsPanelProps {
  speakerId: string;
  speaker: Speaker;
  onUpdate: () => Promise<void>;
}

export function StrategyInsightsPanel({ speakerId, speaker, onUpdate }: StrategyInsightsPanelProps) {
  const [insights, setInsights] = useState<StrategyInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["strategy", "pitches", "quarterly"]));
  const [acceptedItems, setAcceptedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    setInsights(null);
    setAcceptedItems(new Set());

    try {
      const { data, error: fnError } = await supabase.functions.invoke("analyze-call-notes-strategy", {
        body: { speaker_id: speakerId },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setInsights(data as StrategyInsights);
    } catch (err: any) {
      const msg = err?.message || "Failed to generate insights";
      setError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const markAccepted = (key: string) => {
    setAcceptedItems((prev) => new Set(prev).add(key));
  };

  const addAudience = async (audience: string) => {
    const key = `aud:${audience}`;
    if (acceptedItems.has(key)) return;

    const current = speaker.target_audiences || [];
    if (current.some((a) => a.toLowerCase() === audience.toLowerCase())) {
      toast({ title: "Already exists", description: "This audience is already in the list." });
      markAccepted(key);
      return;
    }

    const { error } = await supabase
      .from("speakers")
      .update({ target_audiences: [...current, audience] } as any)
      .eq("id", speakerId);

    if (error) {
      toast({ title: "Failed to add audience", description: error.message, variant: "destructive" });
      return;
    }

    markAccepted(key);
    toast({ title: "Audience added", description: audience });
    await onUpdate();
  };

  const addTalkingPoint = async (point: string) => {
    const key = `tp:${point}`;
    if (acceptedItems.has(key)) return;

    const current = speaker.talking_points || [];
    if (current.some((t) => t.toLowerCase() === point.toLowerCase())) {
      toast({ title: "Already exists", description: "This talking point is already in the list." });
      markAccepted(key);
      return;
    }

    const { error } = await supabase
      .from("speakers")
      .update({ talking_points: [...current, point] } as any)
      .eq("id", speakerId);

    if (error) {
      toast({ title: "Failed to add talking point", description: error.message, variant: "destructive" });
      return;
    }

    markAccepted(key);
    toast({ title: "Talking point added", description: point });
    await onUpdate();
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    markAccepted(key);
    toast({ title: "Copied to clipboard" });
  };

  const saveQuarterlyNotes = async (summary: string) => {
    const key = "quarterly";
    if (acceptedItems.has(key)) return;

    const now = new Date();
    const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;

    // Fetch current quarterly_notes
    const { data: currentSpeaker } = await supabase
      .from("speakers")
      .select("quarterly_notes")
      .eq("id", speakerId)
      .single();

    const existing = Array.isArray((currentSpeaker as any)?.quarterly_notes) ? (currentSpeaker as any).quarterly_notes : [];
    const newEntry = { quarter, notes: summary, created_at: now.toISOString() };

    const { error } = await supabase
      .from("speakers")
      .update({ quarterly_notes: [...existing, newEntry] } as any)
      .eq("id", speakerId);

    if (error) {
      toast({ title: "Failed to save quarterly notes", description: error.message, variant: "destructive" });
      return;
    }

    markAccepted(key);
    toast({ title: "Quarterly notes saved", description: `Added to ${quarter}` });
    await onUpdate();
  };

  const hasInsights =
    insights &&
    (insights.strategy_updates.new_audiences.length > 0 ||
      insights.strategy_updates.new_talking_points.length > 0 ||
      insights.strategy_updates.positioning_shifts.length > 0 ||
      insights.pitch_angles.length > 0 ||
      insights.quarterly_summary);

  return (
    <div className="space-y-3">
      {/* Generate button */}
      {!insights && !loading && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={generateInsights} disabled={loading}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Insights
          </Button>
          <span className="text-xs text-muted-foreground">Analyzes recent call notes with AI</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing call notes...
        </div>
      )}

      {error && !loading && (
        <div className="text-sm text-destructive py-2">
          {error}
          <Button variant="link" size="sm" onClick={generateInsights} className="ml-2">
            Try again
          </Button>
        </div>
      )}

      {hasInsights && (
        <div className="space-y-2">
          {/* Strategy Updates */}
          {(insights.strategy_updates.new_audiences.length > 0 ||
            insights.strategy_updates.new_talking_points.length > 0 ||
            insights.strategy_updates.positioning_shifts.length > 0) && (
            <Collapsible open={expandedSections.has("strategy")} onOpenChange={() => toggleSection("strategy")}>
              <CollapsibleTrigger className="w-full text-left flex items-center gap-2 py-2 text-sm font-medium hover:text-foreground transition-colors">
                {expandedSections.has("strategy") ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <Target className="h-3.5 w-3.5 text-primary" />
                Strategy Updates
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pl-6">
                {/* New Audiences */}
                {insights.strategy_updates.new_audiences.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Target className="h-3 w-3" /> New Audiences
                    </h5>
                    <div className="space-y-1">
                      {insights.strategy_updates.new_audiences.map((aud, i) => {
                        const key = `aud:${aud}`;
                        const accepted = acceptedItems.has(key);
                        return (
                          <Card key={i} className="p-2 flex items-center justify-between gap-2 bg-muted/20">
                            <span className="text-sm">{aud}</span>
                            <Button
                              size="sm"
                              variant={accepted ? "ghost" : "outline"}
                              onClick={() => addAudience(aud)}
                              disabled={accepted}
                              className="shrink-0"
                            >
                              {accepted ? <Check className="h-3.5 w-3.5 text-green-500" /> : <><Plus className="h-3.5 w-3.5 mr-1" />Add</>}
                            </Button>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* New Talking Points */}
                {insights.strategy_updates.new_talking_points.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> New Talking Points
                    </h5>
                    <div className="space-y-1">
                      {insights.strategy_updates.new_talking_points.map((tp, i) => {
                        const key = `tp:${tp}`;
                        const accepted = acceptedItems.has(key);
                        return (
                          <Card key={i} className="p-2 flex items-center justify-between gap-2 bg-muted/20">
                            <span className="text-sm">{tp}</span>
                            <Button
                              size="sm"
                              variant={accepted ? "ghost" : "outline"}
                              onClick={() => addTalkingPoint(tp)}
                              disabled={accepted}
                              className="shrink-0"
                            >
                              {accepted ? <Check className="h-3.5 w-3.5 text-green-500" /> : <><Plus className="h-3.5 w-3.5 mr-1" />Add</>}
                            </Button>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Positioning Shifts */}
                {insights.strategy_updates.positioning_shifts.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Compass className="h-3 w-3" /> Positioning Observations
                    </h5>
                    <div className="space-y-1">
                      {insights.strategy_updates.positioning_shifts.map((shift, i) => (
                        <Card key={i} className="p-2 bg-muted/20">
                          <span className="text-sm">{shift}</span>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Pitch Angles */}
          {insights.pitch_angles.length > 0 && (
            <Collapsible open={expandedSections.has("pitches")} onOpenChange={() => toggleSection("pitches")}>
              <CollapsibleTrigger className="w-full text-left flex items-center gap-2 py-2 text-sm font-medium hover:text-foreground transition-colors">
                {expandedSections.has("pitches") ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                Pitch Angle Ideas
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pl-6">
                {insights.pitch_angles.map((hook, i) => {
                  const key = `pitch:${i}`;
                  const accepted = acceptedItems.has(key);
                  return (
                    <Card key={i} className="p-2 flex items-center justify-between gap-2 bg-muted/20">
                      <span className="text-sm">{hook}</span>
                      <Button
                        size="sm"
                        variant={accepted ? "ghost" : "outline"}
                        onClick={() => copyToClipboard(hook, key)}
                        disabled={accepted}
                        className="shrink-0"
                      >
                        {accepted ? <Check className="h-3.5 w-3.5 text-green-500" /> : <><Copy className="h-3.5 w-3.5 mr-1" />Copy</>}
                      </Button>
                    </Card>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Quarterly Summary */}
          {insights.quarterly_summary && (
            <Collapsible open={expandedSections.has("quarterly")} onOpenChange={() => toggleSection("quarterly")}>
              <CollapsibleTrigger className="w-full text-left flex items-center gap-2 py-2 text-sm font-medium hover:text-foreground transition-colors">
                {expandedSections.has("quarterly") ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                Quarterly Summary
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-6">
                <Card className="p-3 bg-muted/20 space-y-2">
                  <p className="text-sm">{insights.quarterly_summary}</p>
                  <Button
                    size="sm"
                    variant={acceptedItems.has("quarterly") ? "ghost" : "outline"}
                    onClick={() => saveQuarterlyNotes(insights.quarterly_summary)}
                    disabled={acceptedItems.has("quarterly")}
                  >
                    {acceptedItems.has("quarterly") ? (
                      <><Check className="h-3.5 w-3.5 mr-1 text-green-500" />Saved</>
                    ) : (
                      <><Save className="h-3.5 w-3.5 mr-1" />Save to Quarterly Notes</>
                    )}
                  </Button>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Regenerate */}
          <div className="pt-2">
            <Button variant="ghost" size="sm" onClick={generateInsights} disabled={loading}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Regenerate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
