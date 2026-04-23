import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LucideIcon, X, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { EditableNumber } from "./EditableNumber";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  tooltip?: string;
  onClick?: () => void;
  onHide?: () => void;
  /**
   * When provided, the value becomes inline-editable via a pencil icon.
   * Only used for numeric values; pass the raw number via `editableValue`.
   */
  onValueEdit?: (next: number) => void;
  editableValue?: number;
  editableFormat?: (n: number) => string;
  /** When true, shows a spinner overlay and a "loading" subtitle hint instead of the value. */
  isLoading?: boolean;
  loadingLabel?: string;
}

export const KPICard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  tooltip,
  onClick,
  onHide,
  onValueEdit,
  editableValue,
  editableFormat,
  isLoading,
  loadingLabel,
}: KPICardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const cardClickable = !!onClick && !isEditing && !isLoading;

  return (
    <Card
      className={cn(
        "group relative bg-card border border-border/60 shadow-none transition-all",
        cardClickable && "cursor-pointer hover:shadow-md hover:border-border"
      )}
      onClick={cardClickable ? onClick : undefined}
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
            <div className="flex items-center gap-1">
              <p className="text-sm text-muted-foreground">{title}</p>
              {tooltip && (
                <Tooltip>
                  <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Info className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {onValueEdit && typeof editableValue === "number" ? (
              <div className="text-2xl font-bold tracking-tight">
                <EditableNumber
                  value={editableValue}
                  onSave={onValueEdit}
                  onEditingChange={setIsEditing}
                  format={editableFormat ?? ((n) => n.toLocaleString())}
                  ariaLabel={`Edit ${title}`}
                />
              </div>
            ) : (
              <p className="text-2xl font-bold tracking-tight">{value}</p>
            )}
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
