import { TargetPodcast } from "@/types/reports";
import { ExternalLink, Mic } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface TargetPodcastsSlideProps {
  podcasts: TargetPodcast[];
}

export const TargetPodcastsSlide = ({ podcasts }: TargetPodcastsSlideProps) => {
  const handlePodcastClick = (url?: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto">
      <h2 className="text-4xl md:text-5xl font-bold text-center">Target Podcasts</h2>
      
      <ScrollArea className="h-[60vh] pr-4">
        <div className="space-y-4">
          {podcasts.map((podcast, index) => (
            <div 
              key={index}
              className={`flex gap-4 p-4 bg-card border border-border rounded-xl transition-colors ${
                podcast.apple_podcast_url ? 'hover:bg-muted/30 cursor-pointer' : ''
              }`}
              onClick={() => handlePodcastClick(podcast.apple_podcast_url)}
            >
              {/* Cover Art */}
              <div className="flex-shrink-0">
                {podcast.cover_art_url ? (
                  <img 
                    src={podcast.cover_art_url} 
                    alt={podcast.podcast_name}
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center">
                    <Mic className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 text-left space-y-2">
                {/* Title with external link */}
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{podcast.podcast_name}</h3>
                  {podcast.apple_podcast_url && (
                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
                
                {/* Description */}
                {podcast.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {podcast.description}
                  </p>
                )}
                
                {/* Pitch Angle */}
                {podcast.pitch_angle && (
                  <div>
                    <span className="font-medium text-sm">Pitch: </span>
                    <span className="text-sm text-muted-foreground">{podcast.pitch_angle}</span>
                  </div>
                )}
                
                {/* Talking Points */}
                {podcast.talking_points && podcast.talking_points.length > 0 && (
                  <div>
                    <span className="font-medium text-sm">Talking Points: </span>
                    <span className="text-sm text-muted-foreground">
                      {podcast.talking_points.join(', ')}
                    </span>
                  </div>
                )}
                
                {/* Target Audience */}
                {podcast.target_audience && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">Audience:</span>
                    <Badge variant="secondary">{podcast.target_audience}</Badge>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};