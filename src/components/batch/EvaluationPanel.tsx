import { BatchRow } from '@/types/batch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface EvaluationPanelProps {
  row: BatchRow | null;
  onClose: () => void;
}

export function EvaluationPanel({ row, onClose }: EvaluationPanelProps) {
  const { toast } = useToast();
  
  if (!row) return null;
  
  const getVerdictColor = (verdict?: string) => {
    switch (verdict) {
      case 'Fit': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'Consider': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'Not': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: `${label} copied to clipboard` });
  };
  
  const generatePitch = () => {
    // Placeholder for pitch generation
    toast({ description: 'Pitch generation coming soon!' });
  };
  
  return (
    <div className="border-l bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Evaluation Insights</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ×
        </Button>
      </div>
      
      <ScrollArea className="h-[calc(100vh-8rem)]">
        <div className="p-4 space-y-6">
          {/* Header Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="font-medium truncate">{row.show_title || 'Unknown Show'}</h4>
              <Button variant="ghost" size="sm" asChild>
                <a href={row.podcast_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {row.podcast_url}
            </div>
          </div>
          
          {/* Verdict & Score */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-3">
              <div className="text-sm text-muted-foreground">Verdict</div>
              {row.verdict && (
                <Badge className={cn('mt-1', getVerdictColor(row.verdict))}>
                  {row.verdict}
                </Badge>
              )}
            </Card>
            <Card className="p-3">
              <div className="text-sm text-muted-foreground">Score</div>
              <div className="text-lg font-semibold mt-1">
                {row.overall_score !== undefined ? Math.round(row.overall_score) : 'N/A'}
              </div>
            </Card>
          </div>
          
          {/* Confidence & Eligibility */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-3">
              <div className="text-sm text-muted-foreground">Confidence</div>
              <div className="text-lg font-semibold mt-1">
                {row.confidence !== undefined ? `${Math.round(row.confidence * 100)}%` : 'N/A'}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-muted-foreground">Eligibility</div>
              {row.eligibility_class ? (
                <div className="mt-1">
                  <Badge variant="outline" className="text-xs">
                    {row.eligibility_class.replace('_', ' ')}
                  </Badge>
                  {row.eligibility_action && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {row.eligibility_action}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm mt-1">Eligible</div>
              )}
            </Card>
          </div>
          
          {/* Publish Date */}
          {row.last_publish_date && (
            <Card className="p-3">
              <div className="text-sm text-muted-foreground">Last Published</div>
              <div className="mt-1">{row.last_publish_date}</div>
            </Card>
          )}
          
          <Separator />
          
          {/* Rationale */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium">Rationale</h5>
              {row.rationale_short && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(row.rationale_short!, 'Rationale')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              {row.rationale_short || 'No rationale available'}
            </div>
          </div>
          
          {/* Detailed Analysis */}
          {row.evaluation_data && (
            <>
              <Separator />
              <div>
                <h5 className="font-medium mb-3">Detailed Analysis</h5>
                
                {/* Why Fit */}
                {row.evaluation_data.why_fit && row.evaluation_data.why_fit.length > 0 && (
                  <div className="mb-4">
                    <h6 className="text-sm font-medium text-green-600 mb-2">Why This Fits</h6>
                    <ul className="space-y-1">
                      {row.evaluation_data.why_fit.map((reason: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start">
                          <span className="text-green-500 mr-2">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Why Not Fit */}
                {row.evaluation_data.why_not_fit && row.evaluation_data.why_not_fit.length > 0 && (
                  <div className="mb-4">
                    <h6 className="text-sm font-medium text-red-600 mb-2">Concerns</h6>
                    <ul className="space-y-1">
                      {row.evaluation_data.why_not_fit.map((reason: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start">
                          <span className="text-red-500 mr-2">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Risk Flags */}
                {row.evaluation_data.risk_flags && row.evaluation_data.risk_flags.length > 0 && (
                  <div className="mb-4">
                    <h6 className="text-sm font-medium text-orange-600 mb-2">Risk Flags</h6>
                    <ul className="space-y-1">
                      {row.evaluation_data.risk_flags.map((flag: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start">
                          <span className="text-orange-500 mr-2">⚠</span>
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Actions */}
          <Separator />
          <div className="space-y-2">
            <h5 className="font-medium">Actions</h5>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (row.evaluation_data?.summary_text) {
                    copyToClipboard(row.evaluation_data.summary_text, 'Summary');
                  } else {
                    copyToClipboard(row.rationale_short || '', 'Summary');
                  }
                }}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy Summary
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={generatePitch}
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                Generate Pitch
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}