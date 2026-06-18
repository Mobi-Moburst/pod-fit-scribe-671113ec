import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CANONICAL = [
  "AI Productivity",
  "Enterprise AI",
  "Data & AI",
  "Cybersecurity",
  "Fintech",
  "Healthcare",
  "HealthTech",
  "Education",
  "EdTech",
  "SaaS",
  "DevTools",
  "Marketing & Growth",
  "Sales & RevOps",
  "HR & People",
  "E-commerce",
  "Consumer",
  "Media & Content",
  "Real Estate",
  "Legal",
  "Climate & Energy",
  "Manufacturing",
  "Logistics",
  "Consulting",
  "Venture Capital",
  "Nonprofit",
  "Other",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { company_ids } = await req.json();
    if (!Array.isArray(company_ids) || company_ids.length === 0) {
      return new Response(JSON.stringify({ error: "company_ids required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: companies, error: cErr } = await supabase
      .from("companies")
      .select("id, name, company_url, product_type, notes, tags")
      .in("id", company_ids);
    if (cErr) throw cErr;
    if (!companies?.length) return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: speakers } = await supabase
      .from("speakers")
      .select("company_id, name, title, campaign_strategy, target_audiences, talking_points")
      .in("company_id", company_ids);
    const speakersByCompany = new Map<string, any[]>();
    (speakers || []).forEach((s: any) => {
      const arr = speakersByCompany.get(s.company_id) || [];
      arr.push(s);
      speakersByCompany.set(s.company_id, arr);
    });

    const items = companies.map((c: any) => {
      const ss = speakersByCompany.get(c.id) || [];
      return {
        id: c.id,
        name: c.name,
        url: c.company_url || "",
        product_type: c.product_type || "",
        notes: (c.notes || "").slice(0, 400),
        tags: c.tags || [],
        speakers: ss.slice(0, 3).map((s) => ({
          name: s.name,
          title: s.title || "",
          audiences: (s.target_audiences || []).slice(0, 5),
          talking_points: (s.talking_points || []).slice(0, 5),
          strategy: (s.campaign_strategy || "").slice(0, 300),
        })),
      };
    });

    const systemPrompt = `You classify B2B companies into a single primary industry category for a CRM. Pick the ONE best-fit category from this list (or "Other"):\n${CANONICAL.join(", ")}\n\nRules:\n- Use company name, URL, product type, notes, and speaker positioning to infer industry.\n- Prefer the most specific fit (e.g., "Cybersecurity" over "SaaS"; "Fintech" over "Enterprise AI" when finance is core).\n- Return exactly one category per company from the provided list.`;

    const userPrompt = `Classify these companies:\n\n${JSON.stringify(items, null, 2)}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify_companies",
            description: "Return industry classification per company",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      industry: { type: "string", enum: CANONICAL },
                    },
                    required: ["id", "industry"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["results"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify_companies" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI failure" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { results: [] };
    const results: { id: string; industry: string }[] = parsed.results || [];

    // Persist
    for (const r of results) {
      if (!r.id || !r.industry) continue;
      await supabase.from("companies").update({ industry: r.industry }).eq("id", r.id);
    }

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("infer-company-industries error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
