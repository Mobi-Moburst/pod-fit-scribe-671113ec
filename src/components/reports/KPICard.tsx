import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  onHide?: () => void;
}

export const KPICard = ({ title, value, subtitle, icon: Icon, onClick, onHide }: KPICardProps) => {
  return (
    <Card 
      className={cn(
        "group relative bg-card border border-border/60 shadow-none transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:border-border"
      )}
      onClick={onClick}
    >
      {onHide && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onHide();
          }}
          className="absolute top-2 right-2 p-1 rounded-full bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive print:hidden z-10"
          title="Hide this metric"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className="rounded-full bg-muted/60 p-3">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
