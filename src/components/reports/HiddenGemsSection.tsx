import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gem, ExternalLink } from 'lucide-react';
import { scoreToColor } from '@/lib/reportTheme';

interface HiddenGemsSectionProps {
  gems: Array<{
    show_title: string;
    fit_score: number;
    reach: number;
    why_fit_summary: string;
    url: string;
  }>;
}

export const HiddenGemsSection = ({ gems }: HiddenGemsSectionProps) => {
  if (!gems.length) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Gem className="w-5 h-5 text-accent" />
        <h3 className="text-xl font-semibold">Hidden Gems</h3>
        <span className="text-sm text-muted-foreground">High fit, easier to book</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {gems.map((gem, idx) => {
          const bgColor = scoreToColor(gem.fit_score);
          
          return (
            <Card key={idx} className="p-5 border-2 border-accent/30">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold line-clamp-2 flex-1">
                  {gem.show_title}
                </h4>
                <div 
                  className="ml-2 px-2.5 py-1 rounded-full text-sm font-bold text-background shrink-0"
                  style={{ backgroundColor: bgColor }}
                >
                  {gem.fit_score.toFixed(1)}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground mb-3">
                <span className="font-medium text-foreground">
                  {gem.reach.toLocaleString()}
                </span> listeners
              </div>
              
              {gem.why_fit_summary && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {gem.why_fit_summary}
                </p>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => window.open(gem.url, '_blank')}
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
