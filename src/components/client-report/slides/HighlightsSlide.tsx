import { useState } from 'react';
import { Play, Video, Music, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { HighlightClip } from '@/types/reports';
import { Button } from '@/components/ui/button';

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

function SlideMediaPlayer({ clip }: { clip: HighlightClip }) {
  // YouTube embed
  if (clip.source_type === 'youtube') {
    const videoId = getYouTubeVideoId(clip.url);
    if (videoId) {
      return (
        <div className="aspect-video w-full max-w-4xl rounded-xl overflow-hidden bg-black shadow-2xl">
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
        <div className="aspect-video w-full max-w-4xl rounded-xl overflow-hidden bg-black shadow-2xl">
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
      <div className="aspect-video w-full max-w-4xl rounded-xl overflow-hidden bg-black shadow-2xl">
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
      <div className="aspect-video w-full max-w-4xl rounded-xl overflow-hidden bg-black shadow-2xl">
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
      <div className="w-full max-w-2xl rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 p-12 flex flex-col items-center justify-center gap-8 shadow-2xl">
        {clip.thumbnail_url ? (
          <img 
            src={clip.thumbnail_url} 
            alt={clip.title} 
            className="w-48 h-48 rounded-xl object-cover shadow-lg"
          />
        ) : (
          <div className="w-48 h-48 rounded-xl bg-primary/10 flex items-center justify-center">
            <Music className="w-24 h-24 text-primary" />
          </div>
        )}
        <audio src={clip.url} controls className="w-full" />
      </div>
    );
  }

  // Fallback external link
  return (
    <a
      href={clip.url}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full max-w-2xl aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex flex-col items-center justify-center gap-6 hover:from-primary/30 hover:to-primary/10 transition-colors shadow-2xl"
    >
      <Play className="w-24 h-24 text-primary" />
      <span className="text-lg text-muted-foreground flex items-center gap-2">
        Open clip <ExternalLink className="w-5 h-5" />
      </span>
    </a>
  );
}

export default function HighlightsSlide({ clips, companyName }: HighlightsSlideProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  if (!clips || clips.length === 0) return null;
  
  const currentClip = clips[currentIndex];
  const hasMultiple = clips.length > 1;

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Video className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Interview Highlights</h2>
        </div>
        <p className="text-muted-foreground">
          Featured clips from {companyName ? `${companyName}'s` : ''} podcast appearances
        </p>
      </div>

      {/* Media Player */}
      <div className="flex-1 flex items-center justify-center w-full">
        <SlideMediaPlayer clip={currentClip} />
      </div>

      {/* Clip Info */}
      <div className="text-center mt-6 max-w-2xl">
        <h3 className="text-xl font-semibold text-foreground">{currentClip.title}</h3>
        {currentClip.podcast_name && (
          <p className="text-muted-foreground mt-1">{currentClip.podcast_name}</p>
        )}
        {currentClip.speaker_name && (
          <p className="text-sm text-muted-foreground/70">ft. {currentClip.speaker_name}</p>
        )}
      </div>

      {/* Navigation for multiple clips */}
      {hasMultiple && (
        <div className="flex items-center gap-4 mt-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentIndex((prev) => (prev - 1 + clips.length) % clips.length)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            {clips.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentIndex((prev) => (prev + 1) % clips.length)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
