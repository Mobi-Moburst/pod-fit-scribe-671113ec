interface ClientReportCategoriesProps {
  categories: Array<{ name: string; count: number }>;
}

export const ClientReportCategories = ({ categories }: ClientReportCategoriesProps) => {
  const maxCount = Math.max(...categories.map(c => c.count));
  
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Top Podcast Categories</h2>
      
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="space-y-4">
          {categories.slice(0, 8).map((category, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{category.name}</span>
                <span className="text-muted-foreground">{category.count} podcasts</span>
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};