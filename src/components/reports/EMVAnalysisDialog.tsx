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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PodcastReportEntry } from "@/types/reports";

interface EMVAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  podcasts: PodcastReportEntry[];
  hideCorrelationChart?: boolean;
  cpm?: number;
  speakingTimePct?: number;
}

export const EMVAnalysisDialog = ({ open, onOpenChange, podcasts, hideCorrelationChart, cpm = 50, speakingTimePct = 0.40 }: EMVAnalysisDialogProps) => {
  // Filter podcasts that have EMV data
  const podcastsWithEMV = podcasts.filter(p => p.true_emv && p.true_emv > 0);

  // Calculate summary metrics
  const totalAdUnits = podcastsWithEMV.reduce((sum, p) => sum + (p.ad_units || 0), 0);
  
  const avgValuePerMinute = podcastsWithEMV.length > 0
    ? podcastsWithEMV.reduce((sum, p) => sum + (p.value_per_minute || 0), 0) / podcastsWithEMV.length
    : 0;
  
  const totalEMV = podcastsWithEMV.reduce((sum, p) => sum + (p.true_emv || 0), 0);
  const avgEMVPerAppearance = podcastsWithEMV.length > 0 ? totalEMV / podcastsWithEMV.length : 0;
  
  const highestValuePodcast = podcastsWithEMV.reduce((max, p) => 
    (p.true_emv || 0) > (max?.true_emv || 0) ? p : max, 
    podcastsWithEMV[0]
  );

  // Filter podcasts that have both score and EMV data for the scatter plot
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>EMV Analysis</DialogTitle>
          <DialogDescription>
            Detailed breakdown of earned media value for this campaign period.
          </DialogDescription>
        </DialogHeader>

        {/* Methodology */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 mt-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Methodology</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            EMV = (Listeners per Episode ÷ 1,000) × ${cpm} CPM × (Episode Duration × {Math.round(speakingTimePct * 100)}% guest speaking time). 
            This reflects the equivalent cost an advertiser would pay to reach the same audience through paid podcast ad placements.
          </p>
        </div>
        
        {/* Summary Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Ad Units
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalAdUnits.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Speaking minutes earned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Value/Minute
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${avgValuePerMinute.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Per speaking minute
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg EMV/Appearance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${avgEMVPerAppearance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {podcastsWithEMV.length} shows
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Highest-Value Show
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(highestValuePodcast?.true_emv || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate" title={highestValuePodcast?.show_title}>
                {highestValuePodcast?.show_title || 'N/A'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Scatter Chart Section - hide when no fit scores or in demo mode */}
        {!hideCorrelationChart && validPodcasts.length > 0 && (
          <>
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Fit Score vs EMV Correlation</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Each point represents a podcast episode, showing the relationship between fit score and earned media value.
              </p>
            </div>
            
            <div className="w-full h-[500px]">
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
                      domain={[0, 10]}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
