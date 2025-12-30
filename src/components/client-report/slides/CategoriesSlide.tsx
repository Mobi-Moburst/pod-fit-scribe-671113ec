interface CategoriesSlideProps {
  categories: Array<{ name: string; count: number }>;
}

export const CategoriesSlide = ({ categories }: CategoriesSlideProps) => {
  const maxCount = Math.max(...categories.map(c => c.count));
  const topCategories = categories.slice(0, 6);

  return (
    <div className="w-full space-y-10 max-w-4xl mx-auto">
      <h2 className="text-4xl md:text-5xl font-bold text-center">Top Podcast Categories</h2>
      
      <div className="space-y-5">
        {topCategories.map((category, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xl font-medium">{category.name}</span>
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
          </div>
        ))}
      </div>
    </div>
  );
};