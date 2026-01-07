import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, TrendingUp } from "lucide-react";

interface TotalListenershipGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalListenershipGoal: number;
  currentTotalListenership?: number;
  quarter: string;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

export function TotalListenershipGoalDialog({
  open,
  onOpenChange,
  totalListenershipGoal,
  currentTotalListenership,
  quarter,
}: TotalListenershipGoalDialogProps) {
  const baseline = currentTotalListenership && currentTotalListenership > 0 ? currentTotalListenership : 0;

  const goal = totalListenershipGoal && totalListenershipGoal > 0
    ? totalListenershipGoal
    : baseline > 0
      ? Math.round(baseline * 1.2)
      : 0;

  const growthPercentage = baseline > 0
    ? Math.round(((goal - baseline) / baseline) * 100)
    : 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Total Listenership Goal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Goal */}
          <div className="text-center p-6 bg-primary/10 rounded-xl">
            <p className="text-5xl font-bold text-primary">
              {formatNumber(goal)}
            </p>
            <p className="text-muted-foreground mt-2">
              Total Monthly Listenership Goal for {quarter}
            </p>
          </div>

          {/* Growth Target */}
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
            <p className="text-2xl font-bold text-green-500">
              +{growthPercentage}%
            </p>
            <p className="text-xs text-muted-foreground">Growth Target</p>
          </div>

          {/* Current Quarter Context */}
          {baseline > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Current Quarter Baseline
              </h4>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span>Total Monthly Listenership</span>
                </div>
                <span className="font-bold">
                  {formatNumber(baseline)}
                </span>
              </div>
            </div>
          )}

          {/* Calculation Explanation */}
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <p>This is the sum of monthly listeners from all booked podcasts.</p>
            <p className="mt-1">Goal = Baseline × 1.2 (20% growth)</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
