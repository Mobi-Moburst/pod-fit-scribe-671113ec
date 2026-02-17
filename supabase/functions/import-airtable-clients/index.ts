import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      base_id,
      table_id,
      client_column = "Client",
      campaign_manager_column = "Campaign Manager",
    } = await req.json();

    if (!base_id || !table_id) {
      return new Response(
        JSON.stringify({ error: "base_id and table_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pat = Deno.env.get("AIRTABLE_PAT");
    if (!pat) {
      return new Response(
        JSON.stringify({ error: "AIRTABLE_PAT secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all records with pagination
    const allRecords: any[] = [];
    let offset: string | undefined;

    do {
      const url = new URL(`https://api.airtable.com/v0/${base_id}/${table_id}`);
      // Only request the columns we need
      url.searchParams.append("fields[]", client_column);
      url.searchParams.append("fields[]", campaign_manager_column);
      if (offset) url.searchParams.append("offset", offset);

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${pat}` },
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Airtable API error:", resp.status, errText);
        return new Response(
          JSON.stringify({ error: `Airtable API error: ${resp.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await resp.json();
      allRecords.push(...(body.records || []));
      offset = body.offset;
    } while (offset);

    // Deduplicate by client name, keeping the first campaign manager found
    const clientMap = new Map<string, string>();
    for (const rec of allRecords) {
      const name = (rec.fields?.[client_column] || "").toString().trim();
      if (!name) continue;
      if (!clientMap.has(name.toLowerCase())) {
        let cm = rec.fields?.[campaign_manager_column] || "";
        // Handle linked records (arrays) and objects
        if (Array.isArray(cm)) cm = cm[0] || "";
        if (typeof cm === "object" && cm !== null) cm = cm.name || cm.Name || String(cm);
        cm = String(cm).trim();
        clientMap.set(name.toLowerCase(), cm);
      }
    }

    // Build sorted result preserving original casing from first occurrence
    const nameMap = new Map<string, string>();
    for (const rec of allRecords) {
      const name = (rec.fields?.[client_column] || "").toString().trim();
      if (name && !nameMap.has(name.toLowerCase())) {
        nameMap.set(name.toLowerCase(), name);
      }
    }

    const clients = Array.from(clientMap.entries())
      .map(([key, cm]) => ({
        name: nameMap.get(key) || key,
        campaign_manager: cm,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return new Response(
      JSON.stringify({ clients, total_records: allRecords.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("import-airtable-clients error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

