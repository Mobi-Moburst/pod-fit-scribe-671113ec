import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const FIREFLIES_GRAPHQL = "https://api.fireflies.ai/graphql";

interface FFTranscript {
  id: string;
  title: string | null;
  date: number | null;
  duration: number | null;
  participants: string[] | null;
  host_email: string | null;
  organizer_email: string | null;
  transcript_url: string | null;
  summary: {
    overview: string | null;
    short_summary: string | null;
    action_items: string | null;
    bullet_gist: string | null;
    keywords: string[] | null;
  } | null;
}

async function fetchFirefliesTranscripts(
  apiKey: string,
  fromDate: string,
  ffUserId: string | null,
): Promise<FFTranscript[]> {
  const results: FFTranscript[] = [];
  let skip = 0;
  const pageSize = 50;
  for (let page = 0; page < 10; page++) {
    const res = await fetch(FIREFLIES_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: `
          query Transcripts($limit: Int, $skip: Int, $fromDate: DateTime, $userId: String) {
            transcripts(limit: $limit, skip: $skip, fromDate: $fromDate, user_id: $userId) {
              id title date duration participants host_email organizer_email transcript_url
              summary { overview short_summary action_items bullet_gist keywords }
            }
          }
        `,
        variables: { limit: pageSize, skip, fromDate, userId: ffUserId || undefined },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Fireflies API ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = await res.json();
    if (json.errors) {
      throw new Error(`Fireflies errors: ${JSON.stringify(json.errors).slice(0, 300)}`);
    }
    const batch = json.data?.transcripts || [];
    results.push(...batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return results;
}

function nameAliases(fullName: string | null | undefined): string[] {
  if (!fullName) return [];
  const trimmed = fullName.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/\s+/);
  const aliases = new Set<string>([trimmed.toLowerCase()]);
  if (parts[0]) aliases.add(parts[0].toLowerCase());
  return [...aliases];
}

function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function domainFromEmail(email: string): string | null {
  const at = email.indexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase();
}

interface Company {
  id: string;
  name: string;
  company_url: string | null;
  campaign_manager: string | null;
}
interface Speaker { id: string; name: string; company_id: string; }

function matchTranscriptToClient(
  t: FFTranscript,
  companies: Company[],
  speakersByCompany: Map<string, Speaker[]>,
): { company_id: string; speaker_id: string | null } | null {
  const title = (t.title || "").toLowerCase();
  const participants = (t.participants || []).map((p) => String(p).toLowerCase());
  const externalDomains = new Set(
    participants
      .map(domainFromEmail)
      .filter((d): d is string => !!d && !d.endsWith("moburst.com") && !d.endsWith("fireflies.ai") && !d.includes("calendar.google")),
  );

  for (const co of companies) {
    const coName = co.name.toLowerCase();
    const coDomain = domainFromUrl(co.company_url);
    const speakers = speakersByCompany.get(co.id) || [];

    let companyHit = false;
    if (coName && title.includes(coName)) companyHit = true;
    if (!companyHit && coDomain) {
      for (const d of externalDomains) {
        if (d === coDomain || d.endsWith(`.${coDomain}`) || coDomain.endsWith(`.${d}`)) {
          companyHit = true;
          break;
        }
      }
    }

    let matchedSpeaker: Speaker | null = null;
    for (const s of speakers) {
      for (const alias of nameAliases(s.name)) {
        if (alias.length < 3) continue;
        if (title.includes(alias)) { matchedSpeaker = s; break; }
      }
      if (matchedSpeaker) break;
    }

    if (companyHit || matchedSpeaker) {
      return { company_id: co.id, speaker_id: matchedSpeaker?.id ?? null };
    }
  }
  return null;
}

async function syncOne(adminClient: any, conn: any) {
  const reasons: Record<string, number> = {
    not_cm_participant: 0,
    no_assigned_client_match: 0,
    duplicate: 0,
    impromptu: 0,
    insert_error: 0,
  };
  try {
    if (!conn.fireflies_email) {
      throw new Error("Connection missing fireflies_email — reconnect required.");
    }

    // Find platform user email to cross-check
    const { data: { user: platformUser } } = await adminClient.auth.admin.getUserById(conn.user_id);
    const platformEmail = platformUser?.email?.toLowerCase() || null;
    const ffEmail = conn.fireflies_email.toLowerCase();
    if (platformEmail && platformEmail !== ffEmail) {
      throw new Error(`Fireflies email (${ffEmail}) does not match platform user (${platformEmail}).`);
    }

    // Derive CM "name" used in companies.campaign_manager
    const cmName = conn.fireflies_name?.trim() || (platformEmail?.split("@")[0] ?? "");
    const cmAliases = nameAliases(cmName);

    // Load this CM's assigned companies + their speakers
    const { data: allCompanies, error: coErr } = await adminClient
      .from("companies")
      .select("id, name, company_url, campaign_manager")
      .is("archived_at", null);
    if (coErr) throw coErr;

    const assignedCompanies: Company[] = (allCompanies || []).filter((c: Company) => {
      const managers = (c.campaign_manager || "")
        .split(",")
        .map((m: string) => m.trim().toLowerCase())
        .filter(Boolean);
      return managers.some((m: string) => cmAliases.includes(m) || cmAliases.some((a) => m.startsWith(a)));
    });

    if (assignedCompanies.length === 0) {
      return { imported: 0, skipped: 0, reasons, warning: `No companies assigned to "${cmName}"` };
    }

    const { data: speakers } = await adminClient
      .from("speakers")
      .select("id, name, company_id")
      .is("archived_at", null)
      .in("company_id", assignedCompanies.map((c) => c.id));

    const speakersByCompany = new Map<string, Speaker[]>();
    (speakers || []).forEach((s: Speaker) => {
      const arr = speakersByCompany.get(s.company_id) || [];
      arr.push(s);
      speakersByCompany.set(s.company_id, arr);
    });

    // Date range
    const now = new Date();
    let fromDate: string;
    if (conn.__backfill_days) {
      fromDate = new Date(now.getTime() - conn.__backfill_days * 86400000).toISOString();
    } else if (conn.last_synced_at) {
      fromDate = conn.last_synced_at;
    } else {
      fromDate = new Date(now.getTime() - 30 * 86400000).toISOString();
    }

    const transcripts = await fetchFirefliesTranscripts(conn.api_key, fromDate, conn.fireflies_user_id);

    // Dedupe
    const ids = transcripts.map((t) => t.id).filter(Boolean);
    let existingIds = new Set<string>();
    if (ids.length > 0) {
      const { data: existing } = await adminClient
        .from("call_notes")
        .select("fireflies_transcript_id")
        .in("fireflies_transcript_id", ids);
      existingIds = new Set((existing || []).map((r: any) => r.fireflies_transcript_id));
    }

    let imported = 0;
    let skipped = 0;

    for (const t of transcripts) {
      if (!t.id) { skipped++; continue; }
      if (existingIds.has(t.id)) { skipped++; reasons.duplicate++; continue; }

      const title = t.title || "Untitled Meeting";
      if (title.toLowerCase().includes("impromptu")) { skipped++; reasons.impromptu++; continue; }

      // Gate 1: CM must be on the call
      const parts = (t.participants || []).map((p) => String(p).toLowerCase());
      const cmOnCall =
        parts.includes(ffEmail) ||
        (t.host_email || "").toLowerCase() === ffEmail ||
        (t.organizer_email || "").toLowerCase() === ffEmail;
      if (!cmOnCall) { skipped++; reasons.not_cm_participant++; continue; }

      // Gate 2: Must match an assigned client
      const match = matchTranscriptToClient(t, assignedCompanies, speakersByCompany);
      if (!match) { skipped++; reasons.no_assigned_client_match++; continue; }

      const meetingDate = t.date ? new Date(t.date).toISOString() : new Date().toISOString();
      const durationSeconds = typeof t.duration === "number" ? Math.round(t.duration * 60) : null;

      const summaryParts: string[] = [];
      if (t.summary?.overview) summaryParts.push(t.summary.overview);
      else if (t.summary?.short_summary) summaryParts.push(t.summary.short_summary);
      if (t.summary?.bullet_gist) summaryParts.push("\n\n**Key points:**\n" + t.summary.bullet_gist);
      const summary = summaryParts.join("") || null;

      let actionItemsArr: any[] = [];
      if (t.summary?.action_items) {
        actionItemsArr = t.summary.action_items
          .split(/\n+/)
          .map((s) => s.trim().replace(/^[-*•]\s*/, ""))
          .filter(Boolean)
          .map((text) => ({ text }));
      }

      const { error } = await adminClient.from("call_notes").insert({
        org_id: ORG_ID,
        fireflies_transcript_id: t.id,
        meeting_title: title,
        meeting_date: meetingDate,
        duration_seconds: durationSeconds,
        summary,
        action_items: actionItemsArr,
        transcript: null,
        participants: t.participants || [],
        source: "fireflies",
        company_id: match.company_id,
        speaker_id: match.speaker_id,
      });

      if (error) {
        console.error(`Insert failed for ${t.id}:`, error.message);
        skipped++;
        reasons.insert_error++;
      } else {
        imported++;
      }
    }

    await adminClient
      .from("fireflies_connections")
      .update({
        last_synced_at: now.toISOString(),
        last_sync_status: "ok",
        last_sync_error: null,
      })
      .eq("user_id", conn.user_id);

    return { imported, skipped, reasons, fetched: transcripts.length };
  } catch (err: any) {
    console.error(`Sync failed for user ${conn.user_id}:`, err.message);
    await adminClient
      .from("fireflies_connections")
      .update({
        last_sync_status: "error",
        last_sync_error: err.message.slice(0, 500),
      })
      .eq("user_id", conn.user_id);
    return { imported: 0, skipped: 0, reasons, error: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const userId = body.user_id as string | undefined;
    const backfillDays = body.backfill_days as number | undefined;

    let query = adminClient.from("fireflies_connections").select("*");
    if (userId) query = query.eq("user_id", userId);
    const { data: connections, error } = await query;
    if (error) throw error;

    const results: any[] = [];
    for (const conn of connections || []) {
      const result = await syncOne(adminClient, { ...conn, __backfill_days: backfillDays });
      results.push({
        user_id: conn.user_id,
        fireflies_email: conn.fireflies_email,
        ...result,
      });
    }

    const totalImported = results.reduce((a, r) => a + (r.imported || 0), 0);
    return new Response(
      JSON.stringify({ success: true, connections: results.length, total_imported: totalImported, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sync-fireflies-meetings error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
