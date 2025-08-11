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
  const { overall_score, rubric_breakdown, why_fit, why_not_fit, recommended_talking_points, risk_flags, citations, show_title } = result;

  return (
    <section className="mt-6 grid gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ScoreBadge score={overall_score} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{show_title || 'Analysis Result'}</h2>
              <Badge variant="outline">{result.scored_by === 'ai' ? 'AI model' : 'Local heuristic'}</Badge>
              {typeof result.confidence === 'number' && (
                <Badge variant="secondary">{Math.round(result.confidence * 100)}% conf</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Confidence improves with longer notes and more citations.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="hero" onClick={onSave}>Save to History</Button>
          <Button variant="outline" onClick={onExportJson}>Export JSON</Button>
          <Button variant="outline" onClick={onCopySummary}>Copy Summary</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-4">
        {rubric_breakdown.map((r) => (
          <Card key={r.dimension} className="p-4 card-surface">
            <div className="text-sm text-muted-foreground">{r.dimension} · wt {r.weight}</div>
            <div className="text-2xl font-semibold mt-1">{r.raw_score.toFixed(1)}</div>
            <p className="text-sm mt-2">{r.notes}</p>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Why it fits</h3>
          <ul className="list-disc pl-5 space-y-1">
            {why_fit.map((w, i) => (<li key={i}>{w}</li>))}
          </ul>
        </Card>
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Why it doesn’t</h3>
          <ul className="list-disc pl-5 space-y-1">
            {why_not_fit.map((w, i) => (<li key={i}>{w}</li>))}
          </ul>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Talking Points</h3>
          <ul className="list-disc pl-5 space-y-1">
            {recommended_talking_points.map((t, i) => (<li key={i}>{t}</li>))}
          </ul>
        </Card>
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Risk Flags</h3>
          <ul className="list-disc pl-5 space-y-1">
            {risk_flags.map((r, i) => (<li key={i}>{r}</li>))}
          </ul>
        </Card>
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Citations</h3>
          <div className="flex flex-wrap gap-2">
            {citations.map((c, i) => (
              <Badge key={i} variant="secondary">“{c}”</Badge>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
};
