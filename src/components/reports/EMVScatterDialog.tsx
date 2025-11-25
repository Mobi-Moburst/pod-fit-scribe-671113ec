import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { PodcastReportEntry } from "@/types/reports";

interface EMVScatterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  podcasts: PodcastReportEntry[];
}

export const EMVScatterDialog = ({ open, onOpenChange, podcasts }: EMVScatterDialogProps) => {
  // Filter podcasts that have both score and EMV data
  const validPodcasts = podcasts.filter(
    p => p.overall_score > 0 && p.true_emv && p.true_emv > 0
  );

  // Group by verdict for color coding
  const fitPodcasts = validPodcasts
    .filter(p => p.verdict === "Fit")
    .map(p => ({
      score: p.overall_score,
      emv: p.true_emv,
      title: p.show_title,
      verdict: p.verdict,
    }));

  const considerPodcasts = validPodcasts
    .filter(p => p.verdict === "Consider")
    .map(p => ({
      score: p.overall_score,
      emv: p.true_emv,
      title: p.show_title,
      verdict: p.verdict,
    }));

  const notFitPodcasts = validPodcasts
    .filter(p => p.verdict === "Not")
    .map(p => ({
      score: p.overall_score,
      emv: p.true_emv,
      title: p.show_title,
      verdict: p.verdict,
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-sm mb-1">{data.title}</p>
          <p className="text-xs text-muted-foreground">
            Score: <span className="font-medium text-foreground">{data.score}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            EMV: <span className="font-medium text-foreground">${data.emv.toLocaleString()}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Verdict: <span className="font-medium text-foreground">{data.verdict}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fit Score vs EMV Analysis</DialogTitle>
          <DialogDescription>
            Correlation between podcast fit scores and earned media value. Each point represents a podcast episode.
          </DialogDescription>
        </DialogHeader>
        
        <div className="w-full h-[500px] mt-4">
          {validPodcasts.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number"
                  dataKey="score"
                  name="Fit Score"
                  domain={[0, 100]}
                  label={{ value: 'Fit Score', position: 'insideBottom', offset: -10 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  type="number"
                  dataKey="emv"
                  name="True EMV"
                  label={{ value: 'Earned Media Value ($)', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  height={36}
                  wrapperStyle={{ paddingBottom: '20px' }}
                />
                
                <Scatter
                  name="Fit"
                  data={fitPodcasts}
                  fill="hsl(var(--chart-1))"
                  opacity={0.7}
                />
                <Scatter
                  name="Consider"
                  data={considerPodcasts}
                  fill="hsl(var(--chart-2))"
                  opacity={0.7}
                />
                <Scatter
                  name="Not Fit"
                  data={notFitPodcasts}
                  fill="hsl(var(--chart-3))"
                  opacity={0.7}
                />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                No data available. EMV requires both fit scores and episode metrics.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
