import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { X, Pencil } from "lucide-react";

interface CampaignOverviewProps {
  strategy: string;
  executive_summary?: string;
  target_audiences: string[];
  talking_points: string[];
  onHide?: () => void;
  onStrategyChange?: (value: string) => void;
  onExecutiveSummaryChange?: (value: string) => void;
}

export const CampaignOverview = ({ 
  strategy, 
  executive_summary,
  target_audiences, 
  talking_points,
  onHide,
  onStrategyChange,
  onExecutiveSummaryChange
}: CampaignOverviewProps) => {
  return (
    <Card className="group relative">
      {onHide && (
        <button
          onClick={onHide}
          className="absolute top-3 right-3 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted print:hidden"
          title="Hide section"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      <CardHeader>
        <CardTitle>Campaign Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {(strategy || onStrategyChange) && (
          <div className="group/edit relative">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              Campaign Strategy
              {onStrategyChange && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/edit:opacity-100 transition-opacity print:hidden" />}
            </h4>
            {onStrategyChange ? (
              <Textarea
                value={strategy}
                onChange={(e) => onStrategyChange(e.target.value)}
                className="min-h-[80px] text-sm text-muted-foreground leading-relaxed resize-none bg-transparent border-muted/50 focus:border-primary/50 print:border-none print:p-0"
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">{strategy}</p>
            )}
          </div>
        )}
        
        {(executive_summary || onExecutiveSummaryChange) && (
          <div className="group/edit relative">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              Executive Summary
              {onExecutiveSummaryChange && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/edit:opacity-100 transition-opacity print:hidden" />}
            </h4>
            {onExecutiveSummaryChange ? (
              <Textarea
                value={executive_summary || ''}
                onChange={(e) => onExecutiveSummaryChange(e.target.value)}
                className="min-h-[120px] text-sm text-muted-foreground leading-relaxed resize-none bg-transparent border-muted/50 focus:border-primary/50 print:border-none print:p-0"
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">{executive_summary}</p>
            )}
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
      </CardContent>
    </Card>
  );
};
