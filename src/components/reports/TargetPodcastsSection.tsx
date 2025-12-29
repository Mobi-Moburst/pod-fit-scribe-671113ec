import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Target, ExternalLink, Sparkles, RefreshCw, Mic } from 'lucide-react';
import { TargetPodcast } from '@/types/reports';
import { MinimalClient } from '@/types/clients';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TargetPodcastsSectionProps {
  client: MinimalClient;
  nextQuarterStrategy: {
    quarter: string;
    intro_paragraph: string;
    strategic_focus_areas: Array<{ title: string; description: string }>;
    talking_points_spotlight: Array<{ title: string; description: string }>;
    closing_paragraph: string;
  };
  topCategories?: Array<{ name: string; count: number }>;
  initialPodcasts?: TargetPodcast[];
  onPodcastsGenerated?: (podcasts: TargetPodcast[]) => void;
  onHide?: () => void;
}

export function TargetPodcastsSection({
  client,
  nextQuarterStrategy,
  topCategories,
  initialPodcasts,
  onPodcastsGenerated,
  onHide,
}: TargetPodcastsSectionProps) {
  const [podcasts, setPodcasts] = useState<TargetPodcast[]>(initialPodcasts || []);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(!!initialPodcasts?.length);
  const [coverArtCache, setCoverArtCache] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Fetch cover art for podcasts
  useEffect(() => {
    const fetchCoverArt = async () => {
      for (const podcast of podcasts) {
        if (coverArtCache[podcast.podcast_name]) continue;
        
        let coverArtUrl: string | undefined;
        
        // Try 1: Use the edge function if we have an Apple Podcast URL
        if (podcast.apple_podcast_url) {
          try {
            const { data, error } = await supabase.functions.invoke('scrape-podcast-cover-art', {
              body: { apple_podcast_url: podcast.apple_podcast_url }
            });
            
            if (!error && data?.coverArtUrl) {
              coverArtUrl = data.coverArtUrl;
            }
          } catch (err) {
            console.warn(`Edge function failed for ${podcast.podcast_name}:`, err);
          }
        }
        
        // Try 2: Fallback - search iTunes by name
        if (!coverArtUrl) {
          try {
            const response = await fetch(
              `https://itunes.apple.com/search?term=${encodeURIComponent(podcast.podcast_name)}&entity=podcast&limit=1`
            );
            const data = await response.json();
            
            if (data.results?.[0]?.artworkUrl600) {
              coverArtUrl = data.results[0].artworkUrl600;
            }
          } catch (err) {
            console.warn(`iTunes search failed for ${podcast.podcast_name}:`, err);
          }
        }
        
        // Update cache if we found cover art
        if (coverArtUrl) {
          setCoverArtCache(prev => ({
            ...prev,
            [podcast.podcast_name]: coverArtUrl
          }));
        }
      }
    };

    if (podcasts.length > 0) {
      fetchCoverArt();
    }
  }, [podcasts]);

  const generateSuggestions = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('suggest-target-podcasts', {
        body: {
          client: {
            name: client.name,
            company: client.company,
            title: client.title,
            talking_points: client.talking_points,
            target_audiences: client.target_audiences,
            campaign_strategy: client.campaign_strategy,
          },
          next_quarter_strategy: nextQuarterStrategy,
          top_categories: topCategories,
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate suggestions');
      }

      if (!data?.success || !data?.podcasts) {
        throw new Error(data?.error || 'Invalid response from AI');
      }

      const aiResponse = data.podcasts;
      
      // Look up real Apple Podcast URLs and cover art from iTunes for each podcast
      const newPodcasts: TargetPodcast[] = await Promise.all(
        aiResponse.map(async (p: any) => {
          let verifiedAppleUrl: string | undefined;
          let coverArtUrl: string | undefined;
          
          try {
            const response = await fetch(
              `https://itunes.apple.com/search?term=${encodeURIComponent(p.podcast_name)}&entity=podcast&limit=1`
            );
            const itunesData = await response.json();
            
            if (itunesData.results?.[0]) {
              verifiedAppleUrl = itunesData.results[0].collectionViewUrl;
              coverArtUrl = itunesData.results[0].artworkUrl600 || itunesData.results[0].artworkUrl100;
            }
          } catch (err) {
            console.warn(`iTunes lookup failed for ${p.podcast_name}:`, err);
          }
          
          return {
            podcast_name: p.podcast_name,
            description: p.description,
            pitch_angle: p.pitch_angle,
            talking_points: p.talking_points || [],
            target_audience: p.target_audience,
            apple_podcast_url: verifiedAppleUrl,
            cover_art_url: coverArtUrl,
          };
        })
      );

      setPodcasts(newPodcasts);
      setHasGenerated(true);
      onPodcastsGenerated?.(newPodcasts);

      toast({
        title: "Target podcasts generated",
        description: `Found ${newPodcasts.length} podcast recommendations for ${nextQuarterStrategy.quarter}.`,
      });

    } catch (err) {
      console.error('Error generating target podcasts:', err);
      toast({
        title: "Failed to generate suggestions",
        description: err instanceof Error ? err.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Search iTunes for Apple Podcast URL if not provided
  const searchiTunes = async (podcastName: string): Promise<string | undefined> => {
    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(podcastName)}&entity=podcast&limit=1`
      );
      const data = await response.json();
      
      if (data.results?.[0]?.collectionViewUrl) {
        return data.results[0].collectionViewUrl;
      }
    } catch (err) {
      console.warn(`iTunes search failed for ${podcastName}:`, err);
    }
    return undefined;
  };

  // Get cover art for a podcast (from cache or fetch)
  const getCoverArt = (podcast: TargetPodcast): string | undefined => {
    return coverArtCache[podcast.podcast_name] || podcast.cover_art_url;
  };

  if (!hasGenerated && !isLoading) {
    return (
      <Card className="relative group">
        {onHide && (
          <button
            onClick={onHide}
            className="absolute top-4 right-4 p-1 rounded-full bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive print:hidden z-10"
            title="Hide this section"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            Target Podcasts for {nextQuarterStrategy.quarter}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Mic className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Generate AI-powered podcast recommendations based on your next quarter strategy.
            </p>
            <Button onClick={generateSuggestions} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Target Podcasts
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="relative group">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            Target Podcasts for {nextQuarterStrategy.quarter}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-4 p-4 border rounded-lg">
                <Skeleton className="h-20 w-20 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-muted-foreground mt-4">
            <Sparkles className="h-4 w-4 inline mr-2 animate-pulse" />
            Generating podcast recommendations...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative group">
      {onHide && (
        <button
          onClick={onHide}
          className="absolute top-4 right-4 p-1 rounded-full bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive print:hidden z-10"
          title="Hide this section"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-accent" />
          Target Podcasts for {nextQuarterStrategy.quarter}
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={generateSuggestions}
          disabled={isLoading}
          className="print:hidden"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Regenerate
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {podcasts.map((podcast, index) => (
            <div key={index} className="flex gap-4 p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
              {/* Cover Art */}
              <div className="flex-shrink-0">
                {getCoverArt(podcast) ? (
                  <img
                    src={getCoverArt(podcast)}
                    alt={podcast.podcast_name}
                    className="h-24 w-24 rounded-lg object-cover shadow-md"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center">
                    <Mic className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Title and Link */}
                <div className="flex items-start gap-2 mb-2">
                  <h3 className="font-semibold text-lg leading-tight">
                    {podcast.apple_podcast_url ? (
                      <a
                        href={podcast.apple_podcast_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors inline-flex items-center gap-1"
                      >
                        {podcast.podcast_name}
                        <ExternalLink className="h-4 w-4 flex-shrink-0" />
                      </a>
                    ) : (
                      podcast.podcast_name
                    )}
                  </h3>
                </div>

                {/* Description */}
                <p className="text-muted-foreground text-sm mb-3">
                  {podcast.description}
                </p>

                {/* Pitch Angle */}
                <div className="mb-3">
                  <span className="font-medium text-sm">Pitch angle: </span>
                  <span className="text-sm">{podcast.pitch_angle}</span>
                </div>

                {/* Talking Points */}
                <div className="mb-3">
                  <span className="font-medium text-sm">Talking points: </span>
                  <span className="text-sm text-muted-foreground">
                    {podcast.talking_points.join(', ')}.
                  </span>
                </div>

                {/* Target Audience */}
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Target Audience:</span>
                  <Badge variant="secondary" className="text-xs">
                    {podcast.target_audience}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
