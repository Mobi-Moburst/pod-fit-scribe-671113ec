import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { BackgroundFX } from "@/components/BackgroundFX";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, EyeOff, RefreshCw, AlertCircle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ReactMarkdown from "react-markdown";

type CallNote = {
  id: string;
  source: string;
  meeting_title: string | null;
  meeting_date: string | null;
  duration_seconds: number | null;
  participants: any;
  summary: string | null;
  action_items: any;
  fireflies_transcript_id: string | null;
  fathom_meeting_id: string | null;
  speaker_id: string | null;
  company_id: string | null;
  excluded_at: string | null;
  excluded_reason: string | null;
  created_at: string;
};

type SpeakerLite = { id: string; name: string };
type CompanyLite = { id: string; name: string };

export default function SyncedCalls() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [rows, setRows] = useState<CallNote[]>([]);
  const [speakers, setSpeakers] = useState<Record<string, SpeakerLite>>({});
  const [companies, setCompanies] = useState<Record<string, CompanyLite>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CallNote | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Filters
  const [source, setSource] = useState<"all" | "fireflies">("all");
  const [matchStatus, setMatchStatus] = useState<"all" | "matched" | "unmatched" | "excluded">("all");
  const [search, setSearch] = useState("");
  const [days, setDays] = useState<"7" | "30" | "90" | "all">("30");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("call_notes")
      .select("id, source, meeting_title, meeting_date, duration_seconds, participants, summary, action_items, fireflies_transcript_id, fathom_meeting_id, speaker_id, company_id, excluded_at, excluded_reason, created_at")
      .order("meeting_date", { ascending: false })
      .limit(500);

    if (days !== "all") {
      const since = new Date(Date.now() - parseInt(days) * 86400000).toISOString();
      q = q.gte("meeting_date", since);
    }
    if (source !== "all") q = q.eq("source", source);

    const { data, error } = await q;
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setRows((data as CallNote[]) || []);

    const [spk, co] = await Promise.all([
      supabase.from("speakers").select("id, name"),
      supabase.from("companies").select("id, name"),
    ]);
    const spkMap: Record<string, SpeakerLite> = {};
    (spk.data || []).forEach((s: any) => (spkMap[s.id] = s));
    const coMap: Record<string, CompanyLite> = {};
    (co.data || []).forEach((c: any) => (coMap[c.id] = c));
    setSpeakers(spkMap);
    setCompanies(coMap);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, source, days]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (matchStatus === "matched" && !r.speaker_id && !r.company_id) return false;
      if (matchStatus === "unmatched" && (r.speaker_id || r.company_id || r.excluded_at)) return false;
      if (matchStatus === "excluded" && !r.excluded_at) return false;
      if (search) {
        const hay = [
          r.meeting_title,
          ...(Array.isArray(r.participants) ? r.participants : []),
        ].join(" ").toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, matchStatus, search]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const matched = filtered.filter((r) => r.speaker_id || r.company_id).length;
    const excluded = filtered.filter((r) => r.excluded_at).length;
    const ff = filtered.filter((r) => r.source === "fireflies").length;
    return { total, matched, unmatched: total - matched - excluded, excluded, ff };
  }, [filtered]);

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allChecked = filtered.length > 0 && filtered.every((r) => checked.has(r.id));
  const toggleAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(filtered.map((r) => r.id)));
  };

  const deleteRows = async (ids: string[]) => {
    const { error } = await supabase.from("call_notes").delete().in("id", ids);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Deleted ${ids.length} call${ids.length === 1 ? "" : "s"}` });
    setChecked(new Set());
    setSelected(null);
    load();
  };

  const excludeRows = async (ids: string[], reason = "Marked irrelevant by admin") => {
    const { error } = await supabase
      .from("call_notes")
      .update({ excluded_at: new Date().toISOString(), excluded_reason: reason })
      .in("id", ids);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Marked ${ids.length} as irrelevant` });
    setChecked(new Set());
    load();
  };

  const unexcludeRows = async (ids: string[]) => {
    const { error } = await supabase
      .from("call_notes")
      .update({ excluded_at: null, excluded_reason: null })
      .in("id", ids);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Restored ${ids.length}` });
    load();
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
  if (!isAdmin) return <Navigate to="/settings" replace />;

  return (
    <div className="min-h-screen bg-background">
      <BackgroundFX />
      <Navbar />
      <main className="container mx-auto py-8 px-4 space-y-6 relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Synced Calls</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Review every meeting imported from Fireflies. Diagnose bad matches and remove noise.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Matched" value={stats.matched} tone="success" />
          <StatCard label="Unmatched" value={stats.unmatched} tone="warning" />
          <StatCard label="Excluded" value={stats.excluded} tone="muted" />
          <StatCard label="Fireflies" value={stats.ff} />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 flex flex-wrap gap-3 items-center">
            <Select value={source} onValueChange={(v: any) => setSource(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="fireflies">Fireflies</SelectItem>
              </SelectContent>
            </Select>
            <Select value={matchStatus} onValueChange={(v: any) => setMatchStatus(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All matches</SelectItem>
                <SelectItem value="matched">Matched only</SelectItem>
                <SelectItem value="unmatched">Unmatched only</SelectItem>
                <SelectItem value="excluded">Excluded only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={days} onValueChange={(v: any) => setDays(v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7d</SelectItem>
                <SelectItem value="30">Last 30d</SelectItem>
                <SelectItem value="90">Last 90d</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search title or participant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-48 max-w-md"
            />
            {checked.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <Badge variant="secondary">{checked.size} selected</Badge>
                <Button size="sm" variant="outline" onClick={() => excludeRows([...checked])}>
                  <EyeOff className="h-3.5 w-3.5 mr-1" /> Exclude
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {checked.size} calls?</AlertDialogTitle>
                      <AlertDialogDescription>This permanently removes the synced notes. Cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteRows([...checked])} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{filtered.length} calls</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No calls match these filters.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead>Matched</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const parts = Array.isArray(r.participants) ? r.participants : [];
                    const partStr = parts.slice(0, 3).join(", ") + (parts.length > 3 ? ` +${parts.length - 3}` : "");
                    const spk = r.speaker_id ? speakers[r.speaker_id]?.name : null;
                    const co = r.company_id ? companies[r.company_id]?.name : null;
                    return (
                      <TableRow
                        key={r.id}
                        className={`cursor-pointer ${r.excluded_at ? "opacity-50" : ""}`}
                        onClick={() => setSelected(r)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={checked.has(r.id)} onCheckedChange={() => toggleCheck(r.id)} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {r.meeting_date ? new Date(r.meeting_date).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="font-medium max-w-md truncate">
                          {r.meeting_title || "Untitled"}
                          {r.excluded_at && <Badge variant="outline" className="ml-2 text-xs">excluded</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">{r.source}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{partStr || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {spk || co ? (
                            <span className="text-foreground">{spk || co}{spk && co ? ` · ${co}` : ""}</span>
                          ) : (
                            <span className="text-amber-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> unmatched
                            </span>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRows([r.id])}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.meeting_title || "Untitled"}</SheetTitle>
                <SheetDescription>
                  {selected.meeting_date ? new Date(selected.meeting_date).toLocaleString() : "no date"}
                  {" · "}{selected.source}
                  {selected.duration_seconds ? ` · ${Math.round(selected.duration_seconds / 60)} min` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5 text-sm">
                <Section title="Match">
                  <div className="space-y-1">
                    <div>Speaker: <span className="text-muted-foreground">{selected.speaker_id ? speakers[selected.speaker_id]?.name : "— unmatched —"}</span></div>
                    <div>Company: <span className="text-muted-foreground">{selected.company_id ? companies[selected.company_id]?.name : "— unmatched —"}</span></div>
                  </div>
                </Section>

                <Section title="Participants">
                  {Array.isArray(selected.participants) && selected.participants.length > 0 ? (
                    <ul className="space-y-0.5 text-muted-foreground">
                      {selected.participants.map((p: any, i: number) => (
                        <li key={i} className="font-mono text-xs">{typeof p === "string" ? p : JSON.stringify(p)}</li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">No participants recorded.</p>}
                </Section>

                <Section title="Source IDs">
                  <div className="font-mono text-xs text-muted-foreground space-y-1">
                    {selected.fireflies_transcript_id && <div>fireflies: {selected.fireflies_transcript_id}</div>}
                    {selected.fathom_meeting_id && <div>fathom: {selected.fathom_meeting_id}</div>}
                    <div>row: {selected.id}</div>
                  </div>
                </Section>

                {selected.summary && (
                  <Section title="Summary">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{selected.summary}</ReactMarkdown>
                    </div>
                  </Section>
                )}

                {Array.isArray(selected.action_items) && selected.action_items.length > 0 && (
                  <Section title="Action items">
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      {selected.action_items.map((a: any, i: number) => (
                        <li key={i}>{a.text || (typeof a === "string" ? a : JSON.stringify(a))}</li>
                      ))}
                    </ul>
                  </Section>
                )}

                {selected.excluded_at && (
                  <Section title="Excluded">
                    <p className="text-muted-foreground">
                      {new Date(selected.excluded_at).toLocaleString()} — {selected.excluded_reason || "no reason"}
                    </p>
                  </Section>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  {selected.excluded_at ? (
                    <Button variant="outline" size="sm" onClick={() => unexcludeRows([selected.id])}>
                      Restore
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => excludeRows([selected.id])}>
                      <EyeOff className="h-3.5 w-3.5 mr-1" /> Mark irrelevant
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this call?</AlertDialogTitle>
                        <AlertDialogDescription>Permanently removes the synced note.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteRows([selected.id])} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: "success" | "warning" | "muted" }) {
  const toneClass =
    tone === "success" ? "text-emerald-500" :
    tone === "warning" ? "text-amber-500" :
    tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      {children}
    </div>
  );
}
