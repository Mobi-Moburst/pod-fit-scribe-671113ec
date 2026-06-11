import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Textarea } from "@/components/ui/textarea";
import { CallNotesList } from "@/components/call-notes/CallNotesList";
import { StrategyInsightsPanel } from "@/components/call-notes/StrategyInsightsPanel";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
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
  Check,
  Clock,
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
  isArchived?: boolean;
  onArchive?: () => void;
  onRestore?: () => void;
}

export function SpeakerProfileCard({
  speaker,
  companyName,
  onEdit,
  onDelete,
  onAirtable,
  onUpdate,
  isArchived,
  onArchive,
  onRestore,
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
        className="flex items-center gap-3 py-3 px-3 cursor-pointer hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors group/row"
        onClick={() => setExpanded(true)}
      >
        <Avatar className="w-9 h-9 ring-1 ring-border shrink-0">
          <AvatarImage src={speaker.headshot_url || undefined} alt={speaker.name} />
          <AvatarFallback className="text-[10px] bg-[rgba(255,255,255,0.04)]">{initials}</AvatarFallback>
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
          {isArchived ? (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onRestore?.(); }} title="Restore">
              <RotateCcw className="h-3 w-3" />
            </Button>
          ) : (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onAirtable(); }} title="Airtable">
                <Link2 className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onArchive?.(); }} title="Archive">
                <Archive className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.05)] bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
      {/* Header */}
      <div className="group/header flex items-start gap-3 p-3.5 border-b border-[rgba(255,255,255,0.05)] bg-gradient-to-b from-secondary/20 to-transparent">
        <Avatar className="w-11 h-11 ring-1 ring-border shrink-0">
          <AvatarImage src={speaker.headshot_url || undefined} alt={speaker.name} />
          <AvatarFallback className="bg-[rgba(255,255,255,0.04)] text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm tracking-tight leading-tight">{speaker.name}</h4>
          {speaker.title && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {speaker.title} <span className="text-muted-foreground/60">· {companyName}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity">
            {isArchived ? (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onRestore} title="Restore">
                <RotateCcw className="h-3 w-3 mr-1" />Restore
              </Button>
            ) : (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Edit">
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onAirtable} title="Airtable">
                  <Link2 className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onArchive?.()} title="Archive">
                  <Archive className="h-3 w-3" />
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
              </>
            )}
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b border-[rgba(255,255,255,0.05)] bg-transparent px-2 h-auto py-0 gap-0">
          {[
            { v: "overview", icon: User, label: "Overview" },
            { v: "strategy", icon: BookOpen, label: "Strategy" },
            { v: "notes", icon: FileText, label: "Call Notes" },
            { v: "insights", icon: Sparkles, label: "Insights" },
            { v: "history", icon: Clock, label: "History" },
          ].map(({ v, icon: Icon, label }) => (
            <TabsTrigger
              key={v}
              value={v}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2.5 px-2.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon className="h-3 w-3 mr-1.5" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div>
          {/* Overview */}
          <TabsContent value="overview" className="p-3.5 space-y-3 mt-0">
            {(speaker.target_audiences?.length ?? 0) > 0 && (
              <PanelCard title="Target Audiences">
                <div className="flex flex-wrap gap-1.5">
                  {speaker.target_audiences!.map((a) => (
                    <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-secondary/70 text-foreground/90 border border-[rgba(255,255,255,0.05)]">
                      {a}
                    </span>
                  ))}
                </div>
              </PanelCard>
            )}

            {(speaker.talking_points?.length ?? 0) > 0 && (
              <PanelCard title="Talking Points">
                <ul className="space-y-1.5 text-[13px] text-foreground/90 leading-relaxed">
                  {speaker.talking_points!.map((tp, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground/60 shrink-0 mt-1.5 h-1 w-1 rounded-full bg-primary/60" />
                      <span>{tp}</span>
                    </li>
                  ))}
                </ul>
              </PanelCard>
            )}

            {(speaker.avoid?.length ?? 0) > 0 && (
              <PanelCard title="Things to Avoid">
                <div className="flex flex-wrap gap-1.5">
                  {speaker.avoid!.map((a) => (
                    <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-destructive/10 text-destructive border border-destructive/25">
                      {a}
                    </span>
                  ))}
                </div>
              </PanelCard>
            )}

            {(speaker.guest_identity_tags?.length ?? 0) > 0 && (
              <PanelCard title="Guest Identity">
                <div className="flex flex-wrap gap-1.5">
                  {speaker.guest_identity_tags!.map((t) => (
                    <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] text-muted-foreground border border-[rgba(255,255,255,0.05)]">
                      {t}
                    </span>
                  ))}
                </div>
              </PanelCard>
            )}

            {(speaker.competitors?.length ?? 0) > 0 && (
              <PanelCard title="Competitors">
                <div className="grid grid-cols-1 gap-1.5">
                  {speaker.competitors!.map((c: Competitor, i) => (
                    <div key={i} className="rounded-md border border-[rgba(255,255,255,0.05)] bg-background/40 px-2.5 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-medium truncate">{c.name}</span>
                        {c.role && <span className="text-[10.5px] text-muted-foreground truncate">{c.role}</span>}
                      </div>
                      {c.peer_reason && (
                        <p className="text-[11.5px] text-muted-foreground mt-1 leading-snug">{c.peer_reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </PanelCard>
            )}

            {(speaker.media_kit_url || speaker.airtable_embed_url) && (
              <div className="flex flex-wrap gap-2 pt-1">
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
            )}
          </TabsContent>

          {/* Strategy */}
          <TabsContent value="strategy" className="p-3.5 space-y-3 mt-0">
            {(speaker.target_audiences?.length ?? 0) > 0 && (
              <PanelCard title="Target Audiences">
                <div className="flex flex-wrap gap-1.5">
                  {speaker.target_audiences!.map((a) => (
                    <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-secondary/70 text-foreground/90 border border-[rgba(255,255,255,0.05)]">
                      {a}
                    </span>
                  ))}
                </div>
              </PanelCard>
            )}

            {(speaker.talking_points?.length ?? 0) > 0 && (
              <PanelCard title="Talking Points">
                <ul className="space-y-1.5 text-[13px] text-foreground/90 leading-relaxed">
                  {speaker.talking_points!.map((tp, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 mt-1.5 h-1 w-1 rounded-full bg-primary/60" />
                      <span>{tp}</span>
                    </li>
                  ))}
                </ul>
              </PanelCard>
            )}

            {speaker.campaign_strategy ? (
              <PanelCard title="Strategy Narrative">
                <MarkdownRenderer content={speaker.campaign_strategy} className="text-sm [&>p]:text-sm [&_li]:text-sm [&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-sm [&>h4]:text-sm" />
              </PanelCard>
            ) : (
              !speaker.target_audiences?.length && !speaker.talking_points?.length && (
                <p className="text-sm text-muted-foreground">No campaign strategy set.</p>
              )
            )}

            {speaker.pitch_template && (
              <PanelCard title="Pitch Template">
                <pre className="text-[12.5px] whitespace-pre-wrap bg-background/40 rounded-md p-2.5 border border-[rgba(255,255,255,0.05)] leading-relaxed">
                  {speaker.pitch_template}
                </pre>
              </PanelCard>
            )}
          </TabsContent>

          {/* Call Notes */}
          <TabsContent value="notes" className="p-3.5 mt-0">
            <CallNotesList speakerId={speaker.id} maxHeight="420px" />
          </TabsContent>

          {/* Insights */}
          <TabsContent value="insights" className="p-3.5 mt-0">
            <StrategyInsightsPanel speakerId={speaker.id} speaker={speaker} onUpdate={onUpdate} />
          </TabsContent>

          {/* History / Quarterly Notes */}
          <TabsContent value="history" className="p-3.5 mt-0">
            <QuarterlyNotesHistory speakerId={speaker.id} notes={speaker.quarterly_notes} onUpdate={onUpdate} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-background/30 p-3">
      <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-2">
        {title}
      </h5>
      {children}
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

type QuarterlyNote = { quarter: string; notes: string; created_at: string; report_id?: string; report_slug?: string };

function QuarterlyNotesHistory({ speakerId, notes, onUpdate }: { speakerId: string; notes?: QuarterlyNote[] | null; onUpdate: () => Promise<void> }) {
  const items = Array.isArray(notes) ? notes : [];
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const sorted = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const updateNotes = async (newNotes: QuarterlyNote[]) => {
    setSaving(true);
    const { error } = await supabase
      .from("speakers")
      .update({ quarterly_notes: newNotes } as any)
      .eq("id", speakerId);
    setSaving(false);
    if (error) {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
      return false;
    }
    await onUpdate();
    return true;
  };

  const handleDelete = async (entry: QuarterlyNote) => {
    const filtered = items.filter((n) => n.created_at !== entry.created_at);
    if (await updateNotes(filtered)) {
      toast({ title: "Note deleted" });
    }
  };

  const handleStartEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditText(sorted[idx].notes);
  };

  const handleSaveEdit = async () => {
    if (editingIdx === null) return;
    const entry = sorted[editingIdx];
    const updated = items.map((n) =>
      n.created_at === entry.created_at ? { ...n, notes: editText } : n
    );
    if (await updateNotes(updated)) {
      toast({ title: "Note updated" });
      setEditingIdx(null);
    }
  };

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No quarterly notes yet. Generate insights and save a quarterly summary to start building history.</p>;
  }

  return (
    <div className="space-y-3">
      {sorted.map((entry, i) => (
        <div key={entry.created_at} className="group/note border border-[rgba(255,255,255,0.05)] rounded-lg p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              {entry.report_slug && <FileText className="h-3 w-3 text-primary" />}
              {entry.quarter}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground mr-1">
                {new Date(entry.created_at).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover/note:opacity-100 transition-opacity">
                {editingIdx === i ? (
                  <>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveEdit} disabled={saving}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingIdx(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleStartEdit(i)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive">
                          <Trash className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete note?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this {entry.quarter} note.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(entry)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>
          </div>
          {editingIdx === i ? (
            <Textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} className="text-sm" />
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-foreground/90">{entry.notes}</p>
              {entry.report_slug && (
                <a
                  href={`/report/${entry.report_slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  View Report
                </a>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
