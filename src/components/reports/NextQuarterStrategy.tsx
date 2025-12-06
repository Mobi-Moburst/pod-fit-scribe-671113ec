import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowRight, X, Pencil } from "lucide-react";

interface NextQuarterStrategyProps {
  quarter: string;
  intro_paragraph: string;
  strategic_focus_areas: Array<{
    title: string;
    description: string;
  }>;
  talking_points_spotlight: Array<{
    title: string;
    description: string;
  }>;
  closing_paragraph: string;
  onHide?: () => void;
  onIntroParagraphChange?: (value: string) => void;
  onStrategicFocusAreasChange?: (areas: Array<{ title: string; description: string }>) => void;
  onTalkingPointsSpotlightChange?: (points: Array<{ title: string; description: string }>) => void;
  onClosingParagraphChange?: (value: string) => void;
}

export function NextQuarterStrategy({
  quarter,
  intro_paragraph,
  strategic_focus_areas,
  talking_points_spotlight,
  closing_paragraph,
  onHide,
  onIntroParagraphChange,
  onStrategicFocusAreasChange,
  onTalkingPointsSpotlightChange,
  onClosingParagraphChange
}: NextQuarterStrategyProps) {
  const handleFocusAreaChange = (idx: number, field: 'title' | 'description', value: string) => {
    if (!onStrategicFocusAreasChange) return;
    const updated = [...strategic_focus_areas];
    updated[idx] = { ...updated[idx], [field]: value };
    onStrategicFocusAreasChange(updated);
  };

  const handleTalkingPointChange = (idx: number, field: 'title' | 'description', value: string) => {
    if (!onTalkingPointsSpotlightChange) return;
    const updated = [...talking_points_spotlight];
    updated[idx] = { ...updated[idx], [field]: value };
    onTalkingPointsSpotlightChange(updated);
  };

  const isEditable = onIntroParagraphChange || onStrategicFocusAreasChange || onTalkingPointsSpotlightChange || onClosingParagraphChange;

  return (
    <Card className="relative group">
      {onHide && (
        <button
          onClick={onHide}
          className="absolute top-4 right-4 p-1 rounded-full bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive print:hidden z-10"
          title="Hide this section"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-primary" />
          Looking Ahead: {quarter}
          {isEditable && <Pencil className="h-4 w-4 text-muted-foreground opacity-50 print:hidden" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Intro Paragraph */}
        <div className="group/edit">
          {onIntroParagraphChange ? (
            <Textarea
              value={intro_paragraph}
              onChange={(e) => onIntroParagraphChange(e.target.value)}
              className="min-h-[80px] text-muted-foreground leading-relaxed resize-none bg-transparent border-muted/50 focus:border-primary/50 print:border-none print:p-0"
            />
          ) : (
            <p className="text-muted-foreground leading-relaxed">
              {intro_paragraph}
            </p>
          )}
        </div>

        {/* Strategic Focus Areas */}
        {strategic_focus_areas.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">Strategic Focus Areas</h4>
            <ul className="space-y-3">
              {strategic_focus_areas.map((area, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-primary font-bold mt-1">•</span>
                  <div className="flex-1 space-y-1">
                    {onStrategicFocusAreasChange ? (
                      <>
                        <Input
                          value={area.title}
                          onChange={(e) => handleFocusAreaChange(idx, 'title', e.target.value)}
                          className="font-semibold text-foreground h-7 px-2 bg-transparent border-muted/50 focus:border-primary/50 print:border-none print:p-0"
                        />
                        <Textarea
                          value={area.description}
                          onChange={(e) => handleFocusAreaChange(idx, 'description', e.target.value)}
                          className="min-h-[60px] text-sm text-muted-foreground resize-none bg-transparent border-muted/50 focus:border-primary/50 print:border-none print:p-0"
                        />
                      </>
                    ) : (
                      <div>
                        <span className="font-semibold text-foreground">{area.title}:</span>{' '}
                        <span className="text-muted-foreground">{area.description}</span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Talking Points to Spotlight */}
        {talking_points_spotlight.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">Talking Points to Spotlight</h4>
            <ul className="space-y-3">
              {talking_points_spotlight.map((point, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-accent font-bold mt-1">•</span>
                  <div className="flex-1 space-y-1">
                    {onTalkingPointsSpotlightChange ? (
                      <>
                        <Input
                          value={point.title}
                          onChange={(e) => handleTalkingPointChange(idx, 'title', e.target.value)}
                          className="font-semibold text-foreground h-7 px-2 bg-transparent border-muted/50 focus:border-primary/50 print:border-none print:p-0"
                        />
                        <Textarea
                          value={point.description}
                          onChange={(e) => handleTalkingPointChange(idx, 'description', e.target.value)}
                          className="min-h-[60px] text-sm text-muted-foreground resize-none bg-transparent border-muted/50 focus:border-primary/50 print:border-none print:p-0"
                        />
                      </>
                    ) : (
                      <div>
                        <span className="font-semibold text-foreground">{point.title}:</span>{' '}
                        <span className="text-muted-foreground">{point.description}</span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Closing Paragraph */}
        <div className="border-l-2 border-primary/30 pl-4">
          {onClosingParagraphChange ? (
            <Textarea
              value={closing_paragraph}
              onChange={(e) => onClosingParagraphChange(e.target.value)}
              className="min-h-[80px] text-muted-foreground leading-relaxed italic resize-none bg-transparent border-muted/50 focus:border-primary/50 print:border-none print:p-0"
            />
          ) : (
            <p className="text-muted-foreground leading-relaxed italic">
              {closing_paragraph}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
