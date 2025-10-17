import { useState } from "react";
import { AnalyzeResult } from "@/utils/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScoreBadge } from "./ScoreBadge";
import { Calendar, AlertTriangle, Copy, Send, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { MinimalClient } from "@/types/clients";

const SUPABASE_URL = "https://xjmcrvdczkefcbkayfbn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqbWNydmRjemtlZmNia2F5ZmJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2Nzk2NzEsImV4cCI6MjA3MDI1NTY3MX0.AGAIZWrqXrYXJtgdwuduOAqAPZX743vM3JT_EVCMtzo";

export const ResultsPanel = ({
  result,
  onSave,
  onCopySummary,
  onExportJson,
  client,
  podcastUrl,
  showNotes,
}: {
  result: AnalyzeResult & { show_title?: string };
  onSave: () => void;
  onCopySummary: () => void;
  onExportJson: () => void;
  client?: MinimalClient | null;
  podcastUrl?: string;
  showNotes?: string;
}) => {
  const { toast } = useToast();
  const [generatingPitch, setGeneratingPitch] = useState(false);
  const [generatedPitch, setGeneratedPitch] = useState<string | null>(null);
  const [pitchMessages, setPitchMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const {
    overall_score,
    rubric_breakdown,
    show_title,
    scored_by,
    confidence,
    verdict,
    verdict_reason,
    why_fit_structured,
    why_not_fit_structured,
    risk_flags_structured,
    why_fit,
    why_not_fit,
    risk_flags,
    recommended_talking_points,
    confidence_label,
    confidence_note,
    what_would_change,
  } = result;

  const verdictLabel = verdict === 'recommend' ? 'Recommend' : verdict === 'consider' ? 'Consider' : verdict === 'not_recommended' ? 'Not recommended' : undefined;
  const verdictVariant: 'default' | 'secondary' | 'outline' | undefined = verdict === 'recommend' ? 'default' : verdict === 'consider' ? 'secondary' : verdict === 'not_recommended' ? 'outline' : undefined;

  const fitItems = (why_fit_structured && why_fit_structured.length
    ? why_fit_structured
    : (why_fit || []).map((s) => ({ claim: s, evidence: '', interpretation: '' }))
  ).slice(0, 5);

  const notFitItems = (why_not_fit_structured && why_not_fit_structured.length
    ? why_not_fit_structured
    : (why_not_fit || []).map((s) => ({ severity: 'Minor' as const, claim: s, evidence: '', interpretation: '' }))
  ).slice(0, 4);

  const riskItems = (risk_flags_structured && risk_flags_structured.length
    ? risk_flags_structured
    : (risk_flags || []).map((r) => ({ severity: 'Minor' as const, flag: r, mitigation: '' }))
  ).slice(0, 6);

  const buildGmailUrl = (email: string, pitchHtml: string, clientName: string) => {
    const plainText = pitchHtml
      .replace(/<p[^>]*>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/?(ul|ol|div|h[1-6]|span|strong|em|b|i)[^>]*>/gi, '')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    const subject = encodeURIComponent(`Podcast Guest Pitch: ${clientName}`);
    const body = encodeURIComponent(plainText);
    const gmailUrl = `mailto:${email}?subject=${subject}&body=${body}`;
    
    if (gmailUrl.length > 2000) {
      copyToClipboard(pitchHtml, 'Full pitch');
      return `mailto:${email}?subject=${subject}&body=${encodeURIComponent('See full pitch in clipboard')}`;
    }
    
    return gmailUrl;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      const htmlBlob = new Blob([text], { type: 'text/html' });
      const plainBlob = new Blob([text.replace(/<[^>]*>/g, '')], { type: 'text/plain' });
      
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': plainBlob,
        }),
      ]);
      
      toast({ description: `${label} copied to clipboard` });
    } catch {
      navigator.clipboard.writeText(text);
      toast({ description: `${label} copied to clipboard (plain text)` });
    }
  };

  const generatePitch = async () => {
    if (!client) {
      toast({
        title: 'Cannot generate pitch',
        description: 'No client selected',
        variant: 'destructive'
      });
      return;
    }
    
    setGeneratingPitch(true);
    setGeneratedPitch(null);
    
    try {
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
              show_title: result.show_title || 'the podcast',
              show_notes_excerpt: showNotes?.slice(0, 500) || '',
              podcast_url: podcastUrl || 'manual',
              host_name: 'the host',
            },
            evaluation: {
              verdict: result.verdict,
              overall_score: result.overall_score,
              evaluation_data: result,
              rationale_short: (result as any).summary_text || result.verdict_reason,
            }
          })
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        let errorDescription = data.message || 'Please try again';
        
        if (data.message?.includes('Rate limit')) {
          errorDescription = 'Too many requests. Please wait a moment and try again.';
        } else if (data.message?.includes('402') || data.message?.includes('credits')) {
          errorDescription = 'Please add credits to your Lovable AI workspace in Settings.';
        }
        
        toast({
          title: 'Failed to generate pitch',
          description: errorDescription,
          variant: 'destructive'
        });
        return;
      }

      if (data?.pitch) {
        setGeneratedPitch(data.pitch);
        setPitchMessages([{ role: 'assistant', content: data.pitch }]);
        toast({
          title: 'Pitch generated!',
          description: 'Review and copy the pitch below'
        });
      }
    } catch (error) {
      toast({
        title: 'Failed to generate pitch',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setGeneratingPitch(false);
    }
  };

  const refinePitch = async () => {
    if (!refinementPrompt.trim() || !generatedPitch || !client) return;
    
    setIsRefining(true);
    
    try {
      const messages = [
        ...pitchMessages,
        { role: 'user' as const, content: refinementPrompt }
      ];
      
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
              show_title: result.show_title || 'the podcast',
              show_notes_excerpt: showNotes?.slice(0, 500) || '',
              podcast_url: podcastUrl || 'manual',
              host_name: 'the host',
            },
            evaluation: {
              verdict: result.verdict,
              overall_score: result.overall_score,
              evaluation_data: result,
              rationale_short: (result as any).summary_text || result.verdict_reason,
            },
            messages
          })
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        toast({
          title: 'Failed to refine pitch',
          description: data.message || 'Please try again',
          variant: 'destructive'
        });
        return;
      }

      if (data?.pitch) {
        setGeneratedPitch(data.pitch);
        setPitchMessages([...messages, { role: 'assistant', content: data.pitch }]);
        setRefinementPrompt('');
        toast({ description: 'Pitch refined successfully' });
      }
    } catch (error) {
      toast({
        title: 'Failed to refine pitch',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <section className="mt-6 grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <ScoreBadge score={overall_score} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold">{show_title || 'Analysis Result'}</h2>
              {verdictLabel && <Badge variant={verdictVariant}>{`Verdict: ${verdictLabel}`}</Badge>}
              <Badge variant="outline">{scored_by === 'ai' ? 'AI model' : 'Local heuristic'}</Badge>
              {typeof confidence === 'number' && (
                <Badge variant="secondary">{Math.round(confidence * 100)}% conf</Badge>
              )}
              {result.confidence_label && (
                <Badge variant="secondary">{result.confidence_label}</Badge>
              )}
              {(result as any).last_publish_date && (() => {
                const date = new Date((result as any).last_publish_date);
                const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
                const isStale = daysSince > 90;
                const formatRelativeTime = (days: number) => {
                  if (days < 1) return "Today";
                  if (days < 2) return "Yesterday";
                  if (days < 7) return `${Math.floor(days)} days ago`;
                  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
                  if (days < 365) return `${Math.floor(days / 30)} months ago`;
                  return `${Math.floor(days / 365)} years ago`;
                };
                return (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isStale ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Calendar className="w-4 h-4" />
                    )}
                    <span>
                      Published {date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} 
                      ({formatRelativeTime(daysSince)})
                      {isStale && <span className="text-amber-600 ml-1">- Stale content ({Math.floor(daysSince)}d)</span>}
                    </span>
                  </div>
                );
              })()}
            </div>
            <p className="text-sm text-muted-foreground mt-2">Goal-centric fit using concept sets and near matches.</p>
            {result.scored_by !== 'ai' && result.fallback_reason && (
              <div className="mt-1">
                <Badge variant="outline">LLM unavailable: {result.fallback_reason}</Badge>
              </div>
            )}
            {verdict_reason && (
              <p className="text-sm mt-1">{verdict_reason}</p>
            )}
            {Array.isArray(result.applied_adjustments) && result.applied_adjustments.filter((a: any) => a.type !== 'cap').length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {result.applied_adjustments.filter((adj: any) => adj.type !== 'cap').map((adj: any, i: number) => (
                  <Badge key={i} variant={adj.type === 'floor' ? 'secondary' : 'outline'}>
                    {adj.type?.toUpperCase?.() || 'ADJ'}: {adj.label}{typeof adj.amount === 'number' ? ` (${adj.amount > 0 ? '+' : ''}${adj.amount.toFixed(1)})` : ''}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="hero" onClick={onSave}>Save to History</Button>
          <Button variant="outline" onClick={onExportJson}>Export JSON</Button>
          <Button variant="outline" onClick={onCopySummary}>Copy Summary</Button>
        </div>
      </div>

      {/* Rubric */}
      <div className="grid md:grid-cols-5 gap-4">
        {rubric_breakdown
          .filter((r) => !/recency|consistency/i.test(r.dimension))
          .map((r) => (
            <Card key={r.dimension} className="p-4 card-surface">
              <div className="text-sm text-muted-foreground">{r.dimension}</div>
              <div className="text-2xl font-semibold mt-1">{r.raw_score.toFixed(1)}</div>
              <p className="text-sm mt-2">{r.notes}</p>
            </Card>
          ))}
      </div>

      {/* Fit vs Gaps */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Why it fits</h3>
          <ul className="space-y-2">
            {fitItems.map((w: any, i: number) => (
              <li key={i}>
                <div className="font-medium">{w.claim}</div>
                {w.evidence && <blockquote className="text-sm text-muted-foreground border-l pl-3 mt-1">“{w.evidence}”</blockquote>}
                {w.interpretation && <div className="text-sm mt-1">{w.interpretation}</div>}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Why it doesn’t</h3>
          <ul className="space-y-2">
            {notFitItems.map((w: any, i: number) => (
              <li key={i}>
                <div className="flex items-center gap-2">
                  <div className="font-medium">{w.claim}</div>
                  {w.severity && <Badge variant="outline">{w.severity}</Badge>}
                </div>
                {w.evidence && <blockquote className="text-sm text-muted-foreground border-l pl-3 mt-1">“{w.evidence}”</blockquote>}
                {w.interpretation && <div className="text-sm mt-1">{w.interpretation}</div>}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Recommendation</h3>
          <div className="flex items-center gap-2">
            <Badge variant={verdictVariant || 'outline'}>{verdictLabel || (overall_score >= 7.5 && (risk_flags?.length ?? 0) === 0 ? 'Recommend' : 'Not recommended')}</Badge>
            <span className="text-sm text-muted-foreground">{verdict_reason || 'Based on overall score and risk flags.'}</span>
          </div>
        </Card>
      </div>

      {/* Actions & Risks */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Talking Points to Pitch</h3>
          <ul className="list-disc pl-5 space-y-1">
            {(recommended_talking_points || []).slice(0,5).map((t, i) => (<li key={i}>{t}</li>))}
          </ul>
        </Card>
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Risk Flags</h3>
          <ul className="space-y-2">
            {riskItems.map((r: any, i: number) => (
              <li key={i} className="flex items-start gap-2">
                {r.severity && <Badge variant="outline" className="shrink-0">{r.severity}</Badge>}
                <div className="text-sm">
                  <div className="font-medium">{r.flag || r}</div>
                  {r.mitigation && <div className="text-muted-foreground">Mitigation: {r.mitigation}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4 card-surface">
          <h3 className="text-lg font-semibold mb-2">Confidence & Next Checks</h3>
          <div className="flex items-center gap-2">
            {confidence_label && <Badge variant="secondary">{confidence_label}</Badge>}
            {typeof confidence === 'number' && <span className="text-sm text-muted-foreground">{Math.round(confidence * 100)}% modeled</span>}
          </div>
          {confidence_note && <p className="text-sm mt-2">{confidence_note}</p>}
          {Array.isArray(what_would_change) && what_would_change.length > 0 && (
            <div className="mt-3">
              <div className="text-sm font-medium mb-1">What would change the verdict</div>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {what_would_change.slice(0,2).map((w, i) => (<li key={i}>{w}</li>))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      {/* Pitch Generation Section */}
      {client && (
        <Card className="p-6 card-surface">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Personalized Pitch
            </h3>
            {!generatedPitch && (
              <Button
                variant="hero"
                onClick={generatePitch}
                disabled={generatingPitch}
              >
                {generatingPitch && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {generatingPitch ? 'Generating...' : 'Generate Pitch'}
              </Button>
            )}
          </div>

          {generatingPitch && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Crafting personalized pitch...
            </div>
          )}

          {generatedPitch && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-background">
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: generatedPitch }}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => copyToClipboard(generatedPitch, 'Pitch')}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy to Clipboard
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    toast({ 
                      title: 'Email needed',
                      description: 'Copy the pitch and paste into your email client.',
                      variant: 'default' 
                    });
                    copyToClipboard(generatedPitch, 'Pitch');
                  }}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Send Email
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">Refine the pitch</label>
                <Textarea
                  placeholder="E.g., 'Make it more casual' or 'Emphasize the technical expertise'"
                  value={refinementPrompt}
                  onChange={(e) => setRefinementPrompt(e.target.value)}
                  rows={2}
                  disabled={isRefining}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={refinePitch}
                  disabled={!refinementPrompt.trim() || isRefining}
                >
                  {isRefining && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {isRefining ? 'Refining...' : 'Refine Pitch'}
                </Button>
              </div>
            </div>
          )}

          {!generatedPitch && !generatingPitch && (
            <p className="text-sm text-muted-foreground">
              Generate a personalized pitch email based on this evaluation and your client's profile.
            </p>
          )}
        </Card>
      )}
    </section>
  );
};
