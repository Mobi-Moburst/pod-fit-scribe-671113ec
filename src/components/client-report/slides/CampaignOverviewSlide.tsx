import { ReportData } from "@/types/reports";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Target } from "lucide-react";

interface CampaignOverviewSlideProps {
  campaignOverview: ReportData["campaign_overview"];
}

export const CampaignOverviewSlide = ({ campaignOverview }: CampaignOverviewSlideProps) => {
  const hasTalkingPoints = campaignOverview.talking_points && campaignOverview.talking_points.length > 0;
  const hasPitchHooks = campaignOverview.pitch_hooks && campaignOverview.pitch_hooks.length > 0;
  const hasTargetAudiences = campaignOverview.target_audiences && campaignOverview.target_audiences.length > 0;
  
  const speakerCount = campaignOverview.pitch_hooks?.length || 0;
  const hooksPerSpeaker = speakerCount > 2 ? 2 : 3;

  const audienceCount = campaignOverview.target_audiences?.length || 0;

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-bold text-center">Campaign Strategy</h2>

      {/* Strategy and Talking Points side by side on larger screens */}
      <div className={`grid gap-6 ${hasTalkingPoints ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {campaignOverview.strategy && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-muted-foreground">Strategy</h3>
            <MarkdownRenderer 
              content={campaignOverview.strategy} 
              className="text-base text-muted-foreground leading-relaxed" 
            />
          </div>
        )}

        {hasTalkingPoints && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-muted-foreground">Key Talking Points</h3>
            <div className="space-y-2">
              {campaignOverview.talking_points!.slice(0, 4).map((point, index) => (
                <div key={index} className="flex items-start gap-2 bg-card border border-border rounded-lg p-3">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-xs font-medium">
                    {index + 1}
                  </span>
                  <p className="text-sm text-muted-foreground">{point}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Target Audience Breakdown - Card-based layout */}
      {hasTargetAudiences && (
        <div className="space-y-3 pt-2">
          <h3 className="text-lg font-semibold text-muted-foreground text-center">Target Audiences</h3>
          <div className={`grid gap-3 ${audienceCount === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 md:grid-cols-2'}`}>
            {campaignOverview.target_audiences!.map((audience, index) => (
              <div 
                key={index} 
                className="flex items-center gap-3 bg-card/50 backdrop-blur border border-border/50 rounded-xl p-4 hover:bg-card/70 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <p className="text-base font-medium">{audience}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasPitchHooks && (
        <div className="space-y-3 pt-2">
          <h3 className="text-lg font-semibold text-muted-foreground text-center">Pitch Positioning & Core Hooks</h3>
          <div className={`grid gap-3 ${speakerCount === 1 ? 'grid-cols-1 max-w-xl mx-auto' : speakerCount === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
            {campaignOverview.pitch_hooks!.map((speakerHooks, speakerIndex) => (
              <div key={speakerIndex} className="bg-card border border-border rounded-lg p-3 space-y-2 h-full">
                <p className="text-sm font-semibold">{speakerHooks.speaker_name}</p>
                <ul className="space-y-1">
                  {speakerHooks.hooks.slice(0, hooksPerSpeaker).map((hook, hookIndex) => (
                    <li key={hookIndex} className="flex items-start gap-2 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 flex-shrink-0" />
                      <p className="text-xs leading-relaxed">{hook}</p>
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