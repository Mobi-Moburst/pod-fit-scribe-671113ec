import { ReportData } from "@/types/reports";
import { Target, MessageSquare } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface ClientReportCampaignOverviewProps {
  campaignOverview: ReportData["campaign_overview"];
}

export const ClientReportCampaignOverview = ({ campaignOverview }: ClientReportCampaignOverviewProps) => {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Campaign Overview</h2>
      
      <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
        {/* Strategy */}
        {campaignOverview.strategy && (
          <div className="space-y-2">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Strategy
            </h3>
            <MarkdownRenderer content={campaignOverview.strategy} className="text-muted-foreground leading-relaxed" />
          </div>
        )}

        {/* Executive Summary */}
        {campaignOverview.executive_summary && (
          <div className="space-y-2">
            <MarkdownRenderer content={campaignOverview.executive_summary} className="text-foreground leading-relaxed" />
          </div>
        )}

        {/* Talking Points */}
        {campaignOverview.talking_points && campaignOverview.talking_points.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-accent" />
              Key Talking Points
            </h3>
            <ul className="grid gap-2">
              {campaignOverview.talking_points.map((point, index) => (
                <li 
                  key={index}
                  className="flex items-start gap-3 text-muted-foreground"
                >
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};