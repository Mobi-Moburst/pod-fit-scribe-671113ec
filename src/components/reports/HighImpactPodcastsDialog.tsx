import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Target, User } from "lucide-react";

interface SpeakerGoal {
  speaker_name: string;
  goal: number;
}

interface HighImpactPodcastsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalGoal: number;
  speakerBreakdown?: SpeakerGoal[];
  quarter: string;
}

export function HighImpactPodcastsDialog({
  open,
  onOpenChange,
  totalGoal,
  speakerBreakdown,
  quarter,
}: HighImpactPodcastsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            High-Impact Podcasts Goal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Total Goal */}
          <div className="text-center p-6 bg-primary/10 rounded-xl">
            <p className="text-5xl font-bold text-primary">{totalGoal}</p>
            <p className="text-muted-foreground mt-2">Podcasts for {quarter}</p>
          </div>

          {/* Breakdown by Speaker */}
          {speakerBreakdown && speakerBreakdown.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Per Speaker Breakdown
              </h4>
              <div className="space-y-2">
                {speakerBreakdown.map((speaker, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{speaker.speaker_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-lg">{speaker.goal}</span>
                      <span className="text-muted-foreground text-sm ml-1">podcasts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calculation Explanation */}
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <p>3 podcasts/month × 3 months = 9 per speaker</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
