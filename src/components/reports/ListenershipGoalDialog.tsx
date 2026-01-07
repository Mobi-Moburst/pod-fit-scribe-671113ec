import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TrendingUp, Users, Calendar } from "lucide-react";

interface ListenershipGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listenershipGoal: number;
  currentListenersPerEpisode?: number;
  quarter: string;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

export function ListenershipGoalDialog({
  open,
  onOpenChange,
  listenershipGoal,
  currentListenersPerEpisode,
  quarter,
}: ListenershipGoalDialogProps) {
  // Calculate estimated annual listenership (monthly goal × 12)
  const estAnnualListenershipGoal = listenershipGoal * 12;
  
  // Current quarter values (if we have current data)
  const currentEstAnnual = currentListenersPerEpisode ? currentListenersPerEpisode * 12 : 0;

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
          {/* Goal Metrics */}
          <div className="space-y-4">
            {/* Total Monthly Listeners Per Episode Goal */}
            <div className="text-center p-6 bg-accent/10 rounded-xl">
              <Users className="h-6 w-6 mx-auto text-accent mb-2" />
              <p className="text-4xl font-bold text-accent">{formatNumber(listenershipGoal)}</p>
              <p className="text-muted-foreground mt-1">Total Monthly Listeners Per Episode Goal</p>
              <p className="text-xs text-muted-foreground mt-1">{quarter}</p>
            </div>

            {/* Est. Annual Listenership Goal */}
            <div className="text-center p-6 bg-muted/50 rounded-xl">
              <Calendar className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-4xl font-bold">{formatNumber(estAnnualListenershipGoal)}</p>
              <p className="text-muted-foreground mt-1">Est. Annual Listenership Goal</p>
            </div>
          </div>

          {/* Current Quarter Baseline */}
          {currentListenersPerEpisode !== undefined && currentListenersPerEpisode > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Current Quarter Baseline
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Total Monthly Listeners Per Episode</span>
                  <span className="font-bold">{formatNumber(currentListenersPerEpisode)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Est. Annual Listenership</span>
                  <span className="font-bold">{formatNumber(currentEstAnnual)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Calculation Explanation */}
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <p>Goal = Current Listeners Per Episode × 1.2 (20% growth)</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
