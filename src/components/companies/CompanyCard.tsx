import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, ChevronDown, ChevronRight, Plus, Pencil, Trash, Link2, Archive, RotateCcw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Company, Speaker } from "@/types/clients";

interface CompanyCardProps {
  company: Company & { speakers: Speaker[] };
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSpeaker: () => void;
  onAirtable: () => void;
  isArchived?: boolean;
  onArchive?: () => void;
  onRestore?: () => void;
  children?: React.ReactNode;
}

export function CompanyCard({
  company,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onAddSpeaker,
  onAirtable,
  isArchived,
  onArchive,
  onRestore,
  children,
}: CompanyCardProps) {
  return (
    <div className={isExpanded ? "col-span-full" : ""}>
      <div
        className={`group rounded-xl border bg-card transition-all duration-200 ${
          isExpanded
            ? "shadow-sm border-border"
            : "border-border/60 hover:shadow-md hover:border-border cursor-pointer"
        }`}
      >
        {/* Card Header */}
        <div
          className="flex items-center gap-3 p-3.5 cursor-pointer"
          onClick={onToggle}
        >
          {/* Logo */}
          <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden border border-border/50">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="w-full h-full object-contain p-1"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                }}
              />
            ) : null}
            <Building2 className={`h-5 w-5 text-muted-foreground ${company.logo_url ? "hidden" : ""}`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[15px] tracking-tight truncate">
                {company.company_url ? (
                  <a
                    href={company.company_url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {company.name}
                  </a>
                ) : (
                  company.name
                )}
              </h3>
              <span className="text-xs text-muted-foreground shrink-0">
                {company.speakers.length} speaker{company.speakers.length !== 1 ? "s" : ""}
              </span>
            </div>
            {company.campaign_manager && (
              <span className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground border border-border">
                CM: {company.campaign_manager}
              </span>
            )}
          </div>

          {/* Speaker Thumbnails */}
          <div className="hidden sm:flex items-center -space-x-2.5">
            {company.speakers.slice(0, 4).map((s) => (
              <Avatar key={s.id} className="w-7 h-7 ring-2 ring-background">
                <AvatarImage src={s.headshot_url || undefined} alt={s.name} />
                <AvatarFallback className="text-[10px] bg-muted">
                  {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {company.speakers.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[10px] text-muted-foreground">
                +{company.speakers.length - 4}
              </div>
            )}
          </div>

          {/* Hover-reveal actions (collapsed only) */}
          {!isExpanded && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Expand icon */}
          <div className="shrink-0 text-muted-foreground">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-border/50">
            {/* Action bar */}
            <div className="group/actions flex items-center gap-1 px-4 py-2 border-b border-border/30">
              {!isArchived && (
                <>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onAddSpeaker(); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Speaker
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onAirtable(); }}>
                    <Link2 className="h-3.5 w-3.5 mr-1" />Airtable
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                  </Button>
                </>
              )}
              <div className="flex-1" />
              {isArchived ? (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onRestore?.(); }}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />Restore
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground opacity-0 group-hover/actions:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onArchive?.(); }}>
                  <Archive className="h-3.5 w-3.5 mr-1" />Archive
                </Button>
              )}
              {!isArchived && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive opacity-0 group-hover/actions:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <Trash className="h-3.5 w-3.5 mr-1" />Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete company?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove {company.name} and all its speakers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {/* Speaker list — divider-based */}
            <div className="divide-y divide-border/40">
              {company.speakers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No speakers yet. Add one to get started.
                </p>
              ) : (
                children
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
