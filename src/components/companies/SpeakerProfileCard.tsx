import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { CallNotesList } from "@/components/call-notes/CallNotesList";
import { StrategyInsightsPanel } from "@/components/call-notes/StrategyInsightsPanel";
import {
  Pencil,
  X,
  Link2,
  Trash,
  ExternalLink,
  User,
  FileText,
  Sparkles,
  BookOpen,
  Archive,
  RotateCcw,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { pickTopAudienceTags } from "@/lib/campaignStrategy";
import type { Speaker, Competitor } from "@/types/clients";

interface SpeakerProfileCardProps {
  speaker: Speaker;
  companyName: string;
  onEdit: () => void;
  onDelete: () => void;
  onAirtable: () => void;
  onUpdate: () => Promise<void>;
}

export function SpeakerProfileCard({
  speaker,
  companyName,
  onEdit,
  onDelete,
  onAirtable,
  onUpdate,
}: SpeakerProfileCardProps) {
  const [expanded, setExpanded] = useState(false);
  const topTags = pickTopAudienceTags({
    strategyText: speaker.campaign_strategy || "",
    audiences: speaker.target_audiences || [],
    max: 3,
  });
  const initials = speaker.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (!expanded) {
    return (
      <div
        className="flex items-center gap-3 py-3 px-3 cursor-pointer hover:bg-muted/30 rounded-lg transition-colors group/row"
        onClick={() => setExpanded(true)}
      >
        <Avatar className="w-9 h-9 ring-1 ring-border shrink-0">
          <AvatarImage src={speaker.headshot_url || undefined} alt={speaker.name} />
          <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{speaker.name}</span>
            {speaker.title && (
              <span className="text-xs text-muted-foreground truncate hidden sm:inline">— {speaker.title}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {topTags.map((tag) => (
              <span key={tag} className="inline-flex items-center px-1.5 py-0 rounded text-[10px] text-muted-foreground bg-muted/60">
                {tag}
              </span>
            ))}
          </div>
        </div>
        {/* Hover-reveal actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onAirtable(); }} title="Airtable">
            <Link2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-2 my-2 rounded-xl shadow-sm border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="group/header flex items-start gap-3 p-3 border-b border-border/50">
        <Avatar className="w-12 h-12 ring-1 ring-border shrink-0">
          <AvatarImage src={speaker.headshot_url || undefined} alt={speaker.name} />
          <AvatarFallback className="bg-muted">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm tracking-tight">{speaker.name}</h4>
          {speaker.title && (
            <p className="text-xs text-muted-foreground">
              {speaker.title} at {companyName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Edit">
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onAirtable} title="Airtable">
              <Link2 className="h-3 w-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                  <Trash className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete speaker?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove {speaker.name}. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-3 h-auto py-0">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 text-xs">
            <User className="h-3 w-3 mr-1.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="strategy" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 text-xs">
            <BookOpen className="h-3 w-3 mr-1.5" />Strategy
          </TabsTrigger>
          <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 text-xs">
            <FileText className="h-3 w-3 mr-1.5" />Call Notes
          </TabsTrigger>
          <TabsTrigger value="insights" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 text-xs">
            <Sparkles className="h-3 w-3 mr-1.5" />Insights
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="max-h-[500px]">
          {/* Overview */}
          <TabsContent value="overview" className="p-4 space-y-4 mt-0">
            {(speaker.target_audiences?.length ?? 0) > 0 && (
              <Section title="Target Audiences">
                <div className="flex flex-wrap gap-1.5">
                  {speaker.target_audiences!.map((a) => (
                    <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </Section>
            )}

            {(speaker.talking_points?.length ?? 0) > 0 && (
              <Section title="Talking Points">
                <ul className="list-disc list-inside space-y-1 text-sm text-foreground/90">
                  {speaker.talking_points!.map((tp, i) => <li key={i}>{tp}</li>)}
                </ul>
              </Section>
            )}

            {(speaker.avoid?.length ?? 0) > 0 && (
              <Section title="Things to Avoid">
                <div className="flex flex-wrap gap-1.5">
                  {speaker.avoid!.map((a) => (
                    <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </Section>
            )}

            {(speaker.guest_identity_tags?.length ?? 0) > 0 && (
              <Section title="Guest Identity Tags">
                <div className="flex flex-wrap gap-1.5">
                  {speaker.guest_identity_tags!.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </Section>
            )}

            {(speaker.competitors?.length ?? 0) > 0 && (
              <Section title="Competitors">
                <div className="space-y-2">
                  {speaker.competitors!.map((c: Competitor, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{c.name}</span>
                      {c.role && <span className="text-muted-foreground"> — {c.role}</span>}
                      {c.peer_reason && <p className="text-xs text-muted-foreground mt-0.5">{c.peer_reason}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {speaker.media_kit_url && (
                <a href={speaker.media_kit_url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    <ExternalLink className="h-3 w-3 mr-1.5" />Media Kit
                  </Button>
                </a>
              )}
              {speaker.airtable_embed_url && (
                <a href={speaker.airtable_embed_url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    <Link2 className="h-3 w-3 mr-1.5" />Airtable
                  </Button>
                </a>
              )}
            </div>
          </TabsContent>

          {/* Strategy */}
          <TabsContent value="strategy" className="p-4 space-y-4 mt-0">
            {speaker.campaign_strategy ? (
              <MarkdownRenderer content={speaker.campaign_strategy} />
            ) : (
              <p className="text-sm text-muted-foreground">No campaign strategy set.</p>
            )}

            {speaker.pitch_template && (
              <Section title="Pitch Template">
                <pre className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border border-border/50">
                  {speaker.pitch_template}
                </pre>
              </Section>
            )}
          </TabsContent>

          {/* Call Notes */}
          <TabsContent value="notes" className="p-4 mt-0">
            <CallNotesList speakerId={speaker.id} maxHeight="400px" />
          </TabsContent>

          {/* Insights */}
          <TabsContent value="insights" className="p-4 mt-0">
            <StrategyInsightsPanel speakerId={speaker.id} speaker={speaker} onUpdate={onUpdate} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
        {title}
      </h5>
      {children}
    </div>
  );
}
