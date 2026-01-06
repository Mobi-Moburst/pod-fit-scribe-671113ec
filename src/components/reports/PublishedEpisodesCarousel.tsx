import { useState, useEffect } from "react";
import { PodcastReportEntry } from "@/types/reports";
import { Badge } from "@/components/ui/badge";
import { Play, Clock, Podcast, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [currentIndex, setCurrentIndex] = useState(0);

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
    return `${minutes}m`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const goToPrev = () => {
    setCurrentIndex(prev => (prev === 0 ? publishedEpisodes.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev === publishedEpisodes.length - 1 ? 0 : prev + 1));
  };

  // Compact inline view - horizontal strip with thumbnails
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Podcast className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
            {publishedEpisodes.length}
          </Badge>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {publishedEpisodes.map((episode, index) => {
            const coverArt = episode.apple_podcast_link 
              ? coverArtCache[episode.apple_podcast_link] 
              : null;
            const isLoadingArt = episode.apple_podcast_link 
              ? loadingArt.has(episode.apple_podcast_link)
              : false;

            return (
              <a
                key={`${episode.show_title}-${index}`}
                href={episode.episode_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 group"
              >
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border/50 transition-all group-hover:border-primary/50 group-hover:scale-105">
                  {isLoadingArt ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : coverArt ? (
                    <img
                      src={coverArt}
                      alt={episode.show_title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                      <Podcast className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                  
                  {/* Play overlay on hover */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                    <div className="w-6 h-6 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-3 w-3 text-primary-foreground ml-0.5" />
                    </div>
                  </div>

                  {/* Duration badge */}
                  {episode.episode_duration_minutes && (
                    <div className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[8px] px-1 rounded">
                      {formatDuration(episode.episode_duration_minutes)}
                    </div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    );
  }

  // Standard view - single focus with navigation
  const currentEpisode = publishedEpisodes[currentIndex];
  const coverArt = currentEpisode.apple_podcast_link 
    ? coverArtCache[currentEpisode.apple_podcast_link] 
    : null;
  const isLoadingArt = currentEpisode.apple_podcast_link 
    ? loadingArt.has(currentEpisode.apple_podcast_link)
    : false;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Podcast className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <Badge variant="secondary" className="ml-auto text-xs">
          {publishedEpisodes.length} episode{publishedEpisodes.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        {/* Podcast artwork - smaller */}
        <a
          href={currentEpisode.episode_link}
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted group"
        >
          {isLoadingArt ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : coverArt ? (
            <img
              src={coverArt}
              alt={currentEpisode.show_title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
              <Podcast className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
          
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
              <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
            </div>
          </div>
        </a>

        {/* Episode info */}
        <div className="flex-1 min-w-0 space-y-1">
          <h5 className="font-medium text-sm text-foreground line-clamp-1">
            {currentEpisode.show_title}
          </h5>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {currentEpisode.date_published && (
              <span>{formatDate(currentEpisode.date_published)}</span>
            )}
            {currentEpisode.episode_duration_minutes && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(currentEpisode.episode_duration_minutes)}
                </span>
              </>
            )}
          </div>
          {currentEpisode.show_notes && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {currentEpisode.show_notes}
            </p>
          )}
        </div>

        {/* Navigation */}
        {publishedEpisodes.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrev}
              className="p-1.5 rounded-full hover:bg-muted transition-colors"
              aria-label="Previous episode"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
              {currentIndex + 1} / {publishedEpisodes.length}
            </span>
            <button
              onClick={goToNext}
              className="p-1.5 rounded-full hover:bg-muted transition-colors"
              aria-label="Next episode"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
