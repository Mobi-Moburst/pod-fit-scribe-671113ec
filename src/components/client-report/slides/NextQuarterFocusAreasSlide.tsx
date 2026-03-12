import { ReportData } from "@/types/reports";
import { Compass } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface NextQuarterFocusAreasSlideProps {
  strategy: NonNullable<ReportData["next_quarter_strategy"]>;
}

export const NextQuarterFocusAreasSlide = ({ strategy }: NextQuarterFocusAreasSlideProps) => {
  if (!strategy.strategic_focus_areas || strategy.strategic_focus_areas.length === 0) return null;

  return (
    <div className="w-full space-y-8 max-w-4xl mx-auto px-4 py-6 flex flex-col justify-center h-full">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Compass className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-muted-foreground uppercase tracking-wider">
            Strategic Focus Areas
          </h3>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold">Where We're Headed</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {strategy.strategic_focus_areas.slice(0, 4).map((area, index) => (
          <div
            key={index}
            className="group bg-card border border-border hover:border-primary/30 rounded-xl p-5 space-y-2 transition-all duration-300"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                <Compass className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-lg mb-1">{area.title}</h4>
                <MarkdownRenderer content={area.description} className="text-sm text-muted-foreground leading-relaxed" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
