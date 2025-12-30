import { ReportData } from "@/types/reports";
import { Compass, Lightbulb } from "lucide-react";

interface ClientReportNextQuarterProps {
  strategy: NonNullable<ReportData["next_quarter_strategy"]>;
}

export const ClientReportNextQuarter = ({ strategy }: ClientReportNextQuarterProps) => {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Looking Ahead: {strategy.quarter}</h2>
      
      <div className="bg-card border border-border rounded-2xl p-8 space-y-8">
        {/* Intro */}
        {strategy.intro_paragraph && (
          <p className="text-lg text-muted-foreground leading-relaxed">
            {strategy.intro_paragraph}
          </p>
        )}

        {/* Strategic Focus Areas */}
        {strategy.strategic_focus_areas && strategy.strategic_focus_areas.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              Strategic Focus Areas
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {strategy.strategic_focus_areas.map((area, index) => (
                <div 
                  key={index}
                  className="bg-muted/50 rounded-xl p-4 space-y-2"
                >
                  <h4 className="font-medium">{area.title}</h4>
                  <p className="text-sm text-muted-foreground">{area.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Talking Points Spotlight */}
        {strategy.talking_points_spotlight && strategy.talking_points_spotlight.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-accent" />
              Talking Points Spotlight
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {strategy.talking_points_spotlight.map((point, index) => (
                <div 
                  key={index}
                  className="bg-muted/50 rounded-xl p-4 space-y-2"
                >
                  <h4 className="font-medium">{point.title}</h4>
                  <p className="text-sm text-muted-foreground">{point.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Closing */}
        {strategy.closing_paragraph && (
          <p className="text-muted-foreground leading-relaxed border-t border-border pt-6">
            {strategy.closing_paragraph}
          </p>
        )}
      </div>
    </section>
  );
};