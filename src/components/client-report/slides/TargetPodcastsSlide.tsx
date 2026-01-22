import { TargetPodcast } from "@/types/reports";
import { ExternalLink, Mic, Target } from "lucide-react";
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
    <div className="w-full h-full flex flex-col max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="flex-shrink-0 text-center py-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-full text-accent text-sm font-medium mb-4">
          <Target className="h-4 w-4" />
          Recommended Shows
        </div>
        <h2 className="text-4xl md:text-5xl font-bold">Target Podcasts</h2>
      </div>
      
      {/* Scrollable Content Container */}
      <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden">
        {/* Top fade gradient - rounded */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none rounded-t-2xl" />
        
        <ScrollArea className="h-full">
          <div className="space-y-3 py-4 px-1">
            {podcasts.map((podcast, index) => (
              <div 
                key={index}
                className={`group flex gap-4 p-4 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl transition-all duration-300 ${
                  podcast.apple_podcast_url 
                    ? 'hover:bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 cursor-pointer' 
                    : ''
                }`}
                onClick={() => handlePodcastClick(podcast.apple_podcast_url)}
              >
                {/* Cover Art */}
                <div className="flex-shrink-0">
                  {podcast.cover_art_url ? (
                    <img 
                      src={podcast.cover_art_url} 
                      alt={podcast.podcast_name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-20 w-20 rounded-lg object-cover ring-1 ring-border/50 group-hover:ring-primary/30 transition-all"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-lg bg-muted/50 flex items-center justify-center ring-1 ring-border/50">
                      <Mic className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0 text-left space-y-1.5">
                  {/* Title with external link */}
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                      {podcast.podcast_name}
                    </h3>
                    {podcast.apple_podcast_url && (
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    )}
                  </div>
                  
                  {/* Description */}
                  {podcast.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {podcast.description}
                    </p>
                  )}
                  
                  {/* Pitch Angle */}
                  {podcast.pitch_angle && (
                    <div className="text-sm">
                      <span className="font-medium text-primary/80">Pitch:</span>{" "}
                      <span className="text-muted-foreground">{podcast.pitch_angle}</span>
                    </div>
                  )}
                  
                  {/* Talking Points & Audience - Compact Row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                    {podcast.talking_points && podcast.talking_points.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Topics:</span>{" "}
                        {podcast.talking_points.slice(0, 2).join(', ')}
                        {podcast.talking_points.length > 2 && ' ...'}
                      </div>
                    )}
                    
                    {podcast.target_audience && (
                      <Badge variant="secondary" className="text-xs h-5">
                        {podcast.target_audience}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Bottom spacer for scroll */}
            <div className="h-8" />
          </div>
        </ScrollArea>
        
        {/* Bottom fade gradient - rounded */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background via-background/90 to-transparent z-10 pointer-events-none rounded-b-2xl" />
      </div>
    </div>
  );
};
