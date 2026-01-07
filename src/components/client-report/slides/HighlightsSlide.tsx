import { useState, useMemo } from 'react';
import { Play, Video, Music, User, ExternalLink } from 'lucide-react';
import { HighlightClip } from '@/types/reports';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HighlightsSlideProps {
  clips: HighlightClip[];
  companyName?: string;
}

function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function getVimeoVideoId(url: string): string | null {
  const regExp = /vimeo\.com\/(?:video\/)?(\d+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

function CompactMediaPlayer({ clip }: { clip: HighlightClip }) {
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

  // Audio with visual
  if (clip.media_type === 'audio') {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex flex-col items-center justify-center p-4 gap-3">
        {clip.thumbnail_url ? (
          <img 
            src={clip.thumbnail_url} 
            alt={clip.title} 
            className="w-16 h-16 rounded-lg object-cover shadow-md"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
            <Music className="w-8 h-8 text-primary" />
          </div>
        )}
        <audio src={clip.url} controls className="w-full max-w-[200px]" />
      </div>
    );
  }

  // Fallback external link
  return (
    <a
      href={clip.url}
      target="_blank"
      rel="noopener noreferrer"
      className="aspect-video w-full rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex flex-col items-center justify-center gap-2 hover:from-primary/30 hover:to-primary/10 transition-colors"
    >
      <Play className="w-10 h-10 text-primary" />
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        Open <ExternalLink className="w-3 h-3" />
      </span>
    </a>
  );
}

function ClipCard({ clip }: { clip: HighlightClip }) {
  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 overflow-hidden shadow-sm h-full flex flex-col">
      <CompactMediaPlayer clip={clip} />
      <div className="p-3 flex-1 flex flex-col gap-1">
        <h4 className="font-medium text-sm text-foreground line-clamp-1">{clip.title}</h4>
        {clip.podcast_name && (
          <p className="text-xs text-muted-foreground line-clamp-1">{clip.podcast_name}</p>
        )}
        <div className="flex items-center gap-2 mt-auto pt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
            {clip.media_type}
          </span>
          {clip.duration_seconds && (
            <span className="text-[10px] text-muted-foreground">
              {Math.floor(clip.duration_seconds / 60)}:{String(clip.duration_seconds % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface SpeakerSectionProps {
  speakerName: string;
  clips: HighlightClip[];
}

function SpeakerSection({ speakerName, clips }: SpeakerSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <User className="w-3.5 h-3.5 text-primary" />
        <span className="text-sm font-medium text-foreground">{speakerName}</span>
        <span className="text-xs text-muted-foreground">
          ({clips.length})
        </span>
      </div>
      
      <div className="px-8">
        <Carousel
          opts={{
            align: "start",
            loop: clips.length > 2,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-3">
            {clips.map((clip) => (
              <CarouselItem key={clip.id} className="pl-3 basis-1/2 lg:basis-1/3">
                <ClipCard clip={clip} />
              </CarouselItem>
            ))}
          </CarouselContent>
          {clips.length > 2 && (
            <>
              <CarouselPrevious className="-left-6 h-7 w-7" />
              <CarouselNext className="-right-6 h-7 w-7" />
            </>
          )}
        </Carousel>
      </div>
    </div>
  );
}

export default function HighlightsSlide({ clips, companyName }: HighlightsSlideProps) {
  // Group clips by speaker
  const clipsBySpeaker = useMemo(() => {
    const grouped = new Map<string, HighlightClip[]>();
    
    for (const clip of clips) {
      const speaker = clip.speaker_name || 'Featured';
      if (!grouped.has(speaker)) {
        grouped.set(speaker, []);
      }
      grouped.get(speaker)!.push(clip);
    }
    
    // Convert to array and sort (keep "Featured" last)
    return Array.from(grouped.entries()).sort((a, b) => {
      if (a[0] === 'Featured') return 1;
      if (b[0] === 'Featured') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [clips]);
  
  if (!clips || clips.length === 0) return null;

  return (
    <div className="w-full h-full flex flex-col max-w-6xl mx-auto px-4">
      {/* Compact Header */}
      <div className="text-center py-4 shrink-0">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Video className="w-5 h-5 text-primary" />
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Interview Highlights</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Featured clips from {companyName ? `${companyName}'s` : ''} podcast appearances
        </p>
      </div>

      {/* Speaker Carousels */}
      <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="space-y-6 pb-4">
          {clipsBySpeaker.map(([speakerName, speakerClips]) => (
            <SpeakerSection 
              key={speakerName} 
              speakerName={speakerName} 
              clips={speakerClips} 
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
