import { TargetPodcast } from "@/types/reports";
import { Mic } from "lucide-react";

interface TargetPodcastsSlideProps {
  podcasts: TargetPodcast[];
}

export const TargetPodcastsSlide = ({ podcasts }: TargetPodcastsSlideProps) => {
  // Show up to 6 podcasts on this slide
  const displayPodcasts = podcasts.slice(0, 6);

  return (
    <div className="w-full space-y-8 max-w-5xl mx-auto">
      <h2 className="text-4xl md:text-5xl font-bold text-center">Recommended Podcasts</h2>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayPodcasts.map((podcast, index) => (
          <div 
            key={index}
            className="bg-card border border-border rounded-xl p-5 space-y-3"
          >
            <div className="flex items-center gap-3">
              {podcast.cover_art_url ? (
                <img 
                  src={podcast.cover_art_url} 
                  alt={podcast.podcast_name}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Mic className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <h3 className="font-semibold line-clamp-2">{podcast.podcast_name}</h3>
            </div>

            {podcast.pitch_angle && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {podcast.pitch_angle}
              </p>
            )}
          </div>
        ))}
      </div>

      {podcasts.length > 6 && (
        <p className="text-center text-muted-foreground">
          +{podcasts.length - 6} more recommendations
        </p>
      )}
    </div>
  );
};