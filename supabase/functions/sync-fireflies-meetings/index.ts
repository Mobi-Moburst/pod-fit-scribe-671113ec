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
  date: number | null; // ms timestamp
  duration: number | null; // minutes
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

async function fetchFirefliesTranscripts(apiKey: string, fromDate: string): Promise<FFTranscript[]> {
  const results: FFTranscript[] = [];
  let skip = 0;
  const pageSize = 50;
  // Cap to 10 pages = 500 transcripts per sync, safety net
  for (let page = 0; page < 10; page++) {
    const res = await fetch(FIREFLIES_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: `
          query Transcripts($limit: Int, $skip: Int, $fromDate: DateTime) {
            transcripts(limit: $limit, skip: $skip, fromDate: $fromDate) {
              id
              title
              date
              duration
              participants
              host_email
              organizer_email
              transcript_url
              summary {
                overview
                short_summary
                action_items
                bullet_gist
                keywords
              }
            }
          }
        `,
        variables: { limit: pageSize, skip, fromDate },
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

async function syncOne(adminClient: any, conn: any): Promise<{ imported: number; skipped: number; error?: string }> {
  try {
    // Determine fromDate: backfill_days override > last_synced_at > 30 days
    const now = new Date();
    let fromDate: string;
    if (conn.__backfill_days) {
      fromDate = new Date(now.getTime() - conn.__backfill_days * 86400000).toISOString();
    } else if (conn.last_synced_at) {
      fromDate = conn.last_synced_at;
    } else {
      fromDate = new Date(now.getTime() - 30 * 86400000).toISOString();
    }

    const transcripts = await fetchFirefliesTranscripts(conn.api_key, fromDate);

    // Dedupe against existing fireflies_transcript_id
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
      if (!t.id || existingIds.has(t.id)) { skipped++; continue; }
      const title = t.title || "Untitled Meeting";
      if (title.toLowerCase().includes("impromptu")) { skipped++; continue; }

      const meetingDate = t.date ? new Date(t.date).toISOString() : new Date().toISOString();
      const durationSeconds = typeof t.duration === "number" ? Math.round(t.duration * 60) : null;

      // Build summary text from available fields
      const summaryParts: string[] = [];
      if (t.summary?.overview) summaryParts.push(t.summary.overview);
      else if (t.summary?.short_summary) summaryParts.push(t.summary.short_summary);
      if (t.summary?.bullet_gist) summaryParts.push("\n\n**Key points:**\n" + t.summary.bullet_gist);
      const summary = summaryParts.join("") || null;

      // action_items in Fireflies is a string; split into items
      let actionItemsArr: any[] = [];
      if (t.summary?.action_items) {
        actionItemsArr = t.summary.action_items
          .split(/\n+/)
          .map((s) => s.trim().replace(/^[-*•]\s*/, ""))
          .filter(Boolean)
          .map((text) => ({ text }));
      }

      const participants = Array.isArray(t.participants) ? t.participants : [];

      const { error } = await adminClient.from("call_notes").insert({
        org_id: ORG_ID,
        fireflies_transcript_id: t.id,
        meeting_title: title,
        meeting_date: meetingDate,
        duration_seconds: durationSeconds,
        summary,
        action_items: actionItemsArr,
        transcript: null, // sentences not pulled by default to keep payload small
        participants,
        source: "fireflies",
      });

      if (error) {
        console.error(`Insert failed for ${t.id}:`, error.message);
        skipped++;
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

    return { imported, skipped };
  } catch (err: any) {
    console.error(`Sync failed for user ${conn.user_id}:`, err.message);
    await adminClient
      .from("fireflies_connections")
      .update({
        last_sync_status: "error",
        last_sync_error: err.message.slice(0, 500),
      })
      .eq("user_id", conn.user_id);
    return { imported: 0, skipped: 0, error: err.message };
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
