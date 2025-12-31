import { ReportData } from "@/types/reports";
import { MessageSquare, Sparkles, Target } from "lucide-react";
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

        {/* Pitch Positioning & Core Hooks */}
        {campaignOverview.pitch_hooks && campaignOverview.pitch_hooks.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Pitch Positioning &amp; Core Hooks
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Repeatable hooks designed to resonate with each show's audience:
            </p>

            <div className="grid gap-4">
              {campaignOverview.pitch_hooks.map((speakerHooks, speakerIndex) => (
                <div key={speakerIndex} className="bg-muted/30 border border-border rounded-xl p-5 space-y-3">
                  <p className="font-medium text-foreground">{speakerHooks.speaker_name}</p>
                  <ul className="grid gap-2">
                    {speakerHooks.hooks.map((hook, hookIndex) => (
                      <li key={hookIndex} className="flex items-start gap-3 text-muted-foreground">
                        <span className="w-2 h-2 rounded-full bg-primary/40 mt-2 flex-shrink-0" />
                        <span>{hook}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
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
                <li key={index} className="flex items-start gap-3 text-muted-foreground">
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
