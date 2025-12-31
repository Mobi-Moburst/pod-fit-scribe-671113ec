import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
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

interface CategoriesSlideProps {
  categories: Category[];
}

export const CategoriesSlide = ({ categories }: CategoriesSlideProps) => {
  const maxCount = Math.max(...categories.map(c => c.count));
  const topCategories = categories.slice(0, 6);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  
  const handleToggle = (categoryName: string) => {
    setOpenCategory(prev => prev === categoryName ? null : categoryName);
  };

  return (
    <div className="w-full space-y-10 max-w-4xl mx-auto">
      <h2 className="text-4xl md:text-5xl font-bold text-center">Top Podcast Categories</h2>
      
      <div className="space-y-4">
        {topCategories.map((category, index) => {
          const hasPodcasts = category.podcasts && category.podcasts.length > 0;
          const isOpen = openCategory === category.name;
          
          return (
            <Collapsible 
              key={index} 
              open={isOpen}
              onOpenChange={() => hasPodcasts && handleToggle(category.name)}
            >
              <CollapsibleTrigger 
                className={`w-full text-left space-y-2 ${hasPodcasts ? 'cursor-pointer hover:bg-muted/30 -mx-3 px-3 py-2 rounded-xl transition-colors' : ''}`}
                disabled={!hasPodcasts}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-medium">{category.name}</span>
                    {hasPodcasts && (
                      isOpen ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )
                    )}
                  </div>
                  <span className="text-lg text-muted-foreground">{category.count}</span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-700"
                    style={{ 
                      width: `${(category.count / maxCount) * 100}%`,
                      background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))`,
                    }}
                  />
                </div>
              </CollapsibleTrigger>
              
              {hasPodcasts && (
                <CollapsibleContent className="pt-4 pb-2">
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenCategory(null);
                      }}
                      className="absolute -top-1 right-0 p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors z-10"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
                    {category.podcasts!.map((podcast, pIndex) => (
                      <a 
                        key={pIndex}
                        href={podcast.apple_podcast_link || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border hover:bg-muted/50 transition-colors"
                      >
                        {podcast.cover_art_url ? (
                          <img 
                            src={podcast.cover_art_url} 
                            alt={podcast.show_title}
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">🎙️</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-base truncate">{podcast.show_title}</p>
                          {podcast.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {podcast.description}
                            </p>
                          )}
                        </div>
                      </a>
                    ))}
                    </div>
                  </div>
                </CollapsibleContent>
              )}
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
};
