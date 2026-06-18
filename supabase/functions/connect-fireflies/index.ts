import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const FIREFLIES_GRAPHQL = "https://api.fireflies.ai/graphql";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { api_key } = await req.json();
    if (!api_key || typeof api_key !== "string" || api_key.trim().length < 10 || api_key.length > 500) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const trimmedKey = api_key.trim();

    // Validate by calling Fireflies users query
    const ffRes = await fetch(FIREFLIES_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${trimmedKey}`,
      },
      body: JSON.stringify({
        query: `query { users { user_id name email } }`,
      }),
    });

    if (!ffRes.ok) {
      const errText = await ffRes.text();
      console.error("Fireflies validation failed:", ffRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Could not validate key with Fireflies. Double-check it and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ffData = await ffRes.json();
    if (ffData.errors) {
      console.error("Fireflies returned errors:", ffData.errors);
      return new Response(
        JSON.stringify({ error: ffData.errors[0]?.message || "Fireflies rejected this key." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const users = ffData.data?.users || [];
    // The key authenticates as one user — match by caller's email if possible, otherwise pick first
    let ffUser = users.find((u: any) => u.email?.toLowerCase() === user.email?.toLowerCase());
    if (!ffUser) ffUser = users[0];

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { error: upsertErr } = await adminClient
      .from("fireflies_connections")
      .upsert({
        user_id: user.id,
        org_id: ORG_ID,
        api_key: trimmedKey,
        fireflies_user_id: ffUser?.user_id ?? null,
        fireflies_email: ffUser?.email ?? null,
        fireflies_name: ffUser?.name ?? null,
        last_sync_status: "pending",
        last_sync_error: null,
      }, { onConflict: "user_id" });

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trigger initial backfill (fire and forget — 30 days)
    adminClient.functions.invoke("sync-fireflies-meetings", {
      body: { user_id: user.id, backfill_days: 30 },
    }).catch((e) => console.error("Initial sync invoke failed:", e));

    return new Response(JSON.stringify({
      success: true,
      fireflies_email: ffUser?.email,
      fireflies_name: ffUser?.name,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("connect-fireflies error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
