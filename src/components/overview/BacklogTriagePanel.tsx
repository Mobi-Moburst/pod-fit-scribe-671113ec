import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Search, ExternalLink, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type BacklogRow = {
  client: string;
  cm: string | null;
  contracted: number;
  completed: number;
  goal: number;
  gap: number;
  status: "backlog" | "at-risk" | null;
};

type SpeakerRow = {
  id: string;
  name: string;
  headshot_url: string | null;
  shortlistCount: number;
  bookedThisQuarter: number;
};

interface Props {
  row: BacklogRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function quarterStart(d = new Date()) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

export function BacklogTriagePanel({ row, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyMissing, setCompanyMissing] = useState(false);
  const [lastBookingDate, setLastBookingDate] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<SpeakerRow[]>([]);

  const daysSinceLastBooking = useMemo(() => {
    if (!lastBookingDate) return null;
    const last = new Date(lastBookingDate).getTime();
    return Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
  }, [lastBookingDate]);

  useEffect(() => {
    if (!open || !row) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setCompanyMissing(false);
      setLastBookingDate(null);
      setSpeakers([]);
      setCompanyId(null);

      // 1. Resolve company by name, with fallbacks for "Speaker - Company" style LTV labels
      const raw = row.client.trim();
      const norm = (s: string) => s.trim().toLowerCase();
      const candidates = new Set<string>([norm(raw)]);
      // Split on common separators (" - ", " / ", " | ", " – ", " — ")
      raw.split(/\s+[-/|–—]\s+/).forEach((part) => {
        if (part.trim()) candidates.add(norm(part));
      });

      const [{ data: companies }, { data: allSpeakers }] = await Promise.all([
        supabase.from("companies").select("id, name").is("archived_at", null),
        supabase
          .from("speakers")
          .select("id, name, company_id, headshot_url")
          .is("archived_at", null),
      ]);

      // Try company name match first
      let match = (companies || []).find((c) => candidates.has(norm(c.name))) || null;
      // Fallback: match a speaker by name, then resolve to their company
      if (!match) {
        const spk = (allSpeakers || []).find((s) => candidates.has(norm(s.name)));
        if (spk) match = (companies || []).find((c) => c.id === spk.company_id) || null;
      }

      if (cancelled) return;
      if (!match) {
        setCompanyMissing(true);
        setLoading(false);
        return;
      }
      setCompanyId(match.id);

      // 2. Speakers for this company + last booking + bookings this quarter
      const companySpeakers = (allSpeakers || []).filter((s) => s.company_id === match!.id);
      const qStart = quarterStart().toISOString().slice(0, 10);
      const [{ data: lastBooking }, { data: bookingsThisQ }] = await Promise.all([
        supabase
          .from("momentum_bookings")
          .select("date_secured")
          .eq("company_id", match.id)
          .not("date_secured", "is", null)
          .order("date_secured", { ascending: false })
          .limit(1),
        supabase
          .from("momentum_bookings")
          .select("date_secured")
          .eq("company_id", match.id)
          .gte("date_secured", qStart),
      ]);
      if (cancelled) return;

      const speakerIds = companySpeakers.map((s) => s.id);

      let shortlistRows: { speaker_id: string; status: string }[] = [];
      if (speakerIds.length > 0) {
        const { data: sl } = await supabase
          .from("research_shortlists")
          .select("speaker_id, status")
          .in("speaker_id", speakerIds);
        shortlistRows = (sl || []) as any;
      }

      const shortlistByspeaker = new Map<string, number>();
      for (const s of shortlistRows) {
        if (!s.speaker_id) continue;
        const status = (s.status || "").toLowerCase();
        if (["rejected", "passed", "booked", "removed"].includes(status)) continue;
        shortlistByspeaker.set(s.speaker_id, (shortlistByspeaker.get(s.speaker_id) || 0) + 1);
      }

      const bookedQ = (bookingsThisQ || []).length;

      const speakerRows: SpeakerRow[] = companySpeakers.map((s) => ({
        id: s.id,
        name: s.name,
        headshot_url: s.headshot_url,
        shortlistCount: shortlistByspeaker.get(s.id) || 0,
        bookedThisQuarter: bookedQ,
      }));

      setSpeakers(speakerRows);
      setLastBookingDate(lastBooking?.[0]?.date_secured ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, row]);

  if (!row) return null;

  const statusPill =
    row.status === "backlog" ? (
      <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500">
        Backlog
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
        At risk
      </span>
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            {row.client} {statusPill}
          </SheetTitle>
          <SheetDescription className="text-xs">
            CM: {row.cm || "—"}
          </SheetDescription>
        </SheetHeader>

        {/* Why behind */}
        <div className="mt-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Why this client is behind
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label="Contracted / mo" value={row.contracted} />
            <Stat label="Completed" value={row.completed} />
            <Stat label="Goal this mo." value={row.goal} tone={row.status === "backlog" ? "red" : "amber"} />
            <Stat label="Gap" value={row.gap} />
          </div>
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {lastBookingDate ? (
              <>
                Last booking:{" "}
                <span className="text-foreground">{lastBookingDate}</span>
                {daysSinceLastBooking !== null && (
                  <> · {daysSinceLastBooking} day{daysSinceLastBooking === 1 ? "" : "s"} ago</>
                )}
              </>
            ) : loading ? (
              "Loading booking history…"
            ) : (
              "No bookings on record for this company."
            )}
          </div>
        </div>

        <Separator className="my-5" />

        {/* Speakers */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Speakers
          </h3>

          {companyMissing ? (
            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
              Couldn't link <span className="text-foreground">{row.client}</span> to a company record.
              <div className="mt-2">
                <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                  <Link to="/companies">
                    <Building2 className="h-3.5 w-3.5 mr-1" /> Open Companies
                  </Link>
                </Button>
              </div>
            </div>
          ) : loading ? (
            <p className="text-xs text-muted-foreground">Loading speakers…</p>
          ) : speakers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active speakers for this company.</p>
          ) : (
            <ul className="space-y-2">
              {speakers.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={s.headshot_url || undefined} alt={s.name} />
                    <AvatarFallback className="text-[10px]">
                      {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.shortlistCount} in shortlist
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onOpenChange(false)}
                  >
                    <Link to={`/research?speaker=${s.id}`}>
                      <Search className="h-3.5 w-3.5 mr-1" /> Research
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {!companyMissing && speakers.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
              <Link to={`/companies?company=${companyId ?? ""}`} onClick={() => onOpenChange(false)}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> View company
              </Link>
            </Button>
            {speakers.length === 1 && (
              <Button asChild size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
                <Link to={`/research?speaker=${speakers[0].id}`}>
                  <Search className="h-3.5 w-3.5 mr-1" /> Open Research
                </Link>
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "red" | "amber";
}) {
  const color =
    tone === "red"
      ? "text-red-500"
      : tone === "amber"
      ? "text-amber-500"
      : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
