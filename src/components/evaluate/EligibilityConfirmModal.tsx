import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface EligibilityConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  community: string;
  evidence: string;
  onConfirmEligibility: () => void;
  onAppendOptIn: () => void;
  onMarkNotRecommended: () => void;
}

export function EligibilityConfirmModal({
  open,
  onOpenChange,
  community,
  evidence,
  onConfirmEligibility,
  onAppendOptIn,
  onMarkNotRecommended,
}: EligibilityConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            This show is exclusive to {community}
          </DialogTitle>
          <DialogDescription>
            We didn't find an opt-in for this community in the client's notes. To proceed, please confirm eligibility or keep the current recommendation.
          </DialogDescription>
        </DialogHeader>
        
        <Alert>
          <AlertDescription>
            <strong>Show requirement:</strong> {evidence}
          </AlertDescription>
        </Alert>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button 
            onClick={onConfirmEligibility}
            variant="default"
            className="w-full"
          >
            Confirm eligibility & proceed (this evaluation only)
          </Button>
          
          <Button 
            onClick={onAppendOptIn}
            variant="secondary"
            className="w-full"
          >
            Append opt-in to client notes & proceed
          </Button>
          
          <Button 
            onClick={onMarkNotRecommended}
            variant="destructive"
            className="w-full"
          >
            Mark Not recommended for this show
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}