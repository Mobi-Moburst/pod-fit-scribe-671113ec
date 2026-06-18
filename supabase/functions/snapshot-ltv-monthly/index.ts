import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TEAM_ORG_ID = "11111111-1111-1111-1111-111111111111";

function currentYearMonthUTC(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Allow caller to override the month tag (e.g. backfill prior month);
    // default to the current UTC month.
    let yearMonth = currentYearMonthUTC();
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body?.year_month && /^\d{4}-\d{2}$/.test(body.year_month)) {
          yearMonth = body.year_month;
        }
      }
    } catch (_) {
      // ignore body parse errors
    }

    // Snapshot LTV roster
    const { data: ltv, error: ltvErr } = await supabase
      .from("ltv_snapshots")
      .select(
        "airtable_record_id, client_name, campaign_manager, status, campaign_success_status, cohort, offboarding, zz_complete, renewal_date, renewed, goal_this_month, deliverables_completed_this_month, actual_bookings_to_date, total_bookings_per_month, total_planned_bookings_by_eom, current_month_cumulative_pct_fulfilled, raw_fields"
      )
      .eq("org_id", TEAM_ORG_ID);
    if (ltvErr) throw ltvErr;

    const ltvRows = (ltv ?? []).map((r: any) => ({
      org_id: TEAM_ORG_ID,
      year_month: yearMonth,
      source: "ltv",
      airtable_record_id: r.airtable_record_id,
      client_name: r.client_name,
      campaign_manager: r.campaign_manager,
      status: r.status,
      campaign_success_status: r.campaign_success_status,
      cohort: r.cohort,
      offboarding: r.offboarding,
      zz_complete: r.zz_complete,
      renewal_date: r.renewal_date,
      renewed: r.renewed,
      goal_this_month: r.goal_this_month,
      deliverables_completed_this_month: r.deliverables_completed_this_month,
      actual_bookings_to_date: r.actual_bookings_to_date,
      total_bookings_per_month: r.total_bookings_per_month,
      total_planned_bookings_by_eom: r.total_planned_bookings_by_eom,
      current_month_cumulative_pct_fulfilled: r.current_month_cumulative_pct_fulfilled,
      date_ended: null,
      raw_fields: r.raw_fields ?? {},
      snapshotted_at: new Date().toISOString(),
    }));

    // Snapshot Offboarding table
    const { data: off, error: offErr } = await supabase
      .from("ltv_offboarding")
      .select("airtable_record_id, client_name, campaign_manager, date_ended, raw_fields")
      .eq("org_id", TEAM_ORG_ID);
    if (offErr) throw offErr;

    const offRows = (off ?? []).map((r: any) => ({
      org_id: TEAM_ORG_ID,
      year_month: yearMonth,
      source: "offboarding",
      airtable_record_id: r.airtable_record_id,
      client_name: r.client_name,
      campaign_manager: r.campaign_manager,
      date_ended: r.date_ended,
      raw_fields: r.raw_fields ?? {},
      snapshotted_at: new Date().toISOString(),
    }));

    const allRows = [...ltvRows, ...offRows];
    const CHUNK = 200;
    let upserted = 0;
    for (let i = 0; i < allRows.length; i += CHUNK) {
      const chunk = allRows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("ltv_monthly_snapshots")
        .upsert(chunk, { onConflict: "org_id,source,airtable_record_id,year_month" });
      if (error) throw error;
      upserted += chunk.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        year_month: yearMonth,
        ltv_count: ltvRows.length,
        offboarding_count: offRows.length,
        upserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("snapshot-ltv-monthly error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
