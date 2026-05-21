import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TEAM_ORG_ID = "11111111-1111-1111-1111-111111111111";
const LTV_BASE_ID = "appKSO0Fu50JdheHt";
const LTV_TABLE_ID = "tblJelP3ssvAGvhYb";

// Field name map: Airtable field name -> our column
// Tolerant lookups via getField() handle minor variations.
const FIELD_ALIASES: Record<string, string[]> = {
  client_name: ["Client"],
  campaign_manager: ["Campaign Manager"],
  cohort: ["Cohort"],
  primary_industry: ["Primary Industry"],
  status: ["Status"],
  campaign_success_status: ["Campaign Success Status"],
  fulfilled: ["Fulfilled?", "Fulfilled"],
  payment_paused: ["Payment Paused?", "Payment Paused"],
  offboarding: ["Offboarding?", "Offboarding"],
  renewal_date: ["Renewal Date"],
  renewed: ["Renewed"],
  total_bookings_per_month: ["Total Bookings Per Month"],
  actual_bookings_to_date: ["Actual Bookings to Date"],
  total_planned_bookings_by_eom: ["Total Planned Bookings by EOM_KG", "Total Planned Bookings by EOM"],
  cumulative_pct_fulfilled: ["Cumulative % Fulfilled"],
  deliverables_completed_this_month: ["Deliverables Completed this Month"],
  goal_this_month: ["Goal this Month_KG", "Goal this Month"],
  current_month_cumulative_pct_fulfilled: ["Current Month Cumulative % Fulfilled"],
  adjusted_goal: ["Adjusted Goal"],
  trend_vs_last_month: ["Trend vs Last Month"],
  last_client_checkin: ["Last Client Check-In", "Last Client Check In"],
  next_checkin_scheduled: ["Check-in Call (Upcoming)", "Check-in Call Upcoming"],
  eow_recap_sent: ["EOW Recap Sent?", "EOW Recap Sent"],
};

function getField(fields: Record<string, any>, key: string): any {
  for (const name of FIELD_ALIASES[key] ?? []) {
    if (fields[name] !== undefined && fields[name] !== null && fields[name] !== "") {
      return fields[name];
    }
  }
  return null;
}

function toText(v: any): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) {
    const first = v[0];
    if (typeof first === "object" && first !== null) {
      return (first.name ?? first.Name ?? String(first)).toString();
    }
    return v.map(String).join(", ");
  }
  if (typeof v === "object") {
    return (v.name ?? v.Name ?? JSON.stringify(v)).toString();
  }
  return String(v);
}

function toNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[%,$,]/g, ""));
  return isNaN(n) ? null : n;
}

function toBool(v: any): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  if (["true", "yes", "y", "1", "checked", "✓"].includes(s)) return true;
  if (["false", "no", "n", "0", ""].includes(s)) return false;
  return null;
}

function toDate(v: any): string | null {
  const t = toText(v);
  if (!t) return null;
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const pat = Deno.env.get("AIRTABLE_PAT");
    if (!pat) throw new Error("AIRTABLE_PAT not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all LTV rows with pagination
    const records: any[] = [];
    let offset: string | undefined;
    do {
      const url = new URL(`https://api.airtable.com/v0/${LTV_BASE_ID}/${LTV_TABLE_ID}`);
      if (offset) url.searchParams.append("offset", offset);
      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${pat}` },
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Airtable ${resp.status}: ${txt}`);
      }
      const body = await resp.json();
      records.push(...(body.records ?? []));
      offset = body.offset;
    } while (offset);

    console.log(`Fetched ${records.length} LTV rows`);

    // Load companies for name -> id matching
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .eq("org_id", TEAM_ORG_ID);
    const companyMap = new Map<string, string>();
    for (const c of companies ?? []) {
      companyMap.set(normalize(c.name), c.id);
    }

    // Build upsert rows
    const rows = records.map((rec) => {
      const f = rec.fields ?? {};
      const clientName = toText(getField(f, "client_name")) ?? "";
      const matched = clientName ? companyMap.get(normalize(clientName)) ?? null : null;

      return {
        org_id: TEAM_ORG_ID,
        airtable_record_id: rec.id,
        company_id: matched,
        client_name: clientName,
        campaign_manager: toText(getField(f, "campaign_manager")),
        cohort: toText(getField(f, "cohort")),
        primary_industry: toText(getField(f, "primary_industry")),
        status: toText(getField(f, "status")),
        campaign_success_status: toText(getField(f, "campaign_success_status")),
        fulfilled: toBool(getField(f, "fulfilled")),
        payment_paused: toBool(getField(f, "payment_paused")),
        offboarding: toBool(getField(f, "offboarding")),
        renewal_date: toDate(getField(f, "renewal_date")),
        renewed: toBool(getField(f, "renewed")),
        total_bookings_per_month: toNum(getField(f, "total_bookings_per_month")),
        actual_bookings_to_date: toNum(getField(f, "actual_bookings_to_date")),
        total_planned_bookings_by_eom: toNum(getField(f, "total_planned_bookings_by_eom")),
        cumulative_pct_fulfilled: toNum(getField(f, "cumulative_pct_fulfilled")),
        deliverables_completed_this_month: toNum(getField(f, "deliverables_completed_this_month")),
        goal_this_month: toNum(getField(f, "goal_this_month")),
        current_month_cumulative_pct_fulfilled: toNum(getField(f, "current_month_cumulative_pct_fulfilled")),
        adjusted_goal: toNum(getField(f, "adjusted_goal")),
        trend_vs_last_month: toText(getField(f, "trend_vs_last_month")),
        last_client_checkin: toDate(getField(f, "last_client_checkin")),
        next_checkin_scheduled: toDate(getField(f, "next_checkin_scheduled")),
        eow_recap_sent: toBool(getField(f, "eow_recap_sent")),
        raw_fields: f,
        synced_at: new Date().toISOString(),
      };
    }).filter((r) => r.client_name);

    // Upsert in chunks
    const CHUNK = 100;
    let upserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("ltv_snapshots")
        .upsert(chunk, { onConflict: "airtable_record_id" });
      if (error) throw error;
      upserted += chunk.length;
    }

    const matchedCount = rows.filter((r) => r.company_id).length;
    return new Response(
      JSON.stringify({
        success: true,
        fetched: records.length,
        upserted,
        matched_to_companies: matchedCount,
        unmatched: upserted - matchedCount,
        synced_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-ltv-snapshots error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
