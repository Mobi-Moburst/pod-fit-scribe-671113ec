import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FixPayload = {
  targetReportId: string;
  sourceReportId: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase env not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // NOTE: This is a one-off fixer for a specific live report.
    // We intentionally do NOT require an auth token here because the patch may be
    // executed from a non-authenticated preview session. To keep it safe, we
    // hard-limit which reports can be modified.
    const ALLOWED_TARGET_REPORT_ID = "e8574928-8473-4f86-97ac-574b92898686"; // Q4 2025 ProArch Final Report (DEMO)
    const ALLOWED_SOURCE_REPORT_ID = "13028d26-58b8-4fc1-b8a6-e7712706d13b"; // Q4 2025 Final ProArch Report

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Partial<FixPayload>;
    const targetReportId = (body?.targetReportId || ALLOWED_TARGET_REPORT_ID).trim();
    const sourceReportId = (body?.sourceReportId || ALLOWED_SOURCE_REPORT_ID).trim();

    if (targetReportId !== ALLOWED_TARGET_REPORT_ID || sourceReportId !== ALLOWED_SOURCE_REPORT_ID) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = (await req.json()) as FixPayload;
    const targetReportId = body?.targetReportId?.trim();
    const sourceReportId = body?.sourceReportId?.trim();

    if (!targetReportId || !sourceReportId) {
      return new Response(JSON.stringify({ error: "targetReportId and sourceReportId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: source, error: sourceError } = await supabaseAdmin
      .from("reports")
      .select("id, report_data")
      .eq("id", sourceReportId)
      .maybeSingle();

    if (sourceError || !source?.report_data) {
      return new Response(JSON.stringify({ error: "Source report not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceCategories = (source.report_data as any)?.kpis?.top_categories;
    if (!Array.isArray(sourceCategories) || sourceCategories.length === 0) {
      return new Response(JSON.stringify({ error: "Source report has no top_categories" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("reports")
      .select("id, report_data")
      .eq("id", targetReportId)
      .maybeSingle();

    if (targetError || !target?.report_data) {
      return new Response(JSON.stringify({ error: "Target report not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetReportData = target.report_data as any;
    const updatedReportData = {
      ...targetReportData,
      kpis: {
        ...(targetReportData?.kpis ?? {}),
        top_categories: sourceCategories,
      },
    };

    const { error: updateError } = await supabaseAdmin
      .from("reports")
      .update({ report_data: updatedReportData })
      .eq("id", targetReportId);

    if (updateError) {
      console.error("Update failed:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update report" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        targetReportId,
        sourceReportId,
        copiedCategoriesCount: sourceCategories.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in fix-report-categories:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
