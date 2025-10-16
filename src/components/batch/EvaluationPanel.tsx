import { useState } from 'react';
import { BatchRow } from '@/types/batch';
import { MinimalClient } from '@/types/clients';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, ExternalLink, MessageCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = "https://xjmcrvdczkefcbkayfbn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqbWNydmRjemtlZmNia2F5ZmJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2Nzk2NzEsImV4cCI6MjA3MDI1NTY3MX0.AGAIZWrqXrYXJtgdwuduOAqAPZX743vM3JT_EVCMtzo";

interface EvaluationPanelProps {
  row: BatchRow | null;
  onClose: () => void;
  client: MinimalClient | null;
}

export function EvaluationPanel({ row, onClose, client }: EvaluationPanelProps) {
  const { toast } = useToast();
  const [generatingPitch, setGeneratingPitch] = useState(false);
  const [generatedPitch, setGeneratedPitch] = useState<string | null>(null);
  
  if (!row) return null;
  
  const getVerdictColor = (verdict?: string) => {
    switch (verdict) {
      case 'Fit': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'Consider': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'Not': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };
  
  const copyToClipboard = async (text: string, label: string) => {
    try {
      // Create HTML blob for rich text copying
      const htmlBlob = new Blob([text], { type: 'text/html' });
      const plainBlob = new Blob([text.replace(/<[^>]*>/g, '')], { type: 'text/plain' });
      
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': plainBlob,
        }),
      ]);
      
      toast({ description: `${label} copied to clipboard` });
    } catch (err) {
      // Fallback to plain text if HTML copy fails
      navigator.clipboard.writeText(text);
      toast({ description: `${label} copied to clipboard (plain text)` });
    }
  };
  
  const generatePitch = async () => {
    if (!client || !row) {
      toast({
        title: 'Cannot generate pitch',
        description: 'Missing client or podcast data',
        variant: 'destructive'
      });
      return;
    }
    
    console.log('🎯 Generating pitch for:', {
      client: client.name,
      podcast: row.show_title,
      has_template: !!client.pitch_template,
      client_data: {
        name: client.name,
        company: client.company,
        media_kit: client.media_kit_url,
        talking_points_count: client.talking_points?.length || 0,
      }
    });
    
    setGeneratingPitch(true);
    setGeneratedPitch(null);
    
    try {
      // Use direct fetch with explicit authorization headers
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-pitch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            client: {
              name: client.name,
              title: client.title,
              company: client.company,
              company_url: client.company_url,
              media_kit_url: client.media_kit_url,
              talking_points: client.talking_points,
              target_audiences: client.target_audiences,
              campaign_strategy: client.campaign_strategy,
              notes: client.notes,
              pitch_template: client.pitch_template,
            },
            podcast: {
              show_title: row.show_title,
              show_notes_excerpt: row.show_notes_fallback || row.evaluation_data?.show_notes_excerpt,
              podcast_url: row.podcast_url,
              host_name: row.metadata?.publisher || 'the host',
            },
            evaluation: {
              verdict: row.verdict,
              overall_score: row.overall_score,
              evaluation_data: row.evaluation_data,
              rationale_short: row.rationale_short,
            }
          })
        }
      );

      const data = await response.json();
      const error = !response.ok ? data : null;

      // Enhanced error handling
      if (error) {
        console.error('❌ Pitch generation error:', {
          error,
          message: error.message,
          details: error
        });
        
        let errorTitle = 'Failed to generate pitch';
        let errorDescription = error.message || 'Please try again';
        
        // Provide specific error messages based on error type
        if (error.message?.includes('Failed to send a request to the Edge Function')) {
          errorTitle = 'Service Unavailable';
          errorDescription = 'The pitch generation service is not yet deployed. Please refresh the page and try again in a moment.';
        } else if (error.message?.includes('Rate limit')) {
          errorTitle = 'Rate Limit Exceeded';
          errorDescription = 'Too many requests. Please wait a moment and try again.';
        } else if (error.message?.includes('402') || error.message?.includes('credits')) {
          errorTitle = 'AI Credits Depleted';
          errorDescription = 'Please add credits to your Lovable AI workspace in Settings.';
        } else if (error.message?.includes('timeout')) {
          errorTitle = 'Request Timeout';
          errorDescription = 'The request took too long. Please try again.';
        }
        
        toast({
          title: errorTitle,
          description: errorDescription,
          variant: 'destructive'
        });
        return;
      }

      // Check if we got valid data back
      if (!data) {
        console.error('❌ No data returned from edge function');
        toast({
          title: 'No Response',
          description: 'The pitch service returned no data. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      if (data?.pitch) {
        console.log('✅ Pitch generated successfully, length:', data.pitch.length);
        setGeneratedPitch(data.pitch);
        toast({
          title: 'Pitch generated!',
          description: 'Review and copy the pitch below'
        });
      } else {
        console.error('❌ No pitch in response data:', data);
        toast({
          title: 'Invalid Response',
          description: 'The service returned an unexpected response format.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('❌ Unexpected pitch generation error:', {
        error,
        type: typeof error,
        message: error instanceof Error ? error.message : String(error)
      });
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred';
      
      let errorTitle = 'Failed to generate pitch';
      let errorDescription = errorMessage;
      
      // Handle specific error scenarios
      if (errorMessage.includes('Failed to send a request')) {
        errorTitle = 'Service Unavailable';
        errorDescription = 'The pitch generation service is currently unavailable. This usually means the service needs to be deployed. Please refresh and try again in a moment.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorTitle = 'Network Error';
        errorDescription = 'Unable to connect to the pitch service. Please check your connection and try again.';
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive'
      });
    } finally {
      setGeneratingPitch(false);
    }
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
            <div className="text-sm text-muted-foreground break-all">
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
              <div className="mt-1">
                {new Date(row.last_publish_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
            </Card>
          )}
          
          <Separator />
          
          {/* Rationale */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium">Rationale</h5>
              {(row.evaluation_data?.summary_text || row.rationale_short) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(
                    row.evaluation_data?.summary_text || row.rationale_short!,
                    'Rationale'
                  )}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              {row.evaluation_data?.summary_text || row.rationale_short || 'No rationale available'}
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
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-green-500 shrink-0">•</span>
                          <span className="break-words">{reason}</span>
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
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-red-500 shrink-0">•</span>
                          <span className="break-words">{reason}</span>
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
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-orange-500 shrink-0">⚠</span>
                          <span className="break-words">{flag}</span>
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
                disabled={generatingPitch || !client}
              >
                {generatingPitch ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <MessageCircle className="h-3 w-3 mr-1" />
                )}
                Generate Pitch
              </Button>
            </div>
            
            {/* Show generated pitch */}
            {generatedPitch && (
              <Card className="p-3 mt-3 bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="text-sm font-medium">Generated Pitch</h6>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      copyToClipboard(generatedPitch, 'Pitch');
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div 
                  className="text-xs text-muted-foreground max-h-96 overflow-y-auto [&_p]:my-3 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-3 [&_ul]:pl-1 [&_li]:my-1.5 [&_li]:pl-1 [&_a]:text-blue-400 [&_a]:underline [&_a]:hover:text-blue-300 [&_a]:cursor-pointer"
                  dangerouslySetInnerHTML={{ __html: generatedPitch }}
                />
              </Card>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}