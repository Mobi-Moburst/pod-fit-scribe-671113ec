import { Play, Video, Music, ExternalLink, User, Headphones } from 'lucide-react';
import { HighlightClip } from '@/types/reports';
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';

interface ClientReportHighlightsProps {
  clips: HighlightClip[];
  companyName?: string;
}

interface CoverArtCache {
  [url: string]: { coverArtUrl: string | null; podcastName?: string } | null;
}

function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function getVimeoVideoId(url: string): string | null {
  const regExp = /vimeo\.com\/(?:video\/)?(\d+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

function isApplePodcastUrl(url: string): boolean {
  return url.includes('podcasts.apple.com');
}

function MediaPlayer({ clip, coverArt }: { clip: HighlightClip; coverArt?: string | null }) {
  const [isPlaying, setIsPlaying] = useState(false);

  // YouTube embed
  if (clip.source_type === 'youtube') {
    const videoId = getYouTubeVideoId(clip.url);
    if (videoId) {
      return (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={clip.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      );
    }
  }

  // Vimeo embed
  if (clip.source_type === 'vimeo') {
    const videoId = getVimeoVideoId(clip.url);
    if (videoId) {
      return (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
          <iframe
            src={`https://player.vimeo.com/video/${videoId}`}
            title={clip.title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      );
    }
  }

  // Descript embed
  if (clip.source_type === 'descript') {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <iframe
          src={clip.url}
          title={clip.title}
          allow="autoplay; fullscreen"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  // Direct video upload
  if (clip.media_type === 'video' && clip.source_type === 'upload') {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <video
          src={clip.url}
          controls
          className="w-full h-full object-contain"
          poster={clip.thumbnail_url}
        />
      </div>
    );
  }

  // Audio upload with direct file (playable)
  if (clip.media_type === 'audio' && clip.source_type === 'upload') {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex flex-col items-center justify-center p-6 gap-4">
        {clip.thumbnail_url ? (
          <img 
            src={clip.thumbnail_url} 
            alt={clip.title} 
            className="w-24 h-24 rounded-lg object-cover shadow-lg"
          />
        ) : (
          <div className="w-24 h-24 rounded-lg bg-primary/10 flex items-center justify-center">
            <Music className="w-12 h-12 text-primary" />
          </div>
        )}
        <audio src={clip.url} controls className="w-full max-w-xs" />
      </div>
    );
  }

  // External audio links (Apple Podcasts, etc.) - show as clickable card with cover art
  if (clip.media_type === 'audio' && (clip.source_type === 'external' || isApplePodcastUrl(clip.url))) {
    return (
      <a
        href={clip.url}
        target="_blank"
        rel="noopener noreferrer"
        className="aspect-video w-full rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex flex-col items-center justify-center gap-4 hover:from-primary/30 hover:to-primary/10 transition-colors group"
      >
        {coverArt ? (
          <img 
            src={coverArt} 
            alt={clip.title} 
            className="w-28 h-28 rounded-xl object-cover shadow-lg group-hover:scale-105 transition-transform"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : clip.thumbnail_url ? (
          <img 
            src={clip.thumbnail_url} 
            alt={clip.title} 
            className="w-28 h-28 rounded-xl object-cover shadow-lg group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-28 h-28 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Headphones className="w-14 h-14 text-primary" />
          </div>
        )}
        <span className="text-sm text-muted-foreground flex items-center gap-2 font-medium">
          Listen on Apple Podcasts <ExternalLink className="w-4 h-4" />
        </span>
      </a>
    );
  }

  // Fallback for other external links
  return (
    <a
      href={clip.url}
      target="_blank"
      rel="noopener noreferrer"
      className="aspect-video w-full rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex flex-col items-center justify-center gap-4 hover:from-primary/30 hover:to-primary/10 transition-colors"
    >
      <Play className="w-16 h-16 text-primary" />
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        Open in new tab <ExternalLink className="w-4 h-4" />
      </span>
    </a>
  );
}

function ClipCard({ clip, coverArt }: { clip: HighlightClip; coverArt?: string | null }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm h-full">
      <MediaPlayer clip={clip} coverArt={coverArt} />
      <div className="p-4 space-y-2">
        <h3 className="font-medium text-foreground line-clamp-2">{clip.title}</h3>
        {clip.podcast_name && (
          <p className="text-sm text-muted-foreground">{clip.podcast_name}</p>
        )}
        {clip.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{clip.description}</p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
            {clip.media_type}
          </span>
          {clip.duration_seconds && (
            <span className="text-xs text-muted-foreground">
              {Math.floor(clip.duration_seconds / 60)}:{String(clip.duration_seconds % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface SpeakerCarouselProps {
  speakerName: string;
  clips: HighlightClip[];
  coverArtCache: CoverArtCache;
}

function SpeakerCarousel({ speakerName, clips, coverArtCache }: SpeakerCarouselProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-lg font-medium text-foreground">{speakerName}</h3>
        <span className="text-sm text-muted-foreground">
          ({clips.length} clip{clips.length !== 1 ? 's' : ''})
        </span>
      </div>
      
      <div className="px-12">
        <Carousel
          opts={{
            align: "start",
            loop: clips.length > 3,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {clips.map((clip) => {
              const cachedArt = coverArtCache[clip.url];
              return (
                <CarouselItem key={clip.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                  <ClipCard clip={clip} coverArt={cachedArt?.coverArtUrl} />
                </CarouselItem>
              );
            })}
          </CarouselContent>
          {clips.length > 3 && (
            <>
              <CarouselPrevious className="-left-10" />
              <CarouselNext className="-right-10" />
            </>
          )}
        </Carousel>
      </div>
    </div>
  );
}

export default function ClientReportHighlights({ clips, companyName }: ClientReportHighlightsProps) {
  const [coverArtCache, setCoverArtCache] = useState<CoverArtCache>({});

  // Fetch cover art for Apple Podcast links
  useEffect(() => {
    const fetchCoverArt = async (url: string) => {
      if (coverArtCache[url] !== undefined) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('scrape-podcast-cover-art', {
          body: { apple_podcast_url: url }
        });

        if (!error && data) {
          setCoverArtCache(prev => ({ 
            ...prev, 
            [url]: { coverArtUrl: data.coverArtUrl, podcastName: data.podcastName } 
          }));
        } else {
          setCoverArtCache(prev => ({ ...prev, [url]: null }));
        }
      } catch (err) {
        console.error('Error fetching cover art:', err);
        setCoverArtCache(prev => ({ ...prev, [url]: null }));
      }
    };

    // Fetch cover art for all Apple Podcast URLs
    clips.forEach(clip => {
      if (isApplePodcastUrl(clip.url)) {
        fetchCoverArt(clip.url);
      }
    });
  }, [clips]);

  // Group clips by speaker
  const clipsBySpeaker = useMemo(() => {
    const grouped = new Map<string, HighlightClip[]>();
    
    for (const clip of clips) {
      const speaker = clip.speaker_name || 'General';
      if (!grouped.has(speaker)) {
        grouped.set(speaker, []);
      }
      grouped.get(speaker)!.push(clip);
    }
    
    // Convert to array and sort by speaker name (but keep "General" last)
    return Array.from(grouped.entries()).sort((a, b) => {
      if (a[0] === 'General') return 1;
      if (b[0] === 'General') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [clips]);

  if (!clips || clips.length === 0) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Video className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Interview Highlights</h2>
          <p className="text-sm text-muted-foreground">
            Featured clips from {companyName ? `${companyName}'s` : 'published'} podcast appearances
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {clipsBySpeaker.map(([speakerName, speakerClips]) => (
          <SpeakerCarousel 
            key={speakerName} 
            speakerName={speakerName} 
            clips={speakerClips}
            coverArtCache={coverArtCache}
          />
        ))}
      </div>
    </section>
  );
}
