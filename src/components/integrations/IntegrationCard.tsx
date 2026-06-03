import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, LucideIcon } from "lucide-react";

export type IntegrationStatus =
  | "connected"
  | "not_connected"
  | "needs_config"
  | "error"
  | "admin_only"
  | "loading";

interface Props {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  status: IntegrationStatus;
  meta?: string | null;
}

const STATUS_META: Record<
  IntegrationStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  connected: { label: "Connected", variant: "default" },
  not_connected: { label: "Not connected", variant: "outline" },
  needs_config: { label: "Needs setup", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
  admin_only: { label: "Admin only", variant: "outline" },
  loading: { label: "…", variant: "outline" },
};

export function IntegrationCard({ to, icon: Icon, title, description, status, meta }: Props) {
  const s = STATUS_META[status];
  return (
    <Link to={to} className="block group">
      <Card className="h-full transition-colors hover:border-foreground/30">
        <CardContent className="p-5 flex flex-col h-full gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-md border border-border flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{title}</div>
                <Badge variant={s.variant} className="mt-1 text-[10px]">
                  {s.label}
                </Badge>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors mt-1 shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
          {meta && <p className="text-xs text-muted-foreground/80 mt-auto pt-2 border-t border-border/50">{meta}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}
