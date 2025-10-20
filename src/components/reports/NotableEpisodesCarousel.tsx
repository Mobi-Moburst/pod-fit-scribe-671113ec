import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Sparkles } from 'lucide-react';
import { scoreToColor } from '@/lib/reportTheme';

interface NotableEpisodesCarouselProps {
  episodes: Array<{
    show_title: string;
    fit_score: number;
    reach: number;
    engagement: number;
    why_fit_summary: string;
    url: string;
    categories: string;
  }>;
}

export const NotableEpisodesCarousel = ({ episodes }: NotableEpisodesCarouselProps) => {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-semibold">Top Performing Shows</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {episodes.map((episode, idx) => {
          const bgColor = scoreToColor(episode.fit_score);
          
          return (
            <Card key={idx} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-lg line-clamp-2 flex-1">
                  {episode.show_title}
                </h4>
                <div 
                  className="ml-2 px-3 py-1 rounded-full text-sm font-bold text-background shrink-0"
                  style={{ backgroundColor: bgColor }}
                >
                  {episode.fit_score.toFixed(1)}
                </div>
              </div>
              
              <div className="flex gap-4 text-sm text-muted-foreground mb-3">
                <div>
                  <span className="font-medium text-foreground">
                    {episode.reach.toLocaleString()}
                  </span> listeners
                </div>
                {episode.engagement > 0 && (
                  <div>
                    <span className="font-medium text-foreground">
                      {episode.engagement}%
                    </span> engagement
                  </div>
                )}
              </div>

              {episode.categories && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {episode.categories.split(',').slice(0, 2).map((cat, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {cat.trim()}
                    </Badge>
                  ))}
                </div>
              )}
              
              {episode.why_fit_summary && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {episode.why_fit_summary}
                </p>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => window.open(episode.url, '_blank')}
              >
                <ExternalLink className="w-3 h-3 mr-2" />
                View Show
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
