import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/TagInput";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";

interface PitchHook {
  speaker_name: string;
  hooks: string[];
}

interface CampaignOverviewData {
  strategy: string;
  executive_summary?: string;
  target_audiences: string[];
  talking_points: string[];
  pitch_hooks?: PitchHook[];
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
  const [pitchHooks, setPitchHooks] = useState<PitchHook[]>(data.pitch_hooks || []);
  const [newHookInputs, setNewHookInputs] = useState<{ [key: number]: string }>({});

  // Re-sync local state when dialog opens
  useEffect(() => {
    if (open) {
      setStrategy(data.strategy);
      setExecutiveSummary(data.executive_summary || "");
      setTargetAudiences(data.target_audiences || []);
      setTalkingPoints(data.talking_points || []);
      setPitchHooks(data.pitch_hooks || []);
      setNewTalkingPoint("");
      setNewHookInputs({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = () => {
    onSave({
      strategy,
      executive_summary: executiveSummary || undefined,
      target_audiences: targetAudiences,
      talking_points: talkingPoints,
      pitch_hooks: pitchHooks.length > 0 ? pitchHooks : undefined,
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

  const addSpeaker = () => {
    setPitchHooks([...pitchHooks, { speaker_name: "", hooks: [] }]);
  };

  const removeSpeaker = (index: number) => {
    setPitchHooks(pitchHooks.filter((_, i) => i !== index));
  };

  const updateSpeakerName = (index: number, name: string) => {
    setPitchHooks(pitchHooks.map((s, i) => i === index ? { ...s, speaker_name: name } : s));
  };

  const addHook = (speakerIndex: number) => {
    const hookText = newHookInputs[speakerIndex]?.trim();
    if (hookText) {
      setPitchHooks(pitchHooks.map((s, i) => 
        i === speakerIndex ? { ...s, hooks: [...s.hooks, hookText] } : s
      ));
      setNewHookInputs({ ...newHookInputs, [speakerIndex]: "" });
    }
  };

  const removeHook = (speakerIndex: number, hookIndex: number) => {
    setPitchHooks(pitchHooks.map((s, i) => 
      i === speakerIndex ? { ...s, hooks: s.hooks.filter((_, hi) => hi !== hookIndex) } : s
    ));
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
            <p className="text-xs text-muted-foreground">Supports formatting: **bold**, *italic*, - bullet points</p>
          </div>

          <div className="space-y-2">
            <Label>Executive Summary</Label>
            <Textarea
              value={executiveSummary}
              onChange={(e) => setExecutiveSummary(e.target.value)}
              placeholder="Optional executive summary..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">Supports formatting: **bold**, *italic*, - bullet points</p>
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Pitch Positioning & Core Hooks</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSpeaker}>
                <Plus className="h-4 w-4 mr-1" />
                Add Speaker
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Define repeatable hooks for each speaker to resonate with target audiences.
            </p>
            {pitchHooks.map((speaker, speakerIndex) => (
              <div key={speakerIndex} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={speaker.speaker_name}
                    onChange={(e) => updateSpeakerName(speakerIndex, e.target.value)}
                    placeholder="Speaker name..."
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSpeaker(speakerIndex)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 ml-2">
                  {speaker.hooks.map((hook, hookIndex) => (
                    <div key={hookIndex} className="flex items-start gap-2 bg-muted/50 rounded-md p-2">
                      <span className="flex-1 text-sm">{hook}</span>
                      <button
                        type="button"
                        onClick={() => removeHook(speakerIndex, hookIndex)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newHookInputs[speakerIndex] || ""}
                      onChange={(e) => setNewHookInputs({ ...newHookInputs, [speakerIndex]: e.target.value })}
                      placeholder="Add a hook..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addHook(speakerIndex);
                        }
                      }}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => addHook(speakerIndex)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
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
