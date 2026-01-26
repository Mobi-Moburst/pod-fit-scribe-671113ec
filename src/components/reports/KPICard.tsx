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
  subMetric?: {
    value: string;
    label: string;
  };
}

export const KPICard = ({ title, value, subtitle, icon: Icon, onClick, onHide, subMetric }: KPICardProps) => {
  return (
    <Card 
      className={cn(
        "group relative",
        onClick && "cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
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
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {subMetric && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-lg font-semibold text-primary">{subMetric.value}</p>
                <p className="text-xs text-muted-foreground">{subMetric.label}</p>
              </div>
            )}
          </div>
          {Icon && (
            <div className="rounded-full bg-primary/10 p-3">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
