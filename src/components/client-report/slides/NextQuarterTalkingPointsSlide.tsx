import { ReportData } from "@/types/reports";
import { Lightbulb } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ExpandableTalkingPoint } from "@/components/client-report/ExpandableTalkingPoint";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NextQuarterTalkingPointsSlideProps {
  strategy: NonNullable<ReportData["next_quarter_strategy"]>;
}

export const NextQuarterTalkingPointsSlide = ({ strategy }: NextQuarterTalkingPointsSlideProps) => {
  const hasTalkingPoints = (strategy.talking_points_spotlight && strategy.talking_points_spotlight.length > 0) ||
    (strategy.speaker_talking_points_spotlight && strategy.speaker_talking_points_spotlight.length > 0);

  if (!hasTalkingPoints && !strategy.closing_paragraph) return null;

  return (
    <ScrollArea className="h-full w-full">
      <div className="w-full space-y-8 max-w-4xl mx-auto px-4 py-6">
        {/* Talking Points */}
        {hasTalkingPoints && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Lightbulb className="h-5 w-5 text-accent" />
                <h3 className="text-lg font-semibold text-muted-foreground uppercase tracking-wider">
                  Talking Points Spotlight
                </h3>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">Key Messages to Lead With</h2>
            </div>

            {/* General Talking Points */}
            {strategy.talking_points_spotlight && strategy.talking_points_spotlight.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {strategy.talking_points_spotlight.slice(0, 4).map((point, index) => (
                  <ExpandableTalkingPoint
                    key={index}
                    title={point.title}
                    description={point.description}
                  />
                ))}
              </div>
            )}

            {/* Per-Speaker Talking Points */}
            {strategy.speaker_talking_points_spotlight && strategy.speaker_talking_points_spotlight.length > 0 && (
              <div className="space-y-4">
                {strategy.speaker_talking_points_spotlight.map((speaker, speakerIndex) => (
                  <div key={speakerIndex} className="space-y-2">
                    <h4 className="font-semibold text-sm text-primary flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {speaker.speaker_name}
                    </h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      {speaker.points.map((point, pointIndex) => (
                        <ExpandableTalkingPoint
                          key={pointIndex}
                          title={point.title}
                          description={point.description}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Closing */}
        {strategy.closing_paragraph && (
          <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border border-border/50 rounded-2xl p-6 text-center">
            <MarkdownRenderer
              content={strategy.closing_paragraph}
              className="text-muted-foreground leading-relaxed italic max-w-3xl mx-auto"
            />
          </div>
        )}

        <div className="h-8" />
      </div>
    </ScrollArea>
  );
};
