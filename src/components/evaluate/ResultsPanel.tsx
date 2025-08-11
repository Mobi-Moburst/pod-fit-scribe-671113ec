import { AnalyzeResult } from "@/utils/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "./ScoreBadge";

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

  const fitItemsRaw = (why_fit_structured && why_fit_structured.length
    ? why_fit_structured
    : (why_fit || []).map((s) => ({ claim: s, evidence: '', interpretation: '' }))
  ).slice(0, 5);

  const notFitItemsRaw = (why_not_fit_structured && why_not_fit_structured.length
    ? why_not_fit_structured
    : (why_not_fit || []).map((s) => ({ severity: 'Minor' as const, claim: s, evidence: '', interpretation: '' }))
  ).slice(0, 4);

  const riskItemsRaw = (risk_flags_structured && risk_flags_structured.length
    ? risk_flags_structured
    : (risk_flags || []).map((r) => ({ severity: 'Minor' as const, flag: r, mitigation: '' }))
  ).slice(0, 6);

  // Ensure no blank sections by synthesizing minimum insights from rubric/citations
  const fitItems = fitItemsRaw.length ? fitItemsRaw : rubric_breakdown.filter(r => r.raw_score >= 6).slice(0, 2).map(r => ({
    claim: `${r.dimension} strength`,
    evidence: r.notes,
    interpretation: ''
  }));

  const notFitItems = notFitItemsRaw.length ? notFitItemsRaw : rubric_breakdown.filter(r => r.raw_score < 5.5).slice(0, 2).map(r => ({
    severity: r.raw_score < 4 ? 'Major' : 'Minor',
    claim: `Low ${r.dimension.toLowerCase()}`,
    evidence: r.notes,
    interpretation: ''
  }));

  const riskItems = riskItemsRaw.length ? riskItemsRaw : ([{
    severity: 'Minor' as const,
    flag: 'No critical risks detected',
    mitigation: 'Confirm editorial policy and audience match before pitching'
  }] as const);

  return (
    <section className="mt-6 grid gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ScoreBadge score={overall_score} />
          <div>
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
            </div>
            <p className="text-sm text-muted-foreground">Goal-centric fit using concept sets and near matches.</p>
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

      {/* Rubric */}
      <div className="grid md:grid-cols-5 gap-4">
        {rubric_breakdown.map((r) => (
          <Card key={r.dimension} className="p-4 card-surface">
            <div className="text-sm text-muted-foreground">{r.dimension}</div>
            <div className="text-2xl font-semibold mt-1">{r.raw_score.toFixed(1)}</div>
            <p className="text-sm mt-2">{r.notes}</p>
          </Card>
        ))}
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
          <h3 className="text-lg font-semibold mb-2">Why it doesn’t</h3>
          <ul className="space-y-2">
            {notFitItems.map((w: any, i: number) => (
              <li key={i}>
                <div className="flex items-center gap-2">
                  <div className="font-medium">{w.claim}</div>
                  {w.severity && <Badge variant="outline">{w.severity}</Badge>}
                </div>
                {w.evidence && <blockquote className="text-sm text-muted-foreground border-l pl-3 mt-1">“{w.evidence}”</blockquote>}
                {w.interpretation && <div className="text-sm mt-1">{w.interpretation}</div>}
              </li>
            ))}
          </ul>
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
          <ul className="space-y-2">
            {riskItems.map((r: any, i: number) => (
              <li key={i} className="flex items-start gap-2">
                {r.severity && <Badge variant="outline" className="shrink-0">{r.severity}</Badge>}
                <div className="text-sm">
                  <div className="font-medium">{r.flag || r}</div>
                  {r.mitigation && <div className="text-muted-foreground">Mitigation: {r.mitigation}</div>}
                </div>
              </li>
            ))}
          </ul>
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
