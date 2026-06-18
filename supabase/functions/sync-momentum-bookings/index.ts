import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TEAM_ORG_ID = "11111111-1111-1111-1111-111111111111";
const MOMENTUM_BASE_ID = "appxw22m8TBPlq05F";

function toText(v: any): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) {
    const first = v[0];
    if (typeof first === "object" && first !== null) {
      return (first.value ?? first.name ?? first.Name ?? String(first)).toString();
    }
    return v.map(String).join(", ");
  }
  if (typeof v === "object") {
    // Airtable AI fields: { state, value, isStale }
    if ("value" in v && v.value != null) return String(v.value);
    return (v.name ?? v.Name ?? JSON.stringify(v)).toString();
  }
  return String(v);
}

function toDate(v: any): string | null {
  const t = toText(v);
  if (!t) return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toTs(v: any): string | null {
  const t = toText(v);
  if (!t) return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const pat = Deno.env.get("AIRTABLE_PAT");
    if (!pat) throw new Error("AIRTABLE_PAT not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Discover year tables (^\d{4}$) in the Momentum base
    const metaResp = await fetch(
      `https://api.airtable.com/v0/meta/bases/${MOMENTUM_BASE_ID}/tables`,
      { headers: { Authorization: `Bearer ${pat}` } }
    );
    if (!metaResp.ok) throw new Error(`Airtable meta ${metaResp.status}: ${await metaResp.text()}`);
    const meta = await metaResp.json();
    const yearTables: Array<{ id: string; name: string }> = (meta.tables ?? [])
      .filter((t: any) => /^\d{4}$/.test(t.name))
      .map((t: any) => ({ id: t.id, name: t.name }));

    // 2) Load companies + LTV snapshots for client→company/industry resolution
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, industry")
      .eq("org_id", TEAM_ORG_ID)
      .is("archived_at", null);
    const { data: ltvRows } = await supabase
      .from("ltv_snapshots")
      .select("client_name, company_id, primary_industry")
      .eq("org_id", TEAM_ORG_ID);

    const companyByName = new Map<string, { id: string; industry: string | null }>();
    const companyList: Array<{ id: string; industry: string | null; norm: string }> = [];
    for (const c of companies ?? []) {
      const n = normalize(c.name);
      if (!n) continue;
      if (!companyByName.has(n)) companyByName.set(n, { id: c.id, industry: c.industry ?? null });
      companyList.push({ id: c.id, industry: c.industry ?? null, norm: n });
    }
    companyList.sort((a, b) => b.norm.length - a.norm.length);

    const ltvByName = new Map<string, { company_id: string | null; industry: string | null }>();
    for (const r of ltvRows ?? []) {
      const n = normalize(r.client_name ?? "");
      if (!n) continue;
      if (!ltvByName.has(n)) {
        ltvByName.set(n, {
          company_id: r.company_id,
          industry: r.primary_industry ?? null,
        });
      }
    }

    function matchClient(clientName: string): { company_id: string | null; industry: string | null } {
      if (!clientName) return { company_id: null, industry: null };
      const full = normalize(clientName);

      // 1) Exact company
      const c = companyByName.get(full);
      if (c) return { company_id: c.id, industry: c.industry };

      // 2) Exact LTV client (covers "Person Name - Company" formats)
      const l = ltvByName.get(full);
      if (l) return { company_id: l.company_id, industry: l.industry };

      // 3) Substring against companies (longer first)
      for (const co of companyList) {
        if (co.norm.length >= 4 && full.includes(co.norm)) {
          return { company_id: co.id, industry: co.industry };
        }
      }

      // 4) Substring against LTV (industry only)
      for (const [n, info] of ltvByName.entries()) {
        if (n.length >= 4 && full.includes(n)) {
          return { company_id: info.company_id, industry: info.industry };
        }
      }
      return { company_id: null, industry: null };
    }

    // 3) Pull all records from each year table
    const allRows: any[] = [];
    const byYear: Record<string, number> = {};

    for (const t of yearTables) {
      let offset: string | undefined;
      let count = 0;
      do {
        const url = new URL(`https://api.airtable.com/v0/${MOMENTUM_BASE_ID}/${t.id}`);
        url.searchParams.append("pageSize", "100");
        if (offset) url.searchParams.append("offset", offset);
        const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${pat}` } });
        if (!resp.ok) throw new Error(`Airtable ${t.name} ${resp.status}: ${await resp.text()}`);
        const body = await resp.json();
        for (const rec of body.records ?? []) {
          const f = rec.fields ?? {};
          const clientName = toText(f["Client"]) ?? "";
          const m = matchClient(clientName);
          const podcastIndustry = toText(f["Podcast Industry"]);
          allRows.push({
            org_id: TEAM_ORG_ID,
            airtable_record_id: rec.id,
            year_table: t.name,
            campaign_manager: toText(f["Campaign Manager"]),
            client_name: clientName || null,
            podcast_name: toText(f["Podcast Name"]),
            podcast_url: toText(f["Podcast Link"]) ?? toText(f["iTunes Link"]),
            host_name: toText(f["Host Name"]),
            activity_type: toText(f["Type of Activity"]),
            date_secured: toDate(f["Date Secured"]),
            start_date_time: toTs(f["Start Date and Time"]),
            company_id: m.company_id,
            industry: podcastIndustry ?? m.industry,
            raw_fields: f,
            synced_at: new Date().toISOString(),
          });
          count++;
        }
        offset = body.offset;
      } while (offset);
      byYear[t.name] = count;
    }

    // 4) Upsert in chunks
    const CHUNK = 200;
    let upserted = 0;
    for (let i = 0; i < allRows.length; i += CHUNK) {
      const chunk = allRows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("momentum_bookings")
        .upsert(chunk, { onConflict: "airtable_record_id" });
      if (error) throw error;
      upserted += chunk.length;
    }

    // 5) Delete stale rows
    const liveIds = allRows.map((r) => r.airtable_record_id);
    let deleted = 0;
    if (liveIds.length > 0) {
      const { data: del } = await supabase
        .from("momentum_bookings")
        .delete()
        .eq("org_id", TEAM_ORG_ID)
        .not("airtable_record_id", "in", `(${liveIds.map((id) => `"${id}"`).join(",")})`)
        .select("id");
      deleted = del?.length ?? 0;
    }

    const matchedCount = allRows.filter((r) => r.company_id).length;
    return new Response(
      JSON.stringify({
        success: true,
        tables: yearTables.map((t) => t.name),
        by_year: byYear,
        fetched: allRows.length,
        upserted,
        deleted,
        matched_to_companies: matchedCount,
        unmatched: upserted - matchedCount,
        synced_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-momentum-bookings error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
