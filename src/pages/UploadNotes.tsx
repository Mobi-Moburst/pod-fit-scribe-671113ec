import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { supabase, TEAM_ORG_ID } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompanySpeakerSelector } from "@/components/CompanySpeakerSelector";
import type { Company, Speaker } from "@/types/clients";
import { ArrowLeft, Loader2, FileText, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface RecentNote {
  id: string;
  meeting_title: string | null;
  meeting_date: string | null;
  company_id: string | null;
  speaker_id: string | null;
  created_at: string;
}

const MIN_LEN = 50;
const MAX_LEN = 20000;
const MAX_TITLE = 200;

export default function UploadNotes() {
  const { user } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [speakerId, setSpeakerId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [recent, setRecent] = useState<RecentNote[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    document.title = "Upload meeting notes — Kitcaster Campaign Command Center";
  }, []);

  useEffect(() => {
    const load = async () => {
      const [coRes, spRes] = await Promise.all([
        supabase.from("companies").select("*").is("archived_at", null).order("name"),
        supabase.from("speakers").select("*").is("archived_at", null).order("name"),
      ]);
      setCompanies((coRes.data || []) as any);
      setSpeakers((spRes.data || []) as any);
    };
    load();
    loadRecent();
  }, []);

  const loadRecent = async () => {
    setLoadingRecent(true);
    const { data, error } = await supabase
      .from("call_notes" as any)
      .select("id, meeting_title, meeting_date, company_id, speaker_id, created_at")
      .eq("source", "manual")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) console.error(error);
    setRecent(((data as any) || []) as RecentNote[]);
    setLoadingRecent(false);
  };

  const companyName = (id: string | null) =>
    companies.find((c) => c.id === id)?.name ?? "—";
  const speakerName = (id: string | null) =>
    id ? speakers.find((s) => s.id === id)?.name ?? "—" : "Company-wide";

  const charCount = summary.length;
  const canSubmit = useMemo(
    () =>
      !!companyId &&
      title.trim().length > 0 &&
      title.length <= MAX_TITLE &&
      charCount >= MIN_LEN &&
      charCount <= MAX_LEN &&
      !!date,
    [companyId, title, charCount, date]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSaving(true);
    try {
      const meetingDateIso = new Date(date + "T12:00:00").toISOString();
      const { error } = await supabase.from("call_notes" as any).insert({
        org_id: TEAM_ORG_ID,
        company_id: companyId,
        speaker_id: speakerId,
        meeting_title: title.trim(),
        meeting_date: meetingDateIso,
        summary: summary.trim(),
        source: "manual",
        participants: [],
        action_items: [],
        transcript: null,
      });
      if (error) throw error;
      toast({ title: "Note saved", description: "Available in Strategy Insights and the speaker timeline." });
      setTitle("");
      setSummary("");
      setSpeakerId(null);
      setDate(new Date().toISOString().slice(0, 10));
      loadRecent();
    } catch (err: any) {
      toast({ title: "Could not save note", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("call_notes" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Note deleted" });
    loadRecent();
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!isAdmin && !user) {
    navigate("/settings");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto py-8 px-4 space-y-6 relative z-10 max-w-3xl">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>

        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7" />
            Upload meeting notes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            For meetings that don't sync via Fireflies. Paste a Google Meet, Zoom, or hand-written summary
            and it'll flow into Strategy Insights and the speaker timeline just like a synced call.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">New note</CardTitle>
            <CardDescription>All fields except speaker are required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <CompanySpeakerSelector
                companies={companies}
                speakers={speakers}
                selectedCompanyId={companyId}
                selectedSpeakerId={speakerId}
                onCompanyChange={(id) => {
                  setCompanyId(id);
                  setSpeakerId(null);
                }}
                onSpeakerChange={setSpeakerId}
                showAllSpeakersOption
              />

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Meeting title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Q2 Strategy Sync"
                    maxLength={MAX_TITLE}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Meeting date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="summary">Notes / summary</Label>
                  <span
                    className={`text-xs ${
                      charCount > MAX_LEN || (charCount > 0 && charCount < MIN_LEN)
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {charCount.toLocaleString()} / {MAX_LEN.toLocaleString()}
                    {charCount > 0 && charCount < MIN_LEN ? ` · need ${MIN_LEN - charCount} more` : ""}
                  </span>
                </div>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Paste the full Google Meet, Zoom, or manual meeting summary here. Markdown is supported — headings, bullets, bold all render."
                  className="min-h-[280px] font-mono text-xs leading-relaxed"
                  maxLength={MAX_LEN}
                  required
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={!canSubmit || isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save note
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent manual uploads</CardTitle>
            <CardDescription>The 10 most recent notes added through this page.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No manual notes yet.</p>
            ) : (
              <ul className="divide-y divide-border/50">
                {recent.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {n.meeting_title || "Untitled meeting"}
                        </span>
                        <Badge variant="outline" className="text-xs">Manual</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{companyName(n.company_id)}</span>
                        <span>·</span>
                        <span>{speakerName(n.speaker_id)}</span>
                        {n.meeting_date && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(n.meeting_date), "MMM d, yyyy")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{n.meeting_title || "Untitled meeting"}" will be permanently removed. This
                            cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(n.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
