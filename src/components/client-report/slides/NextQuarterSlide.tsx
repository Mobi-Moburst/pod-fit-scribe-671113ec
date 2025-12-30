import { ReportData } from "@/types/reports";
import { Compass } from "lucide-react";

interface NextQuarterSlideProps {
  strategy: NonNullable<ReportData["next_quarter_strategy"]>;
}

export const NextQuarterSlide = ({ strategy }: NextQuarterSlideProps) => {
  return (
    <div className="w-full space-y-10 max-w-4xl mx-auto text-center">
      <div className="space-y-4">
        <h2 className="text-4xl md:text-5xl font-bold">Looking Ahead</h2>
        <p className="text-2xl text-muted-foreground">{strategy.quarter}</p>
      </div>
      
      {strategy.intro_paragraph && (
        <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
          {strategy.intro_paragraph}
        </p>
      )}

      {strategy.strategic_focus_areas && strategy.strategic_focus_areas.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 text-left pt-4">
          {strategy.strategic_focus_areas.slice(0, 4).map((area, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-xl p-6 space-y-2"
            >
              <div className="flex items-center gap-3">
                <Compass className="h-5 w-5 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-lg">{area.title}</h3>
              </div>
              <p className="text-muted-foreground">{area.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};