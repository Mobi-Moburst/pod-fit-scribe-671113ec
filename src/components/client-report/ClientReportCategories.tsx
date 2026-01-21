import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CategoryPodcast {
  show_title: string;
  cover_art_url?: string;
  description?: string;
  apple_podcast_link?: string;
}

interface Category {
  name: string;
  count: number;
  podcasts?: CategoryPodcast[];
}

interface ClientReportCategoriesProps {
  categories: Category[];
}

export const ClientReportCategories = ({ categories }: ClientReportCategoriesProps) => {
  const maxCount = Math.max(...categories.map(c => c.count));
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  
  const handleToggle = (categoryName: string) => {
    setOpenCategory(prev => prev === categoryName ? null : categoryName);
  };
  
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Top Podcast Categories</h2>
      
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="space-y-3">
          {categories.slice(0, 8).map((category, index) => {
            const hasPodcasts = category.podcasts && category.podcasts.length > 0;
            const isOpen = openCategory === category.name;
            
            return (
              <Collapsible 
                key={index} 
                open={isOpen}
                onOpenChange={() => hasPodcasts && handleToggle(category.name)}
              >
                <CollapsibleTrigger 
                  className={`w-full text-left space-y-1 ${hasPodcasts ? 'cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-lg transition-colors' : ''}`}
                  disabled={!hasPodcasts}
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{category.name}</span>
                      {hasPodcasts && (
                        isOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )
                      )}
                    </div>
                    <span className="text-muted-foreground">{category.count} podcast{category.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${(category.count / maxCount) * 100}%`,
                        background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))`,
                      }}
                    />
                  </div>
                </CollapsibleTrigger>
                
                {hasPodcasts && (
                  <CollapsibleContent className="pt-3 space-y-2">
                    {category.podcasts!.map((podcast, pIndex) => (
                      <a 
                        key={pIndex}
                        href={podcast.apple_podcast_link || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        {podcast.cover_art_url ? (
                          <img 
                            src={podcast.cover_art_url} 
                            alt={podcast.show_title}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <span className="text-xs text-muted-foreground">🎙️</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{podcast.show_title}</p>
                        </div>
                      </a>
                    ))}
                  </CollapsibleContent>
                )}
              </Collapsible>
            );
          })}
        </div>
      </div>
    </section>
  );
};
