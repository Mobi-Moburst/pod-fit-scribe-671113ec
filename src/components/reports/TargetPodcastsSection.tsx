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
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [hasGenerated, setHasGenerated] = useState(!!initialPodcasts?.length);
  const [coverArtCache, setCoverArtCache] = useState<Record<string, string>>({});
  const { toast } = useToast();
  
  // The quarter field stores the intended display quarter directly.
  // For valid quarter strings (e.g., "Q1 2026"), use as-is.
  // For empty values (custom date ranges), use static "Next Quarter" label.
  const hasValidQuarter = nextQuarterStrategy.quarter && /Q\d\s*\d{4}/.test(nextQuarterStrategy.quarter);
  const nextQuarterLabel = hasValidQuarter ? nextQuarterStrategy.quarter : "Next Quarter";

  // Fetch cover art for podcasts (and persist it into the podcast objects so it survives publish/present)
  useEffect(() => {
    let cancelled = false;

    const fetchCoverArt = async () => {
      for (const podcast of podcasts) {
        // If already persisted, nothing to do
        if (podcast.cover_art_url) continue;

        let coverArtUrl: string | undefined;

        // Try 1: Use the edge function if we have an Apple Podcast URL
        if (podcast.apple_podcast_url) {
          try {
            const { data, error } = await supabase.functions.invoke("scrape-podcast-cover-art", {
              body: { apple_podcast_url: podcast.apple_podcast_url },
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

        if (cancelled || !coverArtUrl) continue;

        // Cache for UI + persist into the actual podcast object for downstream pages
        setCoverArtCache((prev) => ({
          ...prev,
          [podcast.podcast_name]: coverArtUrl!,
        }));

        setPodcasts((prev) => {
          const next = prev.map((p) =>
            p.podcast_name === podcast.podcast_name
              ? { ...p, cover_art_url: p.cover_art_url ?? coverArtUrl }
              : p
          );
          onPodcastsGenerated?.(next);
          return next;
        });
      }
    };

    if (podcasts.length > 0) {
      fetchCoverArt();
    }

    return () => {
      cancelled = true;
    };
  }, [podcasts, onPodcastsGenerated]);

  // Helper function to validate a single podcast via iTunes
  const validatePodcast = async (p: any, twoMonthsAgo: Date): Promise<TargetPodcast | null> => {
    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(p.podcast_name)}&entity=podcast&limit=1`
      );
      const itunesData = await response.json();
      
      if (itunesData.results?.[0]) {
        const result = itunesData.results[0];
        const releaseDate = new Date(result.releaseDate);
        
        // Skip podcasts that haven't published in the last 2 months
        if (releaseDate < twoMonthsAgo) {
          console.warn(`Skipping inactive podcast: ${p.podcast_name} (last episode: ${result.releaseDate})`);
          return null;
        }
        
        return {
          podcast_name: p.podcast_name,
          description: p.description,
          pitch_angle: p.pitch_angle,
          talking_points: p.talking_points || [],
          target_audience: p.target_audience,
          apple_podcast_url: result.collectionViewUrl,
          cover_art_url: result.artworkUrl600 || result.artworkUrl100,
        };
      }
    } catch (err) {
      console.warn(`iTunes lookup failed for ${p.podcast_name}:`, err);
    }
    return null;
  };

  const generateSuggestions = async () => {
    setIsLoading(true);
    
    const MIN_PODCASTS = 10;
    const MAX_ATTEMPTS = 3;
    const allValidPodcasts: TargetPodcast[] = [];
    const excludeNames: string[] = [];
    
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS && allValidPodcasts.length < MIN_PODCASTS; attempt++) {
        console.log(`[Target Podcasts] Attempt ${attempt + 1}/${MAX_ATTEMPTS}, have ${allValidPodcasts.length}/${MIN_PODCASTS} valid podcasts`);
        
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
            num_suggestions: 15, // Request more to account for filtering
            exclude_podcasts: excludeNames, // Avoid duplicates
          }
        });

        if (error) {
          throw new Error(error.message || 'Failed to generate suggestions');
        }

        if (!data?.success || !data?.podcasts) {
          throw new Error(data?.error || 'Invalid response from AI');
        }

        const aiResponse = data.podcasts || [];
        
        // Validate each podcast via iTunes
        for (const p of aiResponse) {
          excludeNames.push(p.podcast_name); // Track to avoid re-suggesting
          
          const validatedPodcast = await validatePodcast(p, twoMonthsAgo);
          if (validatedPodcast) {
            allValidPodcasts.push(validatedPodcast);
            if (allValidPodcasts.length >= MIN_PODCASTS) {
              console.log(`[Target Podcasts] Reached ${MIN_PODCASTS} valid podcasts, stopping`);
              break;
            }
          }
        }
      }
      
      console.log(`[Target Podcasts] Final count: ${allValidPodcasts.length} valid podcasts`);
      
      const finalPodcasts = allValidPodcasts.slice(0, MIN_PODCASTS);
      setPodcasts(finalPodcasts);
      setHasGenerated(true);
      onPodcastsGenerated?.(finalPodcasts);

      toast({
        title: "Target podcasts generated",
        description: `Found ${finalPodcasts.length} podcast recommendations for ${nextQuarterLabel}.`,
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

  // Regenerate a single podcast recommendation
  const regenerateSinglePodcast = async (index: number) => {
    setRegeneratingIndex(index);
    
    const currentPodcast = podcasts[index];
    const excludeNames = podcasts.map(p => p.podcast_name);
    
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    try {
      // Request more suggestions to find a valid replacement
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
          num_suggestions: 5, // Request a few to find a valid one
          exclude_podcasts: excludeNames,
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate suggestion');
      }

      if (!data?.success || !data?.podcasts?.length) {
        throw new Error('No new podcasts found. Try regenerating all.');
      }

      // Validate suggestions until we find a valid one
      let newPodcast: TargetPodcast | null = null;
      for (const p of data.podcasts) {
        const validated = await validatePodcast(p, twoMonthsAgo);
        if (validated) {
          newPodcast = validated;
          break;
        }
      }

      if (!newPodcast) {
        throw new Error('Could not find an active replacement podcast. Try regenerating all.');
      }

      // Replace the podcast at the index
      const updatedPodcasts = [...podcasts];
      updatedPodcasts[index] = newPodcast;
      setPodcasts(updatedPodcasts);
      onPodcastsGenerated?.(updatedPodcasts);

      toast({
        title: "Podcast replaced",
        description: `Replaced "${currentPodcast.podcast_name}" with "${newPodcast.podcast_name}".`,
      });

    } catch (err) {
      console.error('Error regenerating single podcast:', err);
      toast({
        title: "Failed to regenerate",
        description: err instanceof Error ? err.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setRegeneratingIndex(null);
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
            Target Podcasts for {nextQuarterLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Mic className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
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
            Target Podcasts for {nextQuarterLabel}
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
          <p className="text-center text-sm text-muted-foreground mt-4">
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
          Target Podcasts for {nextQuarterLabel}
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
            <div key={index} className="flex gap-4 p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors relative group/item">
              {/* Individual Regenerate Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  regenerateSinglePodcast(index);
                }}
                disabled={regeneratingIndex !== null || isLoading}
                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover/item:opacity-100 transition-opacity print:hidden"
                title="Regenerate this recommendation"
              >
                <RefreshCw className={`h-4 w-4 ${regeneratingIndex === index ? 'animate-spin' : ''}`} />
              </Button>

              {/* Cover Art */}
              <div className="flex-shrink-0">
                {regeneratingIndex === index ? (
                  <Skeleton className="h-24 w-24 rounded-lg" />
                ) : getCoverArt(podcast) ? (
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
                {regeneratingIndex === index ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
