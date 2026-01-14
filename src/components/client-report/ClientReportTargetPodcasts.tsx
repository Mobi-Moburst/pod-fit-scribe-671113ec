import { TargetPodcast } from "@/types/reports";
import { ExternalLink, Mic } from "lucide-react";

interface ClientReportTargetPodcastsProps {
  podcasts: TargetPodcast[];
}

export const ClientReportTargetPodcasts = ({ podcasts }: ClientReportTargetPodcastsProps) => {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Target Podcasts</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        {podcasts.map((podcast, index) => (
          <div 
            key={index}
            className="bg-card border border-border rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-start gap-4">
              {podcast.cover_art_url ? (
                <img 
                  src={podcast.cover_art_url} 
                  alt={podcast.podcast_name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <Mic className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{podcast.podcast_name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {podcast.description}
                </p>
              </div>
            </div>

            {podcast.pitch_angle && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-primary uppercase tracking-wide">Pitch Angle</p>
                <p className="text-sm text-muted-foreground">{podcast.pitch_angle}</p>
              </div>
            )}

            {podcast.apple_podcast_url && (
              <a 
                href={podcast.apple_podcast_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                View on Apple Podcasts
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};