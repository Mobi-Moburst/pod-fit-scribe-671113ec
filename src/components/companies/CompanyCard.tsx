import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, ChevronDown, ChevronRight, Plus, Pencil, Trash, Link2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Company, Speaker } from "@/types/clients";

const cmColor = (name?: string) => {
  if (!name) return "bg-muted/50 text-muted-foreground border-muted";
  const palette = [
    "bg-primary text-primary-foreground border-transparent",
    "bg-secondary text-secondary-foreground border-transparent",
    "bg-accent text-accent-foreground border-transparent",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
};

interface CompanyCardProps {
  company: Company & { speakers: Speaker[] };
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSpeaker: () => void;
  onAirtable: () => void;
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
  children,
}: CompanyCardProps) {
  return (
    <div className={isExpanded ? "col-span-full" : ""}>
      <Card
        className={`card-surface overflow-hidden transition-all duration-300 ${
          isExpanded ? "ring-1 ring-primary/30" : "cursor-pointer hover:ring-1 hover:ring-border"
        }`}
      >
        {/* Card Header */}
        <div
          className="flex items-center gap-4 p-4 cursor-pointer"
          onClick={onToggle}
        >
          {/* Logo */}
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border">
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
            <Building2 className={`h-6 w-6 text-muted-foreground ${company.logo_url ? "hidden" : ""}`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base truncate">
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
              <Badge variant="secondary" className="text-xs shrink-0">
                {company.speakers.length} speaker{company.speakers.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            {company.campaign_manager && (
              <Badge variant="default" className={`mt-1 text-xs ${cmColor(company.campaign_manager)}`}>
                CM: {company.campaign_manager}
              </Badge>
            )}
          </div>

          {/* Speaker Thumbnails */}
          <div className="hidden sm:flex items-center -space-x-2">
            {company.speakers.slice(0, 4).map((s) => (
              <Avatar key={s.id} className="w-8 h-8 border-2 border-card">
                <AvatarImage src={s.headshot_url || undefined} alt={s.name} />
                <AvatarFallback className="text-xs bg-muted">
                  {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {company.speakers.length > 4 && (
              <div className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs text-muted-foreground">
                +{company.speakers.length - 4}
              </div>
            )}
          </div>

          {/* Expand icon */}
          <div className="shrink-0 text-muted-foreground">
            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-border">
            {/* Action bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 border-b border-border/50">
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onAddSpeaker(); }}>
                <Plus className="h-4 w-4 mr-1" />Speaker
              </Button>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onAirtable(); }}>
                <Link2 className="h-4 w-4 mr-1" />Airtable
              </Button>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="h-4 w-4 mr-1" />Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                    <Trash className="h-4 w-4 mr-1" />Delete
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
            </div>

            {/* Speaker cards */}
            <div className="p-4 space-y-3">
              {company.speakers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No speakers yet. Add one to get started.
                </p>
              ) : (
                children
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
