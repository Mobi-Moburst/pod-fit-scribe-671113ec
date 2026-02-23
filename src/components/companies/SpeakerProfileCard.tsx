import { useState } from "react";
import { Card } from "@/components/ui/card";
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
  ChevronRight,
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
      <Card
        className="p-3 bg-muted/20 border-border/50 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border border-border">
            <AvatarImage src={speaker.headshot_url || undefined} alt={speaker.name} />
            <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{speaker.name}</span>
              {speaker.title && (
                <span className="text-xs text-muted-foreground truncate">— {speaker.title}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {topTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="card-surface overflow-hidden ring-1 ring-primary/20">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 border-b border-border/50">
        <Avatar className="w-14 h-14 border-2 border-border shrink-0">
          <AvatarImage src={speaker.headshot_url || undefined} alt={speaker.name} />
          <AvatarFallback className="bg-muted">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-base">{speaker.name}</h4>
          {speaker.title && (
            <p className="text-sm text-muted-foreground">
              {speaker.title} at {companyName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1" />Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={onAirtable} title="Airtable">
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                <Trash className="h-3.5 w-3.5" />
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
          <Button size="icon" variant="ghost" onClick={() => setExpanded(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-4 h-auto py-0">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2.5 text-xs">
            <User className="h-3.5 w-3.5 mr-1.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="strategy" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2.5 text-xs">
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />Strategy
          </TabsTrigger>
          <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2.5 text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" />Call Notes
          </TabsTrigger>
          <TabsTrigger value="insights" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2.5 text-xs">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />Insights
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="max-h-[500px]">
          {/* Overview */}
          <TabsContent value="overview" className="p-4 space-y-4 mt-0">
            {/* Target Audiences */}
            {(speaker.target_audiences?.length ?? 0) > 0 && (
              <Section title="Target Audiences">
                <div className="flex flex-wrap gap-1.5">
                  {speaker.target_audiences!.map((a) => (
                    <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </Section>
            )}

            {/* Talking Points */}
            {(speaker.talking_points?.length ?? 0) > 0 && (
              <Section title="Talking Points">
                <ul className="list-disc list-inside space-y-1 text-sm text-foreground/90">
                  {speaker.talking_points!.map((tp, i) => <li key={i}>{tp}</li>)}
                </ul>
              </Section>
            )}

            {/* Things to Avoid */}
            {(speaker.avoid?.length ?? 0) > 0 && (
              <Section title="Things to Avoid">
                <div className="flex flex-wrap gap-1.5">
                  {speaker.avoid!.map((a) => (
                    <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </Section>
            )}

            {/* Guest Identity Tags */}
            {(speaker.guest_identity_tags?.length ?? 0) > 0 && (
              <Section title="Guest Identity Tags">
                <div className="flex flex-wrap gap-1.5">
                  {speaker.guest_identity_tags!.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </Section>
            )}

            {/* Competitors */}
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

            {/* Links */}
            <div className="flex flex-wrap gap-2 pt-2">
              {speaker.media_kit_url && (
                <a href={speaker.media_kit_url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Media Kit
                  </Button>
                </a>
              )}
              {speaker.airtable_embed_url && (
                <a href={speaker.airtable_embed_url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline">
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />Airtable
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
    </Card>
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
