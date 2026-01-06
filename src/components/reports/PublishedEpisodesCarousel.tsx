import { useState, useEffect } from "react";
import { PodcastReportEntry } from "@/types/reports";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, ExternalLink, Clock, Calendar, Podcast } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PublishedEpisodesCarouselProps {
  podcasts: PodcastReportEntry[];
  title?: string;
  compact?: boolean;
}

interface CoverArtCache {
  [url: string]: string | null;
}

export function PublishedEpisodesCarousel({ 
  podcasts, 
  title = "Published Episodes This Quarter",
  compact = false
}: PublishedEpisodesCarouselProps) {
  const [coverArtCache, setCoverArtCache] = useState<CoverArtCache>({});
  const [loadingArt, setLoadingArt] = useState<Set<string>>(new Set());
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

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

  // Track carousel position
  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

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
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex items-center gap-2">
        <Podcast className={compact ? "h-4 w-4 text-primary" : "h-5 w-5 text-primary"} />
        <h4 className={`font-semibold text-foreground ${compact ? "text-base" : ""}`}>{title}</h4>
        <Badge variant="secondary" className="ml-auto text-xs">
          {publishedEpisodes.length} episode{publishedEpisodes.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="relative">
        <Carousel
          setApi={setApi}
          opts={{
            align: "center",
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent>
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
                  className="basis-full"
                >
                  <Card className={`overflow-hidden bg-card/50 border mx-auto ${compact ? "max-w-full" : "max-w-md"}`}>
                    {/* Cover Art Section */}
                    <div className={`relative bg-muted ${compact ? "aspect-[4/3]" : "aspect-square"}`}>
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
                          <Podcast className={compact ? "h-12 w-12 text-muted-foreground/50" : "h-16 w-16 text-muted-foreground/50"} />
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
                          <div className={`rounded-full bg-primary/90 flex items-center justify-center opacity-80 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all shadow-lg ${compact ? "w-12 h-12" : "w-16 h-16"}`}>
                            <Play className={compact ? "h-5 w-5 text-primary-foreground ml-0.5" : "h-7 w-7 text-primary-foreground ml-1"} />
                          </div>
                        </a>
                      )}
                    </div>

                    {/* Content Section */}
                    <CardContent className={compact ? "p-3 space-y-1.5" : "p-4 space-y-2"}>
                      <h5 className={`font-semibold text-foreground leading-tight ${compact ? "text-sm line-clamp-1" : "text-sm line-clamp-2"}`}>
                        {episode.show_title}
                      </h5>
                      
                      {episode.date_published && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(episode.date_published)}</span>
                        </div>
                      )}
                      
                      {!compact && episode.show_notes && (
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {episode.show_notes}
                        </p>
                      )}

                      {episode.episode_link && (
                        <Button
                          variant="outline"
                          size="sm"
                          className={`w-full ${compact ? "mt-1 h-8 text-xs" : "mt-2"}`}
                          asChild
                        >
                          <a 
                            href={episode.episode_link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
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
          
          {/* Always visible navigation arrows */}
          <CarouselPrevious className={compact ? "-left-3 h-8 w-8 border" : "-left-4 md:-left-5 h-10 w-10 border-2"} />
          <CarouselNext className={compact ? "-right-3 h-8 w-8 border" : "-right-4 md:-right-5 h-10 w-10 border-2"} />
        </Carousel>

        {/* Dot Indicators */}
        {publishedEpisodes.length > 1 && (
          <div className={`flex items-center justify-center gap-1.5 ${compact ? "mt-3" : "mt-4"}`}>
            {publishedEpisodes.map((_, index) => (
              <button
                key={index}
                onClick={() => api?.scrollTo(index)}
                className={`rounded-full transition-all ${
                  index === current 
                    ? `bg-primary ${compact ? "w-3 h-1.5" : "w-4 h-2"}` 
                    : `bg-muted-foreground/30 hover:bg-muted-foreground/50 ${compact ? "w-1.5 h-1.5" : "w-2 h-2"}`
                }`}
                aria-label={`Go to episode ${index + 1}`}
              />
            ))}
            <span className={`ml-2 text-muted-foreground ${compact ? "text-[10px]" : "text-xs"}`}>
              {current + 1} / {publishedEpisodes.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
