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
      
      {/* Score explanation hint */}
      {result.audit && (overall_score < 8.5 || result.audit.adjustments.genericness < 0) && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">Why it's not higher:</span>{' '}
            {result.audit.adjustments.genericness < 0 && 'Audience wording is broad; '}
            {result.audit.enterprise_cues_count >= 2 && 'lifted by enterprise cues; '}
            {result.audit.adjustments.multi_concept > 0 && 'multiple concepts detected'}
            {!result.audit.adjustments.multi_concept && result.audit.enterprise_cues_count < 2 && 'limited enterprise signals'}
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
            {Array.isArray(result.applied_adjustments) && result.applied_adjustments.filter((a: any) => a.type !== 'cap').length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {result.applied_adjustments.filter((adj: any) => adj.type !== 'cap').map((adj: any, i: number) => (
                  <Badge key={i} variant={adj.type === 'floor' ? 'secondary' : 'outline'}>
                    {adj.type?.toUpperCase?.() || 'ADJ'}: {adj.label}{typeof adj.amount === 'number' ? ` (${adj.amount > 0 ? '+' : ''}${adj.amount.toFixed(1)})` : ''}
                  </Badge>
                ))}
              </div>
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
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Why it doesn't</h3>
          {notFitItems.length === 0 ? (
            <div className="text-sm text-muted-foreground italic py-2 px-3 border-l-2 border-green-500 bg-green-50/50 dark:bg-green-950/10 rounded-r">
              No material gaps identified
            </div>
          ) : (
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
          )}
        </Card>
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
            <ul className="space-y-2">
              {riskItems.map((r: any, i: number) => {
                const severityVariant = r.severity === 'Red' ? 'destructive' : r.severity === 'Amber' ? 'secondary' : 'default';
                return (
                  <li key={i} className="flex items-start gap-2">
                    {r.severity && <Badge variant={severityVariant} className="shrink-0">{r.severity}</Badge>}
                    <div className="text-sm">
                      <div className="font-medium">{r.flag || r}</div>
                      {r.evidence && <div className="text-xs text-muted-foreground mt-0.5">Evidence: {r.evidence}</div>}
                      {r.mitigation && <div className="text-muted-foreground mt-1">→ {r.mitigation}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
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
