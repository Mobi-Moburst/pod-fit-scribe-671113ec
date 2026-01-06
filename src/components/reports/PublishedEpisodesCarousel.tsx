import { useState, useEffect } from "react";
import { PodcastReportEntry } from "@/types/reports";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, ExternalLink, Clock, Calendar, Podcast } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PublishedEpisodesCarouselProps {
  podcasts: PodcastReportEntry[];
  title?: string;
}

interface CoverArtCache {
  [url: string]: string | null;
}

export function PublishedEpisodesCarousel({ 
  podcasts, 
  title = "Published Episodes" 
}: PublishedEpisodesCarouselProps) {
  const [coverArtCache, setCoverArtCache] = useState<CoverArtCache>({});
  const [loadingArt, setLoadingArt] = useState<Set<string>>(new Set());

  // Filter to only published episodes with episode links
  const publishedEpisodes = podcasts.filter(
    p => p.date_published && p.episode_link
  );

  // Fetch cover art for a podcast
  const fetchCoverArt = async (appleUrl: string) => {
    if (coverArtCache[appleUrl] !== undefined || loadingArt.has(appleUrl)) {
      return;
    }

    setLoadingArt(prev => new Set(prev).add(appleUrl));

    try {
      const { data, error } = await supabase.functions.invoke('scrape-podcast-cover-art', {
        body: { apple_podcast_url: appleUrl }
      });

      if (!error && data?.coverArtUrl) {
        setCoverArtCache(prev => ({ ...prev, [appleUrl]: data.coverArtUrl }));
      } else {
        setCoverArtCache(prev => ({ ...prev, [appleUrl]: null }));
      }
    } catch (err) {
      console.error('Error fetching cover art:', err);
      setCoverArtCache(prev => ({ ...prev, [appleUrl]: null }));
    } finally {
      setLoadingArt(prev => {
        const next = new Set(prev);
        next.delete(appleUrl);
        return next;
      });
    }
  };

  // Fetch cover art for visible podcasts
  useEffect(() => {
    publishedEpisodes.forEach(episode => {
      if (episode.apple_podcast_link) {
        fetchCoverArt(episode.apple_podcast_link);
      }
    });
  }, [publishedEpisodes]);

  if (publishedEpisodes.length === 0) {
    return null;
  }

  const formatDuration = (minutes?: number) => {
    if (!minutes) return null;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${minutes} min`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Podcast className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-foreground">{title}</h4>
        <Badge variant="secondary" className="ml-auto">
          {publishedEpisodes.length} episode{publishedEpisodes.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {publishedEpisodes.map((episode, index) => {
            const coverArt = episode.apple_podcast_link 
              ? coverArtCache[episode.apple_podcast_link] 
              : null;
            const isLoadingArt = episode.apple_podcast_link 
              ? loadingArt.has(episode.apple_podcast_link)
              : false;

            return (
              <CarouselItem 
                key={`${episode.show_title}-${index}`}
                className="pl-2 md:pl-4 basis-[280px] md:basis-[300px]"
              >
                <Card className="overflow-hidden bg-card border h-full">
                  {/* Cover Art Section */}
                  <div className="relative aspect-square bg-muted">
                    {isLoadingArt ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : coverArt ? (
                      <img
                        src={coverArt}
                        alt={episode.show_title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                        <Podcast className="h-16 w-16 text-muted-foreground/50" />
                      </div>
                    )}
                    
                    {/* Duration Badge */}
                    {episode.episode_duration_minutes && (
                      <Badge 
                        className="absolute top-2 right-2 bg-black/70 text-white border-0"
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDuration(episode.episode_duration_minutes)}
                      </Badge>
                    )}

                    {/* Play Overlay Button */}
                    {episode.episode_link && (
                      <a
                        href={episode.episode_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors group"
                      >
                        <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all shadow-lg">
                          <Play className="h-6 w-6 text-primary-foreground ml-1" />
                        </div>
                      </a>
                    )}
                  </div>

                  {/* Content Section */}
                  <CardContent className="p-4 space-y-2">
                    <h5 className="font-semibold text-sm line-clamp-2 text-foreground leading-tight">
                      {episode.show_title}
                    </h5>
                    
                    {episode.date_published && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Published {formatDate(episode.date_published)}</span>
                      </div>
                    )}
                    
                    {episode.show_notes && (
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {episode.show_notes}
                      </p>
                    )}

                    {episode.episode_link && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        asChild
                      >
                        <a 
                          href={episode.episode_link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Listen Now
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        
        {publishedEpisodes.length > 1 && (
          <>
            <CarouselPrevious className="-left-4 hidden md:flex" />
            <CarouselNext className="-right-4 hidden md:flex" />
          </>
        )}
      </Carousel>
    </div>
  );
}
