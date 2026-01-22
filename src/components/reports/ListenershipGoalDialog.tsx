import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TrendingUp, Users, Calendar, Headphones } from "lucide-react";

interface ListenershipGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listenershipGoal: number;
  currentListenership?: number;
  currentAnnualListenership?: number;
  quarter: string;
  // Manual override values (when set, these override calculations)
  monthlyListenersPerEpisodeGoal?: number;
  annualListenershipGoal?: number;
  growthPercentage?: number;
  currentListenersPerEpisode?: number;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toLocaleString();
};

export function ListenershipGoalDialog({
  open,
  onOpenChange,
  listenershipGoal,
  currentListenership,
  currentAnnualListenership,
  quarter,
  monthlyListenersPerEpisodeGoal,
  annualListenershipGoal,
  growthPercentage,
  currentListenersPerEpisode,
}: ListenershipGoalDialogProps) {
  // Use manual override for current listeners/episode if set, otherwise fall back to currentListenership
  const currentMonthlyListenersPerEpisode = currentListenersPerEpisode && currentListenersPerEpisode > 0
    ? currentListenersPerEpisode
    : (currentListenership && currentListenership > 0 ? currentListenership : 0);
  
  // Use manual override for monthly listeners/episode goal if set, otherwise calculate 20% increase
  const displayMonthlyListenersPerEpisodeGoal = monthlyListenersPerEpisodeGoal && monthlyListenersPerEpisodeGoal > 0
    ? monthlyListenersPerEpisodeGoal
    : (currentMonthlyListenersPerEpisode > 0 ? Math.round(currentMonthlyListenersPerEpisode * 1.2) : 0);
  
  // Use manual override for annual goal if set, otherwise calculate
  const displayAnnualGoal = annualListenershipGoal && annualListenershipGoal > 0 
    ? annualListenershipGoal
    : (currentAnnualListenership && currentAnnualListenership > 0 
        ? Math.round(currentAnnualListenership * 1.2) 
        : listenershipGoal * 12);
  
  // Use manual override for growth percentage if set, otherwise default to 20
  const displayGrowthPercentage = growthPercentage !== undefined && growthPercentage > 0
    ? growthPercentage
    : 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-accent" />
            Listenership Goal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Monthly Goal */}
          <div className="text-center p-6 bg-accent/10 rounded-xl">
            <p className="text-5xl font-bold text-accent">{formatNumber(listenershipGoal)}</p>
            <p className="text-muted-foreground mt-2">Monthly Listeners Goal for {quarter}</p>
          </div>

          {/* Breakdown Cards */}
          <div className="grid grid-cols-2 gap-4">
            {displayMonthlyListenersPerEpisodeGoal > 0 && (
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <Headphones className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                <p className="text-2xl font-bold">{formatNumber(displayMonthlyListenersPerEpisodeGoal)}</p>
                <p className="text-xs text-muted-foreground">Monthly Listeners/Episode</p>
              </div>
            )}
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <Calendar className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold">{formatNumber(displayAnnualGoal)}</p>
              <p className="text-xs text-muted-foreground">Est. Annual Listenership</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-green-500">+{displayGrowthPercentage}%</p>
              <p className="text-xs text-muted-foreground">Growth Target</p>
            </div>
          </div>

          {/* Current Quarter Context */}
          {(currentListenership !== undefined && currentListenership > 0) || (currentAnnualListenership !== undefined && currentAnnualListenership > 0) ? (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Current Quarter Baseline
              </h4>
              <div className="space-y-2">
                {currentListenership !== undefined && currentListenership > 0 && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span>Current Monthly Listeners</span>
                    </div>
                    <span className="font-bold">{formatNumber(currentListenership)}</span>
                  </div>
                )}
                {currentMonthlyListenersPerEpisode > 0 && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Headphones className="h-5 w-5 text-muted-foreground" />
                      <span>Current Listeners/Episode</span>
                    </div>
                    <span className="font-bold">{formatNumber(currentMonthlyListenersPerEpisode)}</span>
                  </div>
                )}
                {currentAnnualListenership !== undefined && currentAnnualListenership > 0 && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <span>Current Est. Annual Listenership</span>
                    </div>
                    <span className="font-bold">{formatNumber(currentAnnualListenership)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Calculation Explanation */}
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <p>Annual Goal = Current Annual Listenership × 1.2 (20% growth)</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
