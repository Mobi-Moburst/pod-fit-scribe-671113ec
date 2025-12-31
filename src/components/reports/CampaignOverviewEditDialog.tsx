import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/TagInput";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";

interface CampaignOverviewData {
  strategy: string;
  executive_summary?: string;
  target_audiences: string[];
  talking_points: string[];
}

interface CampaignOverviewEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CampaignOverviewData;
  onSave: (data: CampaignOverviewData) => void;
}

export function CampaignOverviewEditDialog({
  open,
  onOpenChange,
  data,
  onSave,
}: CampaignOverviewEditDialogProps) {
  const [strategy, setStrategy] = useState(data.strategy);
  const [executiveSummary, setExecutiveSummary] = useState(data.executive_summary || "");
  const [targetAudiences, setTargetAudiences] = useState<string[]>(data.target_audiences || []);
  const [talkingPoints, setTalkingPoints] = useState<string[]>(data.talking_points || []);
  const [newTalkingPoint, setNewTalkingPoint] = useState("");

  const handleSave = () => {
    onSave({
      strategy,
      executive_summary: executiveSummary || undefined,
      target_audiences: targetAudiences,
      talking_points: talkingPoints,
    });
    onOpenChange(false);
  };

  const addTalkingPoint = () => {
    if (newTalkingPoint.trim()) {
      setTalkingPoints([...talkingPoints, newTalkingPoint.trim()]);
      setNewTalkingPoint("");
    }
  };

  const removeTalkingPoint = (index: number) => {
    setTalkingPoints(talkingPoints.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Campaign Overview</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Campaign Strategy</Label>
            <Textarea
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              placeholder="Describe the campaign strategy..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Executive Summary</Label>
            <Textarea
              value={executiveSummary}
              onChange={(e) => setExecutiveSummary(e.target.value)}
              placeholder="Optional executive summary..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Target Audiences</Label>
            <TagInput
              value={targetAudiences}
              onChange={setTargetAudiences}
              placeholder="Type and press Enter to add..."
            />
          </div>

          <div className="space-y-2">
            <Label>Key Talking Points</Label>
            <div className="space-y-2">
              {talkingPoints.map((point, index) => (
                <div key={index} className="flex items-start gap-2 bg-muted/50 rounded-md p-2">
                  <span className="flex-1 text-sm">{point}</span>
                  <button
                    type="button"
                    onClick={() => removeTalkingPoint(index)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newTalkingPoint}
                  onChange={(e) => setNewTalkingPoint(e.target.value)}
                  placeholder="Add a talking point..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTalkingPoint();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addTalkingPoint}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
