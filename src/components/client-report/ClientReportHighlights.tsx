import { Play, Video, Music, ExternalLink } from 'lucide-react';
import { HighlightClip } from '@/types/reports';
import { useState } from 'react';

interface ClientReportHighlightsProps {
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

function MediaPlayer({ clip }: { clip: HighlightClip }) {
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

  // Audio upload with thumbnail
  if (clip.media_type === 'audio') {
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

  // Fallback for external links
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

export default function ClientReportHighlights({ clips, companyName }: ClientReportHighlightsProps) {
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clips.map((clip) => (
          <div key={clip.id} className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <MediaPlayer clip={clip} />
            <div className="p-4 space-y-2">
              <h3 className="font-medium text-foreground line-clamp-2">{clip.title}</h3>
              {clip.podcast_name && (
                <p className="text-sm text-muted-foreground">{clip.podcast_name}</p>
              )}
              {clip.speaker_name && (
                <p className="text-xs text-muted-foreground/70">ft. {clip.speaker_name}</p>
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
        ))}
      </div>
    </section>
  );
}
