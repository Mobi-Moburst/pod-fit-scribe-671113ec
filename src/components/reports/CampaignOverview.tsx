import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Pencil } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

interface PitchHook {
  speaker_name: string;
  hooks: string[];
}

interface CampaignOverviewProps {
  strategy: string;
  executive_summary?: string;
  target_audiences: string[];
  talking_points: string[];
  pitch_hooks?: PitchHook[];
  onHide?: () => void;
  onEdit?: () => void;
}

export const CampaignOverview = ({ 
  strategy, 
  executive_summary,
  target_audiences, 
  talking_points,
  pitch_hooks,
  onHide,
  onEdit
}: CampaignOverviewProps) => {
  return (
    <Card className="group relative">
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-1 rounded-md hover:bg-muted"
            title="Edit section"
          >
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        {onHide && (
          <button
            onClick={onHide}
            className="p-1 rounded-md hover:bg-muted"
            title="Hide section"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
      <CardHeader>
        <CardTitle>Campaign Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {strategy && (
          <div>
            <h4 className="text-sm font-medium mb-2">Campaign Strategy</h4>
            <MarkdownRenderer content={strategy} className="text-sm text-muted-foreground leading-relaxed" />
          </div>
        )}
        
        {executive_summary && (
          <div>
            <MarkdownRenderer content={executive_summary} className="text-sm text-muted-foreground leading-relaxed" />
          </div>
        )}
        
        {target_audiences && target_audiences.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Target Audiences</h4>
            <div className="flex flex-wrap gap-2">
              {target_audiences.map((audience, idx) => (
                <Badge key={idx} variant="secondary">
                  {audience}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {talking_points && talking_points.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Key Talking Points</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {talking_points.map((point, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pitch_hooks && pitch_hooks.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Pitch Positioning & Core Hooks</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Each campaign leaned into clearly defined, repeatable hooks designed to resonate with the target audience of each show:
            </p>
            <div className="space-y-4">
              {pitch_hooks.map((speakerHooks, idx) => (
                <div key={idx}>
                  <p className="text-sm font-medium mb-2">{speakerHooks.speaker_name}:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                    {speakerHooks.hooks.map((hook, hookIdx) => (
                      <li key={hookIdx} className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>{hook}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
