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

  /**
   * Next quarter goal value.
   * In this app, this represents the *estimated annual listenership* goal.
   */
  listenershipGoal: number;

  /**
   * Baseline value for comparison.
   * We pass in the previous quarter's *estimated annual listenership*.
   */
  currentListenership?: number;

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
  currentListenership,
  quarter,
}: ListenershipGoalDialogProps) {
  const baselineAnnualListenership =
    currentListenership && currentListenership > 0 ? currentListenership : 0;

  // In this app, the next-quarter listenership goal is stored as an *estimated annual listenership*.
  // It should be ~20% higher than the previous quarter's estimated annual listenership.
  const annualGoal =
    listenershipGoal && listenershipGoal > 0
      ? listenershipGoal
      : baselineAnnualListenership > 0
        ? Math.round(baselineAnnualListenership * 1.2)
        : 0;

  const monthlyEquivalent = annualGoal > 0 ? Math.round(annualGoal / 12) : 0;

  const growthPercentage =
    baselineAnnualListenership > 0
      ? Math.round(
          ((annualGoal - baselineAnnualListenership) / baselineAnnualListenership) *
            100
        )
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
          {/* Annual Goal */}
          <div className="text-center p-6 bg-accent/10 rounded-xl">
            <p className="text-5xl font-bold text-accent">
              {formatNumber(annualGoal)}
            </p>
            <p className="text-muted-foreground mt-2">
              Est. Annual Listenership Goal for {quarter}
            </p>
          </div>

          {/* Breakdown Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <Calendar className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold">{formatNumber(monthlyEquivalent)}</p>
              <p className="text-xs text-muted-foreground">Monthly Equivalent</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-green-500">
                +{growthPercentage}%
              </p>
              <p className="text-xs text-muted-foreground">Growth Target</p>
            </div>
          </div>

          {/* Current Quarter Context */}
          {baselineAnnualListenership > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Current Quarter Baseline
              </h4>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span>Current Est. Annual Listenership</span>
                </div>
                <span className="font-bold">
                  {formatNumber(baselineAnnualListenership)}
                </span>
              </div>
            </div>
          )}

          {/* Calculation Explanation */}
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <p>Goal = Baseline × 1.2 (20% growth)</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
