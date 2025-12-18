import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PodcastReportEntry } from "@/types/reports";
import { Users, TrendingUp, Trophy } from "lucide-react";

interface ReachAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  podcasts: PodcastReportEntry[];
  totalListenersPerEpisode?: number;
  quarter?: string;
}

export const ReachAnalysisDialog = ({ 
  open, 
  onOpenChange, 
  podcasts,
  totalListenersPerEpisode = 0,
  quarter = ''
}: ReachAnalysisDialogProps) => {
  // Calculate Estimated Annual Listenership
  const estimatedAnnualListenership = totalListenersPerEpisode * 12;

  // Find highest reach show (by monthly_listens) - parse to numbers for correct comparison
  const highestReachShow = podcasts.reduce((max, p) => {
    const currentMonthly = typeof p.monthly_listens === 'string' 
      ? parseFloat(p.monthly_listens) || 0
      : (p.monthly_listens || 0);
    const maxMonthly = typeof max?.monthly_listens === 'string'
      ? parseFloat(max.monthly_listens) || 0
      : (max?.monthly_listens || 0);
    return currentMonthly > maxMonthly ? p : max;
  }, podcasts[0]);

  // Parse the highest value for display
  const highestMonthlyListens = typeof highestReachShow?.monthly_listens === 'string'
    ? parseFloat(highestReachShow.monthly_listens) || 0
    : (highestReachShow?.monthly_listens || 0);

  const formatNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reach Analysis</DialogTitle>
          <DialogDescription>
            Detailed breakdown of podcast audience reach for this campaign period.
          </DialogDescription>
        </DialogHeader>
        
        {/* Summary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Monthly Listeners Per Episode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(totalListenersPerEpisode)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Combined reach this quarter
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Est. Annual Listenership
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(estimatedAnnualListenership)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {quarter ? `Annual reach from podcasts booked in ${quarter}` : 'Annual reach projection'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Highest Reach Show
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(highestMonthlyListens)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate" title={highestReachShow?.show_title}>
                {highestReachShow?.show_title || 'N/A'}
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
