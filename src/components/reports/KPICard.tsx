import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { LucideIcon, X, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { EditableNumber } from "./EditableNumber";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  /** Optional image (e.g., podcast cover art) shown in place of the icon. */
  imageUrl?: string;
  imageAlt?: string;
  tooltip?: string;
  onClick?: () => void;
  onHide?: () => void;
  /**
   * When provided, the card shows an inline toggle controlling whether the
   * metric is included in the published report. The card is always rendered;
   * when `enabled` is false the value is dimmed to signal it's excluded.
   */
  enabled?: boolean;
  onToggle?: () => void;
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
  imageUrl,
  imageAlt,
  tooltip,
  onClick,
  onHide,
  enabled = true,
  onToggle,
  onValueEdit,
  editableValue,
  editableFormat,
  isLoading,
  loadingLabel,
}: KPICardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const hasToggle = !!onToggle;
  // A disabled (toggled-off) metric is preview-only — not clickable.
  const cardClickable = !!onClick && !isEditing && !isLoading && (!hasToggle || enabled);

  return (
    <Card
      className={cn(
        "group relative glass-inner transition-all",
        cardClickable && "cursor-pointer hover-lift hover:border-[rgba(255,255,255,0.12)]",
        hasToggle && !enabled && "opacity-70"
      )}
      onClick={cardClickable ? onClick : undefined}
    >
      {onHide && !hasToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onHide();
          }}
          className="absolute top-2 right-2 p-1 rounded-full bg-[rgba(255,255,255,0.06)] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive print:hidden z-10"
          title="Hide this metric"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <CardContent className="p-4">
        {/* Header: title + (toggle | nothing) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Info className="h-3 w-3 shrink-0 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {hasToggle && (
            <Switch
              checked={enabled}
              onCheckedChange={onToggle}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Toggle ${title}`}
              className="shrink-0"
            />
          )}
        </div>

        {/* Body: value + icon/image */}
        <div
          className={cn(
            "mt-3 flex items-end justify-between gap-2 transition-opacity",
            hasToggle && !enabled && "opacity-40"
          )}
        >
          <div className="space-y-1 min-w-0">
            {isLoading ? (
              <div className="flex items-center gap-2 text-2xl font-bold tracking-tight text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-[#b9e045]" />
                <span className="text-base font-medium">Analyzing…</span>
              </div>
            ) : onValueEdit && typeof editableValue === "number" ? (
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
            {(isLoading ? loadingLabel : subtitle) && (
              <p className="text-xs text-muted-foreground">
                {isLoading ? (loadingLabel ?? "AEO audit running…") : subtitle}
              </p>
            )}
          </div>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={imageAlt || title}
              className="shrink-0 h-12 w-12 rounded-md object-cover border border-[rgba(255,255,255,0.05)]"
            />
          ) : Icon && (
            <div className="shrink-0 rounded-full bg-[rgba(255,255,255,0.06)] p-3">
              <Icon className={cn("h-5 w-5 text-[#b9e045]", isLoading && "opacity-50")} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
