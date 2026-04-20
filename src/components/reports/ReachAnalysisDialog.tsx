import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PodcastReportEntry } from "@/types/reports";
import { Users, TrendingUp, Trophy, ExternalLink, Loader2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInMonths, parseISO } from "date-fns";
import { EditableNumber } from "./EditableNumber";

interface ReachAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  podcasts: PodcastReportEntry[];
  totalListenersPerEpisode?: number;
  quarter?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  totalReach?: number;
  /** When provided, enables inline editing of the listenership figures */
  onEditTotalReach?: (next: number) => void;
  onEditTotalListenersPerEpisode?: (next: number) => void;
  /** When provided, enables inline editing of an individual podcast's monthly_listens.
   *  The matcher receives the podcast entry and should return true for the row to update. */
  onEditPodcastMonthlyListens?: (podcast: PodcastReportEntry, next: number) => void;
}

// Calculate months in reporting period
const calculatePeriodMonths = (dateRange?: { start: string; end: string }, quarter?: string): number => {
  // If it's a quarter-based report, always return 3
  if (quarter && /^Q\d\s*\d{4}$/.test(quarter)) {
    return 3;
  }
  
  // For custom date ranges, calculate actual months
  if (dateRange?.start && dateRange?.end) {
    const startDate = parseISO(dateRange.start);
    const endDate = parseISO(dateRange.end);
    const months = differenceInMonths(endDate, startDate) + 1;
    return Math.max(1, months);
  }
  
  return 3;
};

export const ReachAnalysisDialog = ({ 
  open, 
  onOpenChange, 
  podcasts,
  totalListenersPerEpisode = 0,
  quarter = '',
  dateRange,
  totalReach = 0,
  onEditTotalReach,
  onEditTotalListenersPerEpisode,
  onEditPodcastMonthlyListens,
}: ReachAnalysisDialogProps) => {
  const [coverArtUrl, setCoverArtUrl] = useState<string | null>(null);
  const [isLoadingCoverArt, setIsLoadingCoverArt] = useState(false);

  // Calculate period months and period reach
  const periodMonths = calculatePeriodMonths(dateRange, quarter);
  const periodReach = totalReach * periodMonths;

  // Calculate Estimated Annual Listenership from total_reach (consistent with the KPI card)
  const estimatedAnnualListenership = totalReach * 12;

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

  // Fetch cover art when highest reach show changes
  useEffect(() => {
    const fetchCoverArt = async () => {
      if (!highestReachShow?.apple_podcast_link) {
        setCoverArtUrl(null);
        return;
      }

      setIsLoadingCoverArt(true);
      try {
        const { data, error } = await supabase.functions.invoke('scrape-podcast-cover-art', {
          body: { apple_podcast_url: highestReachShow.apple_podcast_link }
        });

        if (error) {
          console.error('Error fetching cover art:', error);
          setCoverArtUrl(null);
        } else {
          setCoverArtUrl(data?.coverArtUrl || null);
        }
      } catch (err) {
        console.error('Failed to fetch cover art:', err);
        setCoverArtUrl(null);
      } finally {
        setIsLoadingCoverArt(false);
      }
    };

    if (open && highestReachShow?.apple_podcast_link) {
      fetchCoverArt();
    }
  }, [open, highestReachShow?.apple_podcast_link]);

  const formatNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // Generate period label
  const periodLabel = quarter && /^Q\d\s*\d{4}$/.test(quarter) 
    ? "Quarterly reach" 
    : `${periodMonths}-month period reach`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Reach Analysis</DialogTitle>
          <DialogDescription>
            Detailed breakdown of podcast audience reach for this campaign period.
          </DialogDescription>
        </DialogHeader>
        
        {/* Summary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Monthly Listeners Per Episode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {onEditTotalListenersPerEpisode ? (
                  <EditableNumber
                    value={totalListenersPerEpisode}
                    onSave={onEditTotalListenersPerEpisode}
                    format={formatNumber}
                    ariaLabel="Edit total monthly listeners per episode"
                  />
                ) : (
                  formatNumber(totalListenersPerEpisode)
                )}
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
                {onEditTotalReach ? (
                  <EditableNumber
                    value={totalReach}
                    onSave={(next) => onEditTotalReach(next)}
                    format={(n) => formatNumber(n * 12)}
                    ariaLabel="Edit total monthly listeners (drives annual)"
                  />
                ) : (
                  formatNumber(estimatedAnnualListenership)
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {quarter ? `Annual reach from podcasts booked in ${quarter}` : 'Annual reach projection'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Cumulative Impressions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(periodReach)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {periodLabel}
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
              <div className="flex gap-3">
                {/* Cover Art */}
                <div className="flex-shrink-0">
                  {isLoadingCoverArt ? (
                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : coverArtUrl ? (
                    <img 
                      src={coverArtUrl} 
                      alt={highestReachShow?.show_title || 'Podcast cover'} 
                      className="w-16 h-16 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
                      <Trophy className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                {/* Show Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-2xl font-bold">
                    {formatNumber(highestMonthlyListens)}
                  </div>
                  <p className="text-xs text-muted-foreground">monthly listeners</p>
                  {highestReachShow?.apple_podcast_link ? (
                    <a 
                      href={highestReachShow.apple_podcast_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 truncate"
                      title={highestReachShow?.show_title}
                    >
                      {highestReachShow?.show_title || 'N/A'}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1 truncate" title={highestReachShow?.show_title}>
                      {highestReachShow?.show_title || 'N/A'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
