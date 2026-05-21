// Compute live Company KPIs (Bookings / Published / Upcoming / Est. Reach).
// Strict rules match the report generator:
//   - Bookings  : action contains "podcast recording" AND date_booked in window
//   - Published : action contains "podcast recording" AND date_published in window
//   - Upcoming  : action contains "podcast recording" AND scheduled future AND !date_published
//   - Est Reach : sum monthly_listens from podcast_metadata_cache for published-in-window
//                 rows (unique apple_podcast_link); lazy-fetch missing via fetch-rephonic-metrics.
//
// Caches result in `company_kpi_cache` for 1 hour per (company_id, window).
// Pass { force: true } to bypass cache.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type WindowKey = "quarter" | "90d" | "all";

interface Kpis {
  bookings: number;
  published: number;
  upcoming: number;
  est_reach: number;
  est_reach_resolved: number;
  est_reach_total_rows: number;
  window: WindowKey;
  range: { start: string; end: string };
  computed_at: string;
  cached: boolean;
}

function getWindowRange(window: WindowKey): { start: string; end: string } {
  const now = new Date();
  let start: Date;
  // We always include a forward horizon for "upcoming"
  const end = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  if (window === "quarter") {
    const q = Math.floor(now.getUTCMonth() / 3);
    start = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
  } else if (window === "90d") {
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else {
    // "all" — pull a wide historical window
    start = new Date(Date.UTC(2000, 0, 1));
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function isPodcastRecording(action: unknown): boolean {
  return typeof action === "string" && action.toLowerCase().includes("podcast recording");
}

function inRange(value: string | undefined, start: Date, end: Date): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  return d >= start && d <= end;
}

function dedupeRows<T extends { record_id?: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const id = r.record_id || JSON.stringify(r);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const company_id: string | undefined = body?.company_id;
    const window: WindowKey = (body?.window as WindowKey) || "quarter";
    const force: boolean = !!body?.force;

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: "company_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1) Cache check
    if (!force) {
      const { data: cached } = await admin
        .from("company_kpi_cache")
        .select("kpis, computed_at, expires_at")
        .eq("company_id", company_id)
        .eq("window", window)
        .maybeSingle();

      if (cached && cached.expires_at && new Date(cached.expires_at).getTime() > Date.now()) {
        return new Response(
          JSON.stringify({ ...(cached.kpis as object), cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 2) Load company + connections
    const { data: company } = await admin
      .from("companies")
      .select("id, org_id")
      .eq("id", company_id)
      .maybeSingle();

    if (!company) {
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: speakers } = await admin
      .from("speakers")
      .select("id, name")
      .eq("company_id", company_id)
      .is("archived_at", null);

    const speakerIds = (speakers || []).map((s: any) => s.id);

    const { data: conns } = await admin
      .from("airtable_connections")
      .select("*")
      .or(
        [
          `company_id.eq.${company_id}`,
          speakerIds.length
            ? `speaker_id.in.(${speakerIds.join(",")})`
            : null,
        ]
          .filter(Boolean)
          .join(","),
      );

    const connections = (conns || []) as any[];

    const range = getWindowRange(window);
    const startDate = new Date(range.start);
    const endDate = new Date(range.end);

    // 3) Fetch rows from every connection (respecting speaker filter for shared tables)
    type Row = {
      record_id: string;
      action: string;
      date_booked?: string;
      date_published?: string;
      scheduled_date_time?: string;
      apple_podcast_link?: string;
      link_to_episode?: string;
      podcast_name?: string;
    };
    const allRows: Row[] = [];

    for (const conn of connections) {
      // If this is a shared multi-speaker table, fan out per speaker name
      const speakerNames: (string | undefined)[] = conn.speaker_id
        ? [(speakers || []).find((s: any) => s.id === conn.speaker_id)?.name]
        : conn.speaker_column_name
        ? (speakers || []).map((s: any) => s.name)
        : [undefined];

      for (const speakerName of speakerNames) {
        try {
          const resp = await admin.functions.invoke("fetch-airtable-data", {
            body: {
              connection_id: conn.id,
              date_range_start: range.start,
              date_range_end: range.end,
              speaker_name: speakerName || undefined,
            },
          });
          const rows = (resp.data?.data || []) as Row[];
          allRows.push(...rows);
        } catch (err) {
          console.error(`fetch-airtable-data failed for ${conn.id}:`, err);
        }
      }
    }

    const rows = dedupeRows(allRows);

    // 4) Compute KPIs
    let bookings = 0;
    let published = 0;
    let upcoming = 0;
    const publishedAppleUrls = new Set<string>();
    const today = Date.now();

    for (const r of rows) {
      if (!isPodcastRecording(r.action)) continue;

      if (inRange(r.date_booked, startDate, endDate)) bookings++;

      if (inRange(r.date_published, startDate, endDate)) {
        published++;
        const url = (r.apple_podcast_link || "").trim();
        if (url) publishedAppleUrls.add(url);
      }

      const sched = r.scheduled_date_time ? new Date(r.scheduled_date_time).getTime() : NaN;
      if (!r.date_published && !isNaN(sched) && sched > today) upcoming++;
    }

    // 5) Est Reach — sum monthly_listens via cache; lazy-fetch misses via Rephonic
    let estReach = 0;
    let estReachResolved = 0;

    if (publishedAppleUrls.size > 0) {
      const urls = [...publishedAppleUrls];

      const { data: cacheRows } = await admin
        .from("podcast_metadata_cache")
        .select("apple_podcast_url, monthly_listens")
        .in("apple_podcast_url", urls);

      const cacheMap = new Map<string, number | null>();
      for (const row of cacheRows || []) {
        cacheMap.set(row.apple_podcast_url, row.monthly_listens ?? null);
      }

      const missing = urls.filter((u) => !cacheMap.has(u));
      if (missing.length > 0) {
        try {
          const resp = await admin.functions.invoke("fetch-rephonic-metrics", {
            body: { apple_podcast_urls: missing },
          });
          const results = (resp.data?.results || {}) as Record<
            string,
            { monthly_listens?: number; podcast_name?: string; social_reach?: number; categories?: string; description?: string; error?: string }
          >;

          // Persist newly-fetched metrics into the cache for downstream reads
          const inserts: any[] = [];
          for (const url of missing) {
            const m = results[url];
            if (!m || m.error) {
              cacheMap.set(url, null);
              continue;
            }
            cacheMap.set(url, m.monthly_listens ?? null);
            inserts.push({
              org_id: company.org_id,
              apple_podcast_url: url,
              podcast_name: m.podcast_name ?? null,
              monthly_listens: m.monthly_listens ?? null,
              social_reach: m.social_reach ?? null,
              categories: m.categories ?? null,
              description: m.description ?? null,
              fetched_at: new Date().toISOString(),
            });
          }
          if (inserts.length > 0) {
            await admin.from("podcast_metadata_cache").insert(inserts);
          }
        } catch (err) {
          console.error("Rephonic lookup failed:", err);
        }
      }

      for (const url of urls) {
        const v = cacheMap.get(url);
        if (typeof v === "number" && v > 0) {
          estReach += v;
          estReachResolved++;
        }
      }
    }

    const kpis: Kpis = {
      bookings,
      published,
      upcoming,
      est_reach: estReach,
      est_reach_resolved: estReachResolved,
      est_reach_total_rows: publishedAppleUrls.size,
      window,
      range,
      computed_at: new Date().toISOString(),
      cached: false,
    };

    // 6) Upsert cache (1h TTL)
    await admin.from("company_kpi_cache").upsert(
      {
        org_id: company.org_id,
        company_id,
        window,
        kpis,
        computed_at: kpis.computed_at,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "company_id,window" },
    );

    return new Response(JSON.stringify(kpis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("compute-company-kpis error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
