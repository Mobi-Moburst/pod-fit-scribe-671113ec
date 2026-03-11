import { useState, useEffect } from "react";
import { supabase, TEAM_ORG_ID } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, FileText, Calendar, Clock, CheckSquare, Trash2 } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";

interface CallNote {
  id: string;
  fathom_meeting_id: string | null;
  meeting_title: string | null;
  meeting_date: string | null;
  duration_seconds: number | null;
  summary: string | null;
  action_items: any[];
  transcript: string | null;
  participants: any[];
  speaker_id: string | null;
  company_id: string | null;
  source: string;
  created_at: string;
}

interface CallNotesListProps {
  speakerId?: string;
  companyId?: string;
  maxHeight?: string;
}

export function CallNotesList({ speakerId, companyId, maxHeight = "400px" }: CallNotesListProps) {
  const [notes, setNotes] = useState<CallNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadNotes();
  }, [speakerId, companyId]);

  const loadNotes = async () => {
    setLoading(true);
    let query = supabase
      .from("call_notes" as any)
      .select("*")
      .order("meeting_date", { ascending: false })
      .limit(20);

    if (speakerId) {
      query = query.eq("speaker_id", speakerId);
    } else if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to load call notes:", error);
    }
    setNotes((data as any as CallNote[]) || []);
    setLoading(false);
  };

  const toggleNote = (id: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteNote = async (id: string) => {
    const { error } = await supabase
      .from("call_notes")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete call note");
      console.error("Delete call note error:", error);
    } else {
      toast.success("Call note deleted");
      setNotes(prev => prev.filter(n => n.id !== id));
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hrs}h ${remainMins}m`;
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-2">Loading call notes...</div>;
  }

  if (notes.length === 0) {
    return <div className="text-sm text-muted-foreground py-2">No call notes yet.</div>;
  }

  return (
    <ScrollArea style={{ maxHeight }}>
      <div className="space-y-2 pr-2">
        {notes.map(note => (
          <Collapsible key={note.id} open={expandedNotes.has(note.id)} onOpenChange={() => toggleNote(note.id)}>
            <Card className="bg-muted/20 border-border/50">
              <CollapsibleTrigger className="w-full text-left p-3 flex items-start gap-2 hover:bg-muted/30 transition-colors rounded-t-lg">
                {expandedNotes.has(note.id) ? (
                  <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm truncate">{note.meeting_title || "Untitled Meeting"}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{note.source}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {note.meeting_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(note.meeting_date), "MMM d, yyyy")}
                      </span>
                    )}
                    {note.duration_seconds && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(note.duration_seconds)}
                      </span>
                    )}
                    {Array.isArray(note.action_items) && note.action_items.length > 0 && (
                      <span className="flex items-center gap-1">
                        <CheckSquare className="h-3 w-3" />
                        {note.action_items.length} action item{note.action_items.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-3">
                  {/* Summary */}
                  {note.summary && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Summary</h4>
                      <div className="max-h-48 overflow-y-auto rounded border border-border/20 p-2">
                        <MarkdownRenderer content={note.summary} className="text-sm" />
                      </div>
                    </div>
                  )}

                  {/* Action Items */}
                  {Array.isArray(note.action_items) && note.action_items.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Action Items</h4>
                      <ul className="space-y-1">
                        {note.action_items.map((item: any, idx: number) => (
                          <li key={idx} className="text-sm flex items-start gap-2">
                            <CheckSquare className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                            <span>{typeof item === "string" ? item : item.text || JSON.stringify(item)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Participants */}
                  {Array.isArray(note.participants) && note.participants.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Participants</h4>
                      <div className="flex flex-wrap gap-1">
                        {note.participants.map((p: any, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {typeof p === "string" ? p : p.name || p.email || JSON.stringify(p)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Transcript toggle */}
                  {note.transcript && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
                        View Transcript
                      </summary>
                      <pre className="mt-2 text-xs whitespace-pre-wrap bg-muted/30 rounded p-3 max-h-60 overflow-y-auto">
                        {note.transcript}
                      </pre>
                    </details>
                  )}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </ScrollArea>
  );
}
