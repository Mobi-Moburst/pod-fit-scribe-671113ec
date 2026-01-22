import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, User } from "lucide-react";

interface FocusArea {
  title: string;
  description: string;
}

interface SpeakerTalkingPoints {
  speaker_name: string;
  points: FocusArea[];
}

interface SpeakerGoalBreakdown {
  speaker_name: string;
  goal: number;
}

interface NextQuarterData {
  quarter: string;
  intro_paragraph: string;
  strategic_focus_areas: FocusArea[];
  talking_points_spotlight: FocusArea[];
  speaker_talking_points_spotlight?: SpeakerTalkingPoints[];
  closing_paragraph: string;
  next_quarter_kpis?: {
    high_impact_podcasts_goal: number;
    listenership_goal: number;
    speaker_breakdown?: SpeakerGoalBreakdown[];
    current_total_reach?: number;
    current_annual_listenership?: number;
    // Manual overrides
    monthly_listeners_per_episode_goal?: number;
    annual_listenership_goal?: number;
    growth_percentage?: number;
    current_listeners_per_episode?: number;
  };
}

interface NextQuarterEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: NextQuarterData;
  onSave: (data: NextQuarterData) => void;
  speakerNames?: string[]; // For multi-speaker reports
}

export function NextQuarterEditDialog({
  open,
  onOpenChange,
  data,
  onSave,
  speakerNames = [],
}: NextQuarterEditDialogProps) {
  const [quarter, setQuarter] = useState(data.quarter);
  const [introParagraph, setIntroParagraph] = useState(data.intro_paragraph);
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>(data.strategic_focus_areas || []);
  const [talkingPoints, setTalkingPoints] = useState<FocusArea[]>(data.talking_points_spotlight || []);
  const [speakerTalkingPoints, setSpeakerTalkingPoints] = useState<SpeakerTalkingPoints[]>(
    data.speaker_talking_points_spotlight || []
  );
  const [closingParagraph, setClosingParagraph] = useState(data.closing_paragraph);
  const [highImpactGoal, setHighImpactGoal] = useState(data.next_quarter_kpis?.high_impact_podcasts_goal || 0);
  const [listenershipGoal, setListenershipGoal] = useState(data.next_quarter_kpis?.listenership_goal || 0);
  const [speakerGoalBreakdown, setSpeakerGoalBreakdown] = useState<SpeakerGoalBreakdown[]>(
    data.next_quarter_kpis?.speaker_breakdown || []
  );
  const [currentTotalReach, setCurrentTotalReach] = useState(data.next_quarter_kpis?.current_total_reach || 0);
  const [currentAnnualListenership, setCurrentAnnualListenership] = useState(
    data.next_quarter_kpis?.current_annual_listenership || 0
  );
  // New manual override fields
  const [monthlyListenersPerEpisodeGoal, setMonthlyListenersPerEpisodeGoal] = useState(
    data.next_quarter_kpis?.monthly_listeners_per_episode_goal || 0
  );
  const [annualListenershipGoal, setAnnualListenershipGoal] = useState(
    data.next_quarter_kpis?.annual_listenership_goal || 0
  );
  const [growthPercentage, setGrowthPercentage] = useState(
    data.next_quarter_kpis?.growth_percentage || 20
  );
  const [currentListenersPerEpisode, setCurrentListenersPerEpisode] = useState(
    data.next_quarter_kpis?.current_listeners_per_episode || 0
  );

  // Reset state only when the dialog is opened (prevents wiping unsaved edits if parent data updates while open)
  const prevOpenRef = useRef(open);
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;

    if (!justOpened) return;

    setQuarter(data.quarter);
    setIntroParagraph(data.intro_paragraph);
    setFocusAreas(data.strategic_focus_areas || []);
    setTalkingPoints(data.talking_points_spotlight || []);
    setSpeakerTalkingPoints(data.speaker_talking_points_spotlight || []);
    setClosingParagraph(data.closing_paragraph);
    setHighImpactGoal(data.next_quarter_kpis?.high_impact_podcasts_goal || 0);
    setListenershipGoal(data.next_quarter_kpis?.listenership_goal || 0);
    setSpeakerGoalBreakdown(data.next_quarter_kpis?.speaker_breakdown || []);
    setCurrentTotalReach(data.next_quarter_kpis?.current_total_reach || 0);
    setCurrentAnnualListenership(data.next_quarter_kpis?.current_annual_listenership || 0);
    setMonthlyListenersPerEpisodeGoal(data.next_quarter_kpis?.monthly_listeners_per_episode_goal || 0);
    setAnnualListenershipGoal(data.next_quarter_kpis?.annual_listenership_goal || 0);
    setGrowthPercentage(data.next_quarter_kpis?.growth_percentage || 20);
    setCurrentListenersPerEpisode(data.next_quarter_kpis?.current_listeners_per_episode || 0);
  }, [open]);

  const isMultiSpeaker = speakerNames.length > 1;

  const handleSave = () => {
    onSave({
      quarter,
      intro_paragraph: introParagraph,
      strategic_focus_areas: focusAreas.filter((a) => a.title.trim() || a.description.trim()),
      talking_points_spotlight: talkingPoints.filter((p) => p.title.trim() || p.description.trim()),
      speaker_talking_points_spotlight: speakerTalkingPoints
        .map((s) => ({
          ...s,
          points: s.points.filter((p) => p.title.trim() || p.description.trim()),
        }))
        .filter((s) => s.points.length > 0),
      closing_paragraph: closingParagraph,
      next_quarter_kpis: {
        ...(data.next_quarter_kpis || {}),
        high_impact_podcasts_goal: highImpactGoal,
        listenership_goal: listenershipGoal,
        speaker_breakdown: speakerGoalBreakdown.filter(s => s.speaker_name.trim()),
        current_total_reach: currentTotalReach,
        current_annual_listenership: currentAnnualListenership,
        monthly_listeners_per_episode_goal: monthlyListenersPerEpisodeGoal,
        annual_listenership_goal: annualListenershipGoal,
        growth_percentage: growthPercentage,
        current_listeners_per_episode: currentListenersPerEpisode,
      },
    });
    onOpenChange(false);
  };


  // Focus area handlers
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

  // General talking points handlers
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

  // Speaker-specific talking points handlers
  const addSpeakerSection = () => {
    setSpeakerTalkingPoints([
      ...speakerTalkingPoints,
      { speaker_name: "", points: [{ title: "", description: "" }] }
    ]);
  };

  const updateSpeakerName = (index: number, name: string) => {
    setSpeakerTalkingPoints(speakerTalkingPoints.map((s, i) =>
      i === index ? { ...s, speaker_name: name } : s
    ));
  };

  const removeSpeakerSection = (index: number) => {
    setSpeakerTalkingPoints(speakerTalkingPoints.filter((_, i) => i !== index));
  };

  const addSpeakerPoint = (speakerIndex: number) => {
    setSpeakerTalkingPoints(speakerTalkingPoints.map((s, i) =>
      i === speakerIndex 
        ? { ...s, points: [...s.points, { title: "", description: "" }] }
        : s
    ));
  };

  const updateSpeakerPoint = (speakerIndex: number, pointIndex: number, field: keyof FocusArea, value: string) => {
    setSpeakerTalkingPoints(speakerTalkingPoints.map((s, si) =>
      si === speakerIndex 
        ? { 
            ...s, 
            points: s.points.map((p, pi) => 
              pi === pointIndex ? { ...p, [field]: value } : p
            )
          }
        : s
    ));
  };

  const removeSpeakerPoint = (speakerIndex: number, pointIndex: number) => {
    setSpeakerTalkingPoints(speakerTalkingPoints.map((s, si) =>
      si === speakerIndex 
        ? { ...s, points: s.points.filter((_, pi) => pi !== pointIndex) }
        : s
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit Looking Ahead Section</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4 min-h-0">
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
              <p className="text-xs text-muted-foreground">Supports formatting: **bold**, *italic*, - bullet points</p>
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

            {/* Talking Points Section - with tabs for multi-speaker */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Talking Points Spotlight</Label>
              </div>
              
              <Tabs defaultValue="per-speaker" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
                  <TabsTrigger value="per-speaker" className="flex-1">Per Speaker</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="space-y-3 mt-3">
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={addTalkingPoint}>
                      <Plus className="h-4 w-4 mr-1" /> Add Point
                    </Button>
                  </div>
                  {talkingPoints.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No general talking points. Add one or use per-speaker points.
                    </p>
                  )}
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
                </TabsContent>
                
                <TabsContent value="per-speaker" className="space-y-4 mt-3">
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={addSpeakerSection}>
                      <User className="h-4 w-4 mr-1" /> Add Speaker
                    </Button>
                  </div>
                  
                  {speakerTalkingPoints.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No speaker-specific talking points. Add a speaker to get started.
                    </p>
                  )}
                  
                  {speakerTalkingPoints.map((speaker, speakerIndex) => (
                    <div key={speakerIndex} className="border rounded-lg p-4 space-y-3 bg-card">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <User className="h-4 w-4 text-primary" />
                          {speakerNames.length > 0 ? (
                            <select
                              value={speaker.speaker_name}
                              onChange={(e) => updateSpeakerName(speakerIndex, e.target.value)}
                              className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                            >
                              <option value="">Select speaker...</option>
                              {speakerNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              value={speaker.speaker_name}
                              onChange={(e) => updateSpeakerName(speakerIndex, e.target.value)}
                              placeholder="Speaker name..."
                              className="flex-1"
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSpeakerSection(speakerIndex)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="space-y-2 pl-6">
                        {speaker.points.map((point, pointIndex) => (
                          <div key={pointIndex} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                            <div className="flex items-center justify-between">
                              <Input
                                value={point.title}
                                onChange={(e) => updateSpeakerPoint(speakerIndex, pointIndex, "title", e.target.value)}
                                placeholder="Talking point title..."
                                className="flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => removeSpeakerPoint(speakerIndex, pointIndex)}
                                className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <Textarea
                              value={point.description}
                              onChange={(e) => updateSpeakerPoint(speakerIndex, pointIndex, "description", e.target.value)}
                              placeholder="Description..."
                              rows={2}
                            />
                          </div>
                        ))}
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => addSpeakerPoint(speakerIndex)}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add Point for {speaker.speaker_name || 'Speaker'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label>Closing Statement</Label>
              <Textarea
                value={closingParagraph}
                onChange={(e) => setClosingParagraph(e.target.value)}
                placeholder="Closing paragraph..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Supports formatting: **bold**, *italic*, - bullet points</p>
            </div>

            {/* Next Quarter KPIs */}
            <div className="space-y-4 pt-4 border-t border-border">
              <Label className="text-base font-semibold">Next Quarter Goals</Label>
              
              {/* High-Impact Podcasts Section */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">High-Impact Podcasts Goal (Total)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={highImpactGoal}
                    onChange={(e) => setHighImpactGoal(parseInt(e.target.value) || 0)}
                    placeholder="e.g., 27"
                  />
                  <p className="text-xs text-muted-foreground">Total podcasts across all speakers</p>
                </div>
                
                {/* Per-Speaker Breakdown */}
                {isMultiSpeaker && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Per-Speaker Breakdown</Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSpeakerGoalBreakdown([...speakerGoalBreakdown, { speaker_name: "", goal: 9 }])}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Speaker
                      </Button>
                    </div>
                    {speakerGoalBreakdown.map((speaker, index) => (
                      <div key={index} className="flex items-center gap-2">
                        {speakerNames.length > 0 ? (
                          <select
                            value={speaker.speaker_name}
                            onChange={(e) => {
                              const updated = [...speakerGoalBreakdown];
                              updated[index] = { ...updated[index], speaker_name: e.target.value };
                              setSpeakerGoalBreakdown(updated);
                            }}
                            className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                          >
                            <option value="">Select speaker...</option>
                            {speakerNames.map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            value={speaker.speaker_name}
                            onChange={(e) => {
                              const updated = [...speakerGoalBreakdown];
                              updated[index] = { ...updated[index], speaker_name: e.target.value };
                              setSpeakerGoalBreakdown(updated);
                            }}
                            placeholder="Speaker name..."
                            className="flex-1"
                          />
                        )}
                        <Input
                          type="number"
                          min={0}
                          value={speaker.goal}
                          onChange={(e) => {
                            const updated = [...speakerGoalBreakdown];
                            updated[index] = { ...updated[index], goal: parseInt(e.target.value) || 0 };
                            setSpeakerGoalBreakdown(updated);
                          }}
                          placeholder="Goal"
                          className="w-24"
                        />
                        <button
                          type="button"
                          onClick={() => setSpeakerGoalBreakdown(speakerGoalBreakdown.filter((_, i) => i !== index))}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {speakerGoalBreakdown.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Speaker total: {speakerGoalBreakdown.reduce((sum, s) => sum + s.goal, 0)} 
                        {speakerGoalBreakdown.reduce((sum, s) => sum + s.goal, 0) !== highImpactGoal && (
                          <span className="text-amber-500 ml-1">(differs from total goal)</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Listenership Section */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Listenership Goal (Monthly)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={listenershipGoal}
                    onChange={(e) => setListenershipGoal(parseInt(e.target.value) || 0)}
                    placeholder="e.g., 1200000"
                  />
                  <p className="text-xs text-muted-foreground">Target monthly listeners for next quarter</p>
                </div>
                
                {/* Listenership Breakdown Metrics */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <Label className="text-sm font-medium">Goal Metrics</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Monthly Listeners/Episode Goal</Label>
                      <Input
                        type="number"
                        min={0}
                        value={monthlyListenersPerEpisodeGoal}
                        onChange={(e) => setMonthlyListenersPerEpisodeGoal(parseInt(e.target.value) || 0)}
                        placeholder="e.g., 5000"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Est. Annual Listenership Goal</Label>
                      <Input
                        type="number"
                        min={0}
                        value={annualListenershipGoal}
                        onChange={(e) => setAnnualListenershipGoal(parseInt(e.target.value) || 0)}
                        placeholder="e.g., 72000"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Growth Target (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={growthPercentage}
                        onChange={(e) => setGrowthPercentage(parseInt(e.target.value) || 0)}
                        placeholder="e.g., 20"
                      />
                    </div>
                  </div>
                </div>

                {/* Current Quarter Baseline */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <Label className="text-sm font-medium">Current Quarter Baseline</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Current Monthly Listeners</Label>
                      <Input
                        type="number"
                        min={0}
                        value={currentTotalReach}
                        onChange={(e) => setCurrentTotalReach(parseInt(e.target.value) || 0)}
                        placeholder="e.g., 4000"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Current Listeners/Episode</Label>
                      <Input
                        type="number"
                        min={0}
                        value={currentListenersPerEpisode}
                        onChange={(e) => setCurrentListenersPerEpisode(parseInt(e.target.value) || 0)}
                        placeholder="e.g., 4000"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Current Est. Annual Listenership</Label>
                      <Input
                        type="number"
                        min={0}
                        value={currentAnnualListenership}
                        onChange={(e) => setCurrentAnnualListenership(parseInt(e.target.value) || 0)}
                        placeholder="e.g., 60000"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Manual values override automatic calculations in the Listenership Goal dialog</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
