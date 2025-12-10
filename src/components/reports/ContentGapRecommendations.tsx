import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, X, Pencil, Check } from "lucide-react";
import { ContentGapAnalysis } from "@/types/reports";
import { MinimalClient } from "@/types/clients";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ContentGapRecommendationsProps {
  gapAnalysis: ContentGapAnalysis;
  client: MinimalClient;
  onUpdate: (recommendations: ContentGapAnalysis['ai_recommendations']) => void;
  onHide: () => void;
}

export function ContentGapRecommendations({ 
  gapAnalysis, 
  client, 
  onUpdate,
  onHide 
}: ContentGapRecommendationsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const { toast } = useToast();

  const recommendations = gapAnalysis.ai_recommendations || [];

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('content-gap-recommendations', {
        body: {
          client: {
            name: client.name,
            title: client.title,
            company: client.company,
            talking_points: client.talking_points,
            target_audiences: client.target_audiences,
            campaign_strategy: client.campaign_strategy,
          },
          gap_analysis: {
            total_gaps: gapAnalysis.total_gaps,
            coverage_percentage: gapAnalysis.coverage_percentage,
            gaps_by_stage: gapAnalysis.gaps_by_stage,
            gaps_by_topic: gapAnalysis.gaps_by_topic.slice(0, 10),
            top_competitors: gapAnalysis.top_competitors.slice(0, 10),
            priority_prompts: gapAnalysis.priority_prompts.slice(0, 10),
          }
        }
      });

      if (error) throw error;

      if (data?.recommendations) {
        onUpdate(data.recommendations);
        toast({
          title: "Recommendations generated",
          description: `Generated ${data.recommendations.length} strategic recommendations.`,
        });
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
      toast({
        title: "Failed to generate recommendations",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const startEditing = (index: number) => {
    const rec = recommendations[index];
    setEditingIndex(index);
    setEditedTitle(rec.title);
    setEditedDescription(rec.description);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    
    const updated = [...recommendations];
    updated[editingIndex] = {
      ...updated[editingIndex],
      title: editedTitle,
      description: editedDescription,
    };
    onUpdate(updated);
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditedTitle('');
    setEditedDescription('');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-accent text-accent-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <Card className="relative group">
      <button
        onClick={onHide}
        className="absolute top-4 right-4 p-1 rounded-full bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive print:hidden z-10"
        title="Hide this section"
      >
        <X className="h-3 w-3" />
      </button>
      
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          Content Gap Recommendations
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {recommendations.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              Generate AI-powered recommendations based on your content gaps to improve your podcast campaign approach.
            </p>
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Recommendations
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((rec, idx) => (
                <Card key={idx} className="relative">
                  {editingIndex === idx ? (
                    <CardContent className="pt-4 space-y-3">
                      <Input
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        placeholder="Recommendation title"
                      />
                      <Textarea
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        placeholder="Description"
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>
                          <Check className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  ) : (
                    <CardContent className="pt-4 space-y-3 group/card">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm">{rec.title}</h4>
                        <div className="flex items-center gap-1">
                          <Badge className={`text-xs ${getPriorityColor(rec.priority)}`}>
                            {rec.priority}
                          </Badge>
                          <button
                            onClick={() => startEditing(idx)}
                            className="p-1 rounded opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-muted print:hidden"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                      {rec.related_topics.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {rec.related_topics.slice(0, 3).map((topic, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
            
            <div className="flex justify-center pt-4 print:hidden">
              <Button 
                variant="outline" 
                onClick={handleGenerate} 
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Regenerate Recommendations
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
