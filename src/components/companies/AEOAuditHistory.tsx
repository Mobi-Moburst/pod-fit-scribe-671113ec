import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, TrendingDown, TrendingUp, Minus } from "lucide-react";

interface AuditRun {
  id: string;
  created_at: string;
  model: string;
  prompts_run: number;
  prompts_failed: number;
  content_gap_analysis: any;
  geo_analysis: any;
  competitor_names: string[];
  topics: string[];
}

interface AEOAuditHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
}

interface Delta {
  value: number;
  label: string;
  positive: boolean;
  neutral: boolean;
}

function calcDelta(current: number, previous: number): Delta {
  const d = current - previous;
  const sign = d > 0 ? "+" : "";
  return { value: d, label: `${sign}${d.toFixed(1)}`, positive: d > 0, neutral: d === 0 };
}

export function AEOAuditHistory({ open, onOpenChange, companyId, companyName }: AEOAuditHistoryProps) {
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !companyId) return;
    setLoading(true);
    supabase
      .from("aeo_audit_runs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) console.error("[AEOAuditHistory]", error);
        setRuns((data as any) ?? []);
        setLoading(false);
      });
  }, [open, companyId]);

  const selected = runs.find((r) => r.id === selectedId) ?? runs[0];
  const previous = selected ? runs[runs.findIndex((r) => r.id === selected.id) + 1] : null;

  const coverageDelta = selected && previous
    ? calcDelta(
        selected.content_gap_analysis?.coverage_percentage ?? 0,
        previous.content_gap_analysis?.coverage_percentage ?? 0,
      )
    : null;
  const geoDelta = selected && previous
    ? calcDelta(selected.geo_analysis?.geo_score ?? 0, previous.geo_analysis?.geo_score ?? 0)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-4">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AEO Audit History — {companyName}
              </SheetTitle>
            </SheetHeader>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : runs.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No AEO audits run for this company yet. Trigger one from any report dashboard.
              </div>
            ) : (
              <>
                {/* Timeline */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timeline</h4>
                  {runs.map((run) => {
                    const isSel = (selected?.id ?? runs[0]?.id) === run.id;
                    return (
                      <button
                        key={run.id}
                        onClick={() => setSelectedId(run.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSel ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              {new Date(run.created_at).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {run.model} · {run.prompts_run} prompts
                              {run.prompts_failed ? ` · ${run.prompts_failed} failed` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-xs">
                              GEO {run.geo_analysis?.geo_score ?? 0}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {run.content_gap_analysis?.coverage_percentage ?? 0}% cov
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Diff vs previous */}
                {selected && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {previous ? "Change vs previous run" : "Most recent run"}
                    </h4>

                    <div className="grid grid-cols-2 gap-3">
                      <DeltaCard
                        label="Coverage %"
                        current={selected.content_gap_analysis?.coverage_percentage ?? 0}
                        delta={coverageDelta}
                        suffix="%"
                      />
                      <DeltaCard
                        label="GEO Score"
                        current={selected.geo_analysis?.geo_score ?? 0}
                        delta={geoDelta}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Top competitors</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(selected.content_gap_analysis?.top_competitors ?? []).slice(0, 8).map((c: any) => (
                          <Badge key={c.name} variant="secondary" className="text-xs">
                            {c.name} · {c.mention_count}
                          </Badge>
                        ))}
                        {!(selected.content_gap_analysis?.top_competitors?.length) && (
                          <span className="text-xs text-muted-foreground">None detected</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Top priority gaps</p>
                      <ul className="space-y-1.5">
                        {(selected.content_gap_analysis?.priority_prompts ?? []).slice(0, 5).map((p: any, i: number) => (
                          <li key={i} className="text-xs p-2 rounded border border-border bg-muted/30">
                            <p className="font-medium">{p.prompt}</p>
                            <p className="text-muted-foreground mt-0.5">
                              {p.topic} · {p.stage}
                              {p.competitors_present?.length
                                ? ` · competitors: ${p.competitors_present.join(", ")}`
                                : ""}
                            </p>
                          </li>
                        ))}
                        {!(selected.content_gap_analysis?.priority_prompts?.length) && (
                          <li className="text-xs text-muted-foreground">No gaps identified</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="pt-4 flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function DeltaCard({
  label,
  current,
  delta,
  suffix = "",
}: {
  label: string;
  current: number;
  delta: Delta | null;
  suffix?: string;
}) {
  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">
        {current}
        {suffix}
      </p>
      {delta && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${
          delta.neutral
            ? "text-muted-foreground"
            : delta.positive
            ? "text-green-500"
            : "text-destructive"
        }`}>
          {delta.neutral ? <Minus className="h-3 w-3" /> : delta.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta.label}
          {suffix} vs prev
        </div>
      )}
    </div>
  );
}
