import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateCardProps {
  publishDate: string;
}

export const DateCard = ({ publishDate }: DateCardProps) => {
  const date = new Date(publishDate);
  const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  const isStale = daysSince > 90;
  
  const formatRelativeTime = (days: number) => {
    if (days < 1) return "Today";
    if (days < 2) return "Yesterday";
    if (days < 7) return `${Math.floor(days)} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  return (
    <Card className={cn(
      "p-4 card-surface min-w-48",
      isStale && "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"
    )}>
      <div className="flex items-center gap-2 mb-2">
        {isStale ? (
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        ) : (
          <Calendar className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-muted-foreground">Published</span>
      </div>
      
      <div className="text-lg font-semibold">
        {date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })}
      </div>
      
      <div className="flex items-center gap-2 mt-2">
        <span className="text-sm text-muted-foreground">
          {formatRelativeTime(daysSince)}
        </span>
        {isStale && (
          <Badge variant="outline" className="text-amber-700 border-amber-500">
            Stale ({Math.floor(daysSince)}d)
          </Badge>
        )}
      </div>
    </Card>
  );
};