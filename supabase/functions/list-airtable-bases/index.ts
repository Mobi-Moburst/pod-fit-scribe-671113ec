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
    const pat = Deno.env.get("AIRTABLE_PAT");
    if (!pat) {
      return new Response(
        JSON.stringify({ error: "AIRTABLE_PAT secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { base_id } = await req.json().catch(() => ({}));

    if (base_id) {
      // Fetch tables for a specific base
      const resp = await fetch(
        `https://api.airtable.com/v0/meta/bases/${base_id}/tables`,
        { headers: { Authorization: `Bearer ${pat}` } }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Airtable Meta API error:", resp.status, errText);
        return new Response(
          JSON.stringify({ error: `Airtable API error: ${resp.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await resp.json();
      const tables = (body.tables || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        fields: (t.fields || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.type,
        })),
      }));

      return new Response(
        JSON.stringify({ tables }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Fetch all bases with pagination
      const allBases: any[] = [];
      let offset: string | undefined;

      do {
        const url = new URL("https://api.airtable.com/v0/meta/bases");
        if (offset) url.searchParams.append("offset", offset);

        const resp = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${pat}` },
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error("Airtable Meta API error:", resp.status, errText);
          return new Response(
            JSON.stringify({ error: `Airtable API error: ${resp.status}` }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const body = await resp.json();
        allBases.push(...(body.bases || []));
        offset = body.offset;
      } while (offset);

      const bases = allBases.map((b: any) => ({
        id: b.id,
        name: b.name,
      }));

      return new Response(
        JSON.stringify({ bases }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("list-airtable-bases error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
