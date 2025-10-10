import { AnalyzeResult } from "@/utils/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "./ScoreBadge";
import { Calendar, AlertTriangle, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export const ResultsPanel = ({
  result,
  onSave,
  onCopySummary,
  onExportJson,
}: {
  result: AnalyzeResult & { show_title?: string };
  onSave: () => void;
  onCopySummary: () => void;
  onExportJson: () => void;
}) => {
  const { toast } = useToast();
  
  const {
    overall_score,
    rubric_breakdown,
    show_title,
    scored_by,
    confidence,
    verdict,
    verdict_reason,
    why_fit_structured,
    why_not_fit_structured,
    risk_flags_structured,
    why_fit,
    why_not_fit,
    risk_flags,
    recommended_talking_points,
    confidence_label,
    confidence_note,
    what_would_change,
  } = result;

  const verdictLabel = verdict === 'recommend' ? 'Recommend' : verdict === 'consider' ? 'Consider' : verdict === 'not_recommended' ? 'Not recommended' : undefined;
  const verdictVariant: 'default' | 'secondary' | 'outline' | undefined = verdict === 'recommend' ? 'default' : verdict === 'consider' ? 'secondary' : verdict === 'not_recommended' ? 'outline' : undefined;

  const fitItems = (why_fit_structured && why_fit_structured.length
    ? why_fit_structured
    : (why_fit || []).map((s) => ({ claim: s, evidence: '', interpretation: '' }))
  ).slice(0, 5);

  const notFitItems = (why_not_fit_structured && why_not_fit_structured.length
    ? why_not_fit_structured
    : (why_not_fit || []).map((s) => ({ severity: 'Minor' as const, claim: s, evidence: '', interpretation: '' }))
  ).slice(0, 4);

  const riskItems = (risk_flags_structured && risk_flags_structured.length
    ? risk_flags_structured
    : (risk_flags || []).map((r) => ({ severity: 'Minor' as const, flag: r, mitigation: '' }))
  ).slice(0, 6);

  return (
    <section className="mt-6 grid gap-6">
      {/* Eligibility Banner */}
      {result.audit?.eligibility?.show_banner && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <AlertDescription className="ml-2">
            <div className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
              Eligibility Check Required
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
              {result.audit?.eligibility?.banner_message}
            </p>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  toast({ title: 'Eligibility confirmed', description: 'Update client profile to reflect confirmed eligibility.' });
                }}
              >
                Confirm Eligibility
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => {
                  toast({ title: 'Reminder added', description: 'Add eligibility check to client notes or campaign strategy.' });
                }}
              >
                Add to Client Notes
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-2">
            <ScoreBadge score={overall_score} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold">{show_title || 'Analysis Result'}</h2>
              {verdictLabel && <Badge variant={verdictVariant}>{`Verdict: ${verdictLabel}`}</Badge>}
              <Badge variant="outline">{scored_by === 'ai' ? 'AI model' : 'Local heuristic'}</Badge>
              {typeof confidence === 'number' && (
                <Badge variant="secondary">{Math.round(confidence * 100)}% conf</Badge>
              )}
              {result.confidence_label && (
                <Badge variant="secondary">{result.confidence_label}</Badge>
              )}
              {(result as any).last_publish_date && (() => {
                const date = new Date((result as any).last_publish_date);
                const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
                const isStale = daysSince > 90;
                const isInactive = daysSince > 730; // 2 years = likely inactive
                const formatRelativeTime = (days: number) => {
                  if (days < 1) return "Today";
                  if (days < 2) return "Yesterday";
                  if (days < 7) return `${Math.floor(days)} days ago`;
                  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
                  if (days < 365) return `${Math.floor(days / 30)} months ago`;
                  return `${Math.floor(days / 365)} years ago`;
                };
                return (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isStale ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Calendar className="w-4 h-4" />
                    )}
                    <span>
                      Published {date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} 
                      ({formatRelativeTime(daysSince)})
                      {isInactive ? (
                        <span className="text-red-600 ml-1 font-medium">- No longer publishing</span>
                      ) : isStale ? (
                        <span className="text-amber-600 ml-1">- Stale content ({Math.floor(daysSince)}d)</span>
                      ) : null}
                    </span>
                  </div>
                );
              })()}
            </div>
            <p className="text-sm text-muted-foreground mt-2">Goal-centric fit using concept sets and near matches.</p>
            {result.scored_by !== 'ai' && result.fallback_reason && (
              <div className="mt-1">
                <Badge variant="outline">LLM unavailable: {result.fallback_reason}</Badge>
              </div>
            )}
            {verdict_reason && (
              <p className="text-sm mt-1">{verdict_reason}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="hero" onClick={onSave}>Save to History</Button>
          <Button variant="outline" onClick={onExportJson}>Export JSON</Button>
          <Button variant="outline" onClick={onCopySummary}>Copy Summary</Button>
        </div>
      </div>

      {/* Rubric - Now 3 scored dimensions + Format/CTA info-only */}
      <div className="grid gap-4">
        <div className="grid md:grid-cols-3 gap-4">
          {rubric_breakdown
            .filter((r) => !/recency|consistency|eligibility|cta|format/i.test(r.dimension))
            .map((r) => (
              <Card key={r.dimension} className="p-4 card-surface">
                <div className="text-sm text-muted-foreground">{r.dimension}</div>
                <div className="text-2xl font-semibold mt-1">{r.raw_score.toFixed(1)}</div>
                {r.weight > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">Weight: {(r.weight * 100).toFixed(0)}%</div>
                )}
                <p className="text-sm mt-2">{r.notes}</p>
              </Card>
            ))}
        </div>

        {/* Score Audit Trail - Show only when audit data exists */}
        {result.audit && (
          <Card className="p-4 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Score Calculation Audit
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {result.audit.weighted_mean !== undefined && (
                <div>
                  <div className="text-muted-foreground">Weighted Mean</div>
                  <div className="font-mono font-semibold">{result.audit.weighted_mean.toFixed(2)}</div>
                </div>
              )}
              {result.audit.adjustments && (
                <>
                  {result.audit.adjustments.genericness !== undefined && (
                    <div>
                      <div className="text-muted-foreground">Genericness</div>
                      <div className="font-mono font-semibold">{result.audit.adjustments.genericness > 0 ? '+' : ''}{result.audit.adjustments.genericness.toFixed(2)}</div>
                    </div>
                  )}
                  {result.audit.adjustments.multi_concept !== undefined && (
                    <div>
                      <div className="text-muted-foreground">Multi-concept</div>
                      <div className="font-mono font-semibold">{result.audit.adjustments.multi_concept > 0 ? '+' : ''}{result.audit.adjustments.multi_concept.toFixed(2)}</div>
                    </div>
                  )}
                  {result.audit.adjustments.cadence !== undefined && (
                    <div>
                      <div className="text-muted-foreground">Cadence</div>
                      <div className="font-mono font-semibold">{result.audit.adjustments.cadence > 0 ? '+' : ''}{result.audit.adjustments.cadence.toFixed(2)}</div>
                    </div>
                  )}
                </>
              )}
              {result.audit.baseline_overall !== undefined && (
                <div>
                  <div className="text-muted-foreground">Baseline</div>
                  <div className="font-mono font-semibold">{result.audit.baseline_overall.toFixed(1)}</div>
                </div>
              )}
              {(result.audit as any).influence_multiplier && (result.audit as any).influence_multiplier !== 1.0 && (
                <div>
                  <div className="text-muted-foreground">Influence ×</div>
                  <div className="font-mono font-semibold">{((result.audit as any).influence_multiplier as number).toFixed(2)}</div>
                </div>
              )}
              {result.audit.final_overall !== undefined && (
                <div>
                  <div className="text-muted-foreground">Final Score</div>
                  <div className="font-mono font-semibold text-lg">{result.audit.final_overall.toFixed(1)}</div>
                </div>
              )}
            </div>
            {result.applied_adjustments && result.applied_adjustments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="text-xs text-muted-foreground mb-1">Applied Adjustments:</div>
                <div className="flex flex-wrap gap-1">
                  {result.applied_adjustments.map((adj: any, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {adj.label} {adj.amount !== undefined && `(${adj.amount > 0 ? '+' : ''}${adj.amount})`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
        
        {/* Show eligibility warning only when there's a concern */}
        {(result.audit?.eligibility?.action === 'fail' || result.audit?.eligibility?.action === 'conditional') && (
          <Card className="p-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                  ⚠️ Guest Eligibility Review Required
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {result.audit.eligibility.action === 'fail' 
                    ? 'Client may not be eligible for this show\'s guest requirements. Please review before pitching.'
                    : 'Unable to confirm guest eligibility from available client data. Please verify before pitching.'}
                </p>
                {result.audit?.eligibility?.evidence && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 italic">
                    Show requirement: "{result.audit.eligibility.evidence}"
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Fit vs Gaps */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Why it fits</h3>
          <ul className="space-y-2">
            {fitItems.map((w: any, i: number) => (
              <li key={i}>
                <div className="font-medium">{w.claim}</div>
                {w.evidence && <blockquote className="text-sm text-muted-foreground border-l pl-3 mt-1">“{w.evidence}”</blockquote>}
                {w.interpretation && <div className="text-sm mt-1">{w.interpretation}</div>}
              </li>
            ))}
          </ul>
        </Card>
        {notFitItems.length > 0 && (
          <Card className="p-4 card-surface">
            <h3 className="text-lg font-semibold mb-2">Why it doesn't</h3>
            <ul className="space-y-2">
              {notFitItems.map((w: any, i: number) => (
                <li key={i}>
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{w.claim}</div>
                    {w.severity && <Badge variant="outline">{w.severity}</Badge>}
                  </div>
                  {w.evidence && <blockquote className="text-sm text-muted-foreground border-l pl-3 mt-1">"{w.evidence}"</blockquote>}
                  {w.interpretation && <div className="text-sm mt-1">{w.interpretation}</div>}
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Recommendation</h3>
          <div className="flex items-center gap-2">
            <Badge variant={verdictVariant || 'outline'}>{verdictLabel || (overall_score >= 7.5 && (risk_flags?.length ?? 0) === 0 ? 'Recommend' : 'Not recommended')}</Badge>
            <span className="text-sm text-muted-foreground">{verdict_reason || 'Based on overall score and risk flags.'}</span>
          </div>
        </Card>
      </div>

      {/* Actions & Risks */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Talking Points to Pitch</h3>
          <ul className="list-disc pl-5 space-y-1">
            {(recommended_talking_points || []).slice(0,5).map((t, i) => (<li key={i}>{t}</li>))}
          </ul>
        </Card>
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Risk Flags</h3>
          {riskItems.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm font-medium text-green-900 dark:text-green-100">
                No material risks detected
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Group risks by severity */}
              {['Red', 'Amber'].map(severity => {
                const items = riskItems.filter((r: any) => r.severity === severity);
                if (items.length === 0) return null;
                
                const bgClass = severity === 'Red' 
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' 
                  : severity === 'Amber'
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                  : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800';
                
                const textClass = severity === 'Red'
                  ? 'text-red-900 dark:text-red-100'
                  : severity === 'Amber'
                  ? 'text-amber-900 dark:text-amber-100'
                  : 'text-green-900 dark:text-green-100';
                
                return (
                  <div key={severity} className="space-y-2">
                    {items.map((r: any, i: number) => (
                      <div key={i} className={`p-3 rounded-lg border ${bgClass}`}>
                        <div className="flex items-start gap-2">
                          <Badge 
                            variant={severity === 'Red' ? 'destructive' : severity === 'Amber' ? 'secondary' : 'default'}
                            className="shrink-0 mt-0.5"
                          >
                            {severity === 'Red' ? '⛔ Dealbreaker' : '⚠️ Concern'}
                          </Badge>
                          <div className="flex-1 space-y-1.5">
                            <div className={`font-semibold text-sm ${textClass}`}>
                              {r.flag || r}
                            </div>
                            {r.evidence && (
                              <div className="text-xs italic opacity-80">
                                "{r.evidence}"
                              </div>
                            )}
                            {r.mitigation && (
                              <div className="text-sm font-medium mt-1.5 pt-1.5 border-t border-current/10">
                                <span className="opacity-60">→ </span>
                                {r.mitigation}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Confidence & Next Checks</h3>
          <div className="flex items-center gap-2">
            {confidence_label && <Badge variant="secondary">{confidence_label}</Badge>}
            {typeof confidence === 'number' && <span className="text-sm text-muted-foreground">{Math.round(confidence * 100)}% modeled</span>}
          </div>
          {confidence_note && <p className="text-sm mt-2">{confidence_note}</p>}
          {Array.isArray(what_would_change) && what_would_change.length > 0 && (
            <div className="mt-3">
              <div className="text-sm font-medium mb-1">What would change the verdict</div>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {what_would_change.slice(0,2).map((w, i) => (<li key={i}>{w}</li>))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
};
