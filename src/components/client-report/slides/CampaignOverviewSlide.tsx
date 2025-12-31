import { ReportData } from "@/types/reports";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface CampaignOverviewSlideProps {
  campaignOverview: ReportData["campaign_overview"];
}

export const CampaignOverviewSlide = ({ campaignOverview }: CampaignOverviewSlideProps) => {
  const hasTalkingPoints = campaignOverview.talking_points && campaignOverview.talking_points.length > 0;
  const hasPitchHooks = campaignOverview.pitch_hooks && campaignOverview.pitch_hooks.length > 0;

  return (
    <div className="w-full space-y-6 text-center max-w-4xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-bold">Campaign Strategy</h2>

      {campaignOverview.strategy && (
        <MarkdownRenderer 
          content={campaignOverview.strategy} 
          className="text-lg md:text-xl text-muted-foreground leading-relaxed" 
        />
      )}

      {hasTalkingPoints && (
        <div className="space-y-4 pt-4">
          <h3 className="text-xl font-semibold">Key Talking Points</h3>
          <div className="grid gap-3 text-left">
            {campaignOverview.talking_points!.slice(0, 4).map((point, index) => (
              <div key={index} className="flex items-start gap-3 bg-card border border-border rounded-lg p-4">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-sm font-medium">
                  {index + 1}
                </span>
                <p className="text-base text-muted-foreground">{point}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasPitchHooks && (
        <div className="space-y-4 pt-4">
          <h3 className="text-xl font-semibold">Pitch Positioning &amp; Core Hooks</h3>
          <div className="grid gap-3 text-left">
            {campaignOverview.pitch_hooks!.slice(0, 2).map((speakerHooks, speakerIndex) => (
              <div key={speakerIndex} className="bg-card border border-border rounded-lg p-4 space-y-2">
                <p className="text-base font-semibold">{speakerHooks.speaker_name}</p>
                <ul className="space-y-1.5">
                  {speakerHooks.hooks.slice(0, 3).map((hook, hookIndex) => (
                    <li key={hookIndex} className="flex items-start gap-2 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-2 flex-shrink-0" />
                      <p className="text-sm">{hook}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
