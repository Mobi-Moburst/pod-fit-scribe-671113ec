import { ReportData } from "@/types/reports";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface CampaignOverviewSlideProps {
  campaignOverview: ReportData["campaign_overview"];
}

export const CampaignOverviewSlide = ({ campaignOverview }: CampaignOverviewSlideProps) => {
  return (
    <div className="w-full space-y-10 text-center max-w-4xl mx-auto">
      <h2 className="text-4xl md:text-5xl font-bold">Campaign Strategy</h2>
      
      {campaignOverview.strategy && (
        <MarkdownRenderer content={campaignOverview.strategy} className="text-xl md:text-2xl text-muted-foreground leading-relaxed" />
      )}

      {campaignOverview.talking_points && campaignOverview.talking_points.length > 0 && (
        <div className="space-y-6 pt-8">
          <h3 className="text-2xl font-semibold">Key Talking Points</h3>
          <div className="grid gap-4 text-left">
            {campaignOverview.talking_points.slice(0, 4).map((point, index) => (
              <div 
                key={index}
                className="flex items-start gap-4 bg-card border border-border rounded-xl p-5"
              >
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-medium">
                  {index + 1}
                </span>
                <p className="text-lg text-muted-foreground">{point}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};