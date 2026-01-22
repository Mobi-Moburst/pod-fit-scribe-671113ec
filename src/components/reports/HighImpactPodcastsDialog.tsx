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
  // Calculate dynamic explanation based on actual numbers
  const speakerCount = speakerBreakdown?.length || 1;
  const perSpeakerGoal = speakerBreakdown && speakerBreakdown.length > 0
    ? speakerBreakdown[0]?.goal || 0
    : totalGoal;
  
  // Assume 3 months per quarter, calculate podcasts per month
  const monthsPerQuarter = 3;
  const podcastsPerMonthPerSpeaker = perSpeakerGoal / monthsPerQuarter;
  
  // Build dynamic explanation
  const buildExplanation = () => {
    if (speakerBreakdown && speakerBreakdown.length > 0) {
      // Check if all speakers have the same goal
      const allSameGoal = speakerBreakdown.every(s => s.goal === perSpeakerGoal);
      
      if (allSameGoal && perSpeakerGoal > 0) {
        // Format podcasts per month (handle decimals nicely)
        const perMonthDisplay = Number.isInteger(podcastsPerMonthPerSpeaker) 
          ? podcastsPerMonthPerSpeaker 
          : podcastsPerMonthPerSpeaker.toFixed(1).replace(/\.0$/, '');
        
        return `${perMonthDisplay} podcast${Number(perMonthDisplay) !== 1 ? 's' : ''}/month × ${monthsPerQuarter} months = ${perSpeakerGoal} per speaker`;
      } else {
        // Mixed goals - show total calculation
        const totalFromBreakdown = speakerBreakdown.reduce((sum, s) => sum + s.goal, 0);
        return `Total: ${totalFromBreakdown} podcasts across ${speakerCount} speaker${speakerCount !== 1 ? 's' : ''}`;
      }
    } else {
      // No speaker breakdown - show simple total
      const perMonth = totalGoal / monthsPerQuarter;
      const perMonthDisplay = Number.isInteger(perMonth) 
        ? perMonth 
        : perMonth.toFixed(1).replace(/\.0$/, '');
      return `${perMonthDisplay} podcast${Number(perMonthDisplay) !== 1 ? 's' : ''}/month × ${monthsPerQuarter} months = ${totalGoal} total`;
    }
  };

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

          {/* Dynamic Calculation Explanation */}
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <p>{buildExplanation()}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
