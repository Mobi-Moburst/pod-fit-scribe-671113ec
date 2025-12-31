import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";

interface FocusArea {
  title: string;
  description: string;
}

interface NextQuarterData {
  quarter: string;
  intro_paragraph: string;
  strategic_focus_areas: FocusArea[];
  talking_points_spotlight: FocusArea[];
  closing_paragraph: string;
}

interface NextQuarterEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: NextQuarterData;
  onSave: (data: NextQuarterData) => void;
}

export function NextQuarterEditDialog({
  open,
  onOpenChange,
  data,
  onSave,
}: NextQuarterEditDialogProps) {
  const [quarter, setQuarter] = useState(data.quarter);
  const [introParagraph, setIntroParagraph] = useState(data.intro_paragraph);
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>(data.strategic_focus_areas || []);
  const [talkingPoints, setTalkingPoints] = useState<FocusArea[]>(data.talking_points_spotlight || []);
  const [closingParagraph, setClosingParagraph] = useState(data.closing_paragraph);

  const handleSave = () => {
    onSave({
      quarter,
      intro_paragraph: introParagraph,
      strategic_focus_areas: focusAreas,
      talking_points_spotlight: talkingPoints,
      closing_paragraph: closingParagraph,
    });
    onOpenChange(false);
  };

  const addFocusArea = () => {
    setFocusAreas([...focusAreas, { title: "", description: "" }]);
  };

  const updateFocusArea = (index: number, field: keyof FocusArea, value: string) => {
    setFocusAreas(focusAreas.map((area, i) => 
      i === index ? { ...area, [field]: value } : area
    ));
  };

  const removeFocusArea = (index: number) => {
    setFocusAreas(focusAreas.filter((_, i) => i !== index));
  };

  const addTalkingPoint = () => {
    setTalkingPoints([...talkingPoints, { title: "", description: "" }]);
  };

  const updateTalkingPoint = (index: number, field: keyof FocusArea, value: string) => {
    setTalkingPoints(talkingPoints.map((point, i) => 
      i === index ? { ...point, [field]: value } : point
    ));
  };

  const removeTalkingPoint = (index: number) => {
    setTalkingPoints(talkingPoints.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Looking Ahead Section</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Quarter</Label>
            <Input
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              placeholder="e.g., Q1 2025"
            />
          </div>

          <div className="space-y-2">
            <Label>Introduction</Label>
            <Textarea
              value={introParagraph}
              onChange={(e) => setIntroParagraph(e.target.value)}
              placeholder="Opening paragraph for the next quarter strategy..."
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Strategic Focus Areas</Label>
              <Button type="button" variant="outline" size="sm" onClick={addFocusArea}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {focusAreas.map((area, index) => (
              <div key={index} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Input
                    value={area.title}
                    onChange={(e) => updateFocusArea(index, "title", e.target.value)}
                    placeholder="Focus area title..."
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeFocusArea(index)}
                    className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Textarea
                  value={area.description}
                  onChange={(e) => updateFocusArea(index, "description", e.target.value)}
                  placeholder="Description..."
                  rows={2}
                />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Talking Points Spotlight</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTalkingPoint}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {talkingPoints.map((point, index) => (
              <div key={index} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Input
                    value={point.title}
                    onChange={(e) => updateTalkingPoint(index, "title", e.target.value)}
                    placeholder="Talking point title..."
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeTalkingPoint(index)}
                    className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Textarea
                  value={point.description}
                  onChange={(e) => updateTalkingPoint(index, "description", e.target.value)}
                  placeholder="Description..."
                  rows={2}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Closing Statement</Label>
            <Textarea
              value={closingParagraph}
              onChange={(e) => setClosingParagraph(e.target.value)}
              placeholder="Closing paragraph..."
              rows={3}
            />
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
