// Native AEO Audit using Anthropic Claude with web_search tool
// Generates buyer-journey prompts, queries Claude with grounding, and returns
// payloads matching the existing ContentGapAnalysis + geo_analysis shapes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GEMINI_MODEL = "gemini-2.5-flash";
const OPENAI_MODEL = "gpt-5-mini";

const CACHE_TTL_DAYS = 7;
const DEFAULT_PROMPT_CAP = 25;
const CONCURRENCY = 3;

interface RunBody {
  company_id?: string;
  company_name: string;
  client_domain?: string;
  speaker_name?: string;
  topics?: string[];
  competitors?: Array<{ name: string; domain?: string } | string>;
  prompt_cap?: number;
  model?: string; // e.g. "claude-haiku-4-5" | "claude-sonnet-4-5"
  org_id?: string;
  triggered_by?: string;
  // Richer context
  campaign_strategy?: string;
  talking_points?: string[];
  professional_credentials?: string[];
}

function normalizeDomain(input: string): string {
  if (!input) return "";
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.split("/")[0].split("?")[0];
  return d.replace(/\/$/, "");
}

function competitorName(c: any): string {
  return typeof c === "string" ? c : c?.name ?? "";
}
function competitorDomain(c: any): string {
  if (typeof c === "string") return "";
  return normalizeDomain(c?.domain ?? "");
}

async function generatePrompts(input: {
  company_name: string;
  speaker_name?: string;
  topics: string[];
  competitor_names: string[];
  campaign_strategy?: string;
  talking_points?: string[];
  credentials?: string[];
  cap: number;
}): Promise<Array<{ prompt: string; topic: string; stage: string }>> {
  const sys =
    "You generate realistic buyer-journey search queries that real people would type into AI assistants (ChatGPT, Perplexity, Claude). Ground prompts in the company's actual positioning and named competitors — avoid generic industry boilerplate. Return strict JSON only.";

  const contextLines: string[] = [
    `Company: ${input.company_name}`,
    input.speaker_name ? `Key person: ${input.speaker_name}` : "",
    input.credentials?.length ? `Credentials: ${input.credentials.slice(0, 4).join("; ")}` : "",
    input.campaign_strategy
      ? `Positioning: ${input.campaign_strategy.slice(0, 600)}`
      : "",
    `Topics: ${input.topics.join(", ") || "general industry"}`,
    input.talking_points?.length
      ? `Talking points: ${input.talking_points.slice(0, 8).join("; ")}`
      : "",
    input.competitor_names.length
      ? `Named competitors: ${input.competitor_names.join(", ")}`
      : "",
  ].filter(Boolean);

  const user = `Generate ${input.cap} prompts to audit AI visibility for:
${contextLines.join("\n")}

Distribute across stages:
- awareness (~40%): broad questions about the topics / category a buyer would research first
- consideration (~40%): comparison and "best", "top experts", "who should I follow", explicitly include named competitors where natural
- decision (~20%): brand- or person-led queries (e.g. "is X credible", "{Company} vs {Competitor}")

Use the positioning + talking points to derive specific, realistic queries — not generic ones.

Return JSON: { "prompts": [ { "prompt": string, "topic": string, "stage": "awareness"|"consideration"|"decision" } ] }`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Prompt generation failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  const prompts = (parsed.prompts ?? []).slice(0, input.cap);
  return prompts.map((p: any) => ({
    prompt: String(p.prompt ?? "").trim(),
    topic: String(p.topic ?? "general").trim(),
    stage: ["awareness", "consideration", "decision"].includes(p.stage)
      ? p.stage
      : "awareness",
  })).filter((p: any) => p.prompt.length > 0);
}

interface ClaudeResult {
  text: string;
  citations: Array<{ url: string; title?: string }>;
}

async function queryClaude(prompt: string, model: string): Promise<ClaudeResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: 5 },
      ],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude error ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();

  const citations: Array<{ url: string; title?: string }> = [];
  const textParts: string[] = [];

  for (const block of data.content ?? []) {
    if (block.type === "text") {
      textParts.push(block.text ?? "");
      const cits = block.citations ?? [];
      for (const c of cits) {
        if (c?.url) citations.push({ url: c.url, title: c.title });
      }
    } else if (block.type === "web_search_tool_result") {
      const content = block.content ?? [];
      for (const r of content) {
        if (r?.url) citations.push({ url: r.url, title: r.title });
      }
    }
  }

  return { text: textParts.join("\n"), citations };
}

async function queryGemini(prompt: string): Promise<ClaudeResult> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini error ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .map((p: any) => p?.text ?? "")
    .filter(Boolean)
    .join("\n");
  const citations: Array<{ url: string; title?: string }> = [];
  const chunks = cand?.groundingMetadata?.groundingChunks ?? [];
  for (const ch of chunks) {
    const w = ch?.web;
    if (w?.uri) citations.push({ url: w.uri, title: w.title });
  }
  return { text, citations };
}

async function queryOpenAI(prompt: string): Promise<ClaudeResult> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      tools: [{ type: "web_search" }],
      input: prompt,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const textParts: string[] = [];
  const citations: Array<{ url: string; title?: string }> = [];

  for (const item of data.output ?? []) {
    if (item.type === "message") {
      for (const c of item.content ?? []) {
        if (c.type === "output_text") {
          if (c.text) textParts.push(c.text);
          for (const ann of c.annotations ?? []) {
            if (ann.type === "url_citation" && ann.url) {
              citations.push({ url: ann.url, title: ann.title });
            }
          }
        }
      }
    }
  }
  if (!textParts.length && typeof data.output_text === "string") {
    textParts.push(data.output_text);
  }
  return { text: textParts.join("\n"), citations };
}
function detectPresence(
  result: ClaudeResult,
  clientDomain: string,
  competitors: Array<{ name: string; domain: string }>,
) {
  const haystackText = result.text.toLowerCase();
  const citationDomains = result.citations.map((c) => normalizeDomain(c.url));

  const clientPresent = clientDomain
    ? citationDomains.some((d) => d === clientDomain || d.endsWith("." + clientDomain))
    : false;

  const competitorsPresent: string[] = [];
  for (const c of competitors) {
    const domainHit = c.domain
      ? citationDomains.some((d) => d === c.domain || d.endsWith("." + c.domain))
      : false;
    const nameHit = c.name && haystackText.includes(c.name.toLowerCase());
    if (domainHit || nameHit) competitorsPresent.push(c.name);
  }
  return { clientPresent, competitorsPresent };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      // jitter
      await new Promise((r) => setTimeout(r, 100 + Math.random() * 300));
      try {
        results[idx] = await worker(items[idx], idx);
      } catch (e) {
        results[idx] = { error: (e as Error).message } as any;
      }
    }
  });
  await Promise.all(runners);
  return results;
}

function buildPayloads(input: {
  results: Array<{
    prompt: string;
    topic: string;
    stage: string;
    clientPresent: boolean;
    competitorsPresent: string[];
    citations: Array<{ url: string; title?: string }>;
    enginesMissing?: string[];
    engineCounts?: { claude: number; gemini: number };
  }>;
  competitors: Array<{ name: string }>;
  enginesUsed: string[];
}) {
  const { results, enginesUsed } = input;
  const total = results.length;
  const gaps = results.filter((r) => !r.clientPresent);
  const totalGaps = gaps.length;
  const coverage = total === 0 ? 0 : ((total - totalGaps) / total) * 100;

  const stageMap = new Map<string, { stage: string; gap_count: number; total: number }>();
  for (const r of results) {
    const cur = stageMap.get(r.stage) ?? { stage: r.stage, gap_count: 0, total: 0 };
    cur.total += 1;
    if (!r.clientPresent) cur.gap_count += 1;
    stageMap.set(r.stage, cur);
  }

  const topicMap = new Map<string, { topic: string; gap_count: number; total: number }>();
  for (const r of results) {
    const cur = topicMap.get(r.topic) ?? { topic: r.topic, gap_count: 0, total: 0 };
    cur.total += 1;
    if (!r.clientPresent) cur.gap_count += 1;
    topicMap.set(r.topic, cur);
  }

  const compCount = new Map<string, number>();
  for (const r of results) {
    for (const c of r.competitorsPresent) {
      compCount.set(c, (compCount.get(c) ?? 0) + 1);
    }
  }
  const topCompetitors = [...compCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, mention_count: count }));

  const priorityPrompts = gaps
    .map((g) => ({
      prompt: g.prompt,
      topic: g.topic,
      stage: g.stage,
      engines_missing: g.enginesMissing && g.enginesMissing.length > 0
        ? g.enginesMissing
        : enginesUsed,
      competitors_present: g.competitorsPresent,
    }))
    .sort((a, b) => b.competitors_present.length - a.competitors_present.length)
    .slice(0, 10);

  const content_gap_analysis = {
    total_gaps: totalGaps,
    total_prompts: total,
    coverage_percentage: Math.round(coverage * 10) / 10,
    gaps_by_stage: [...stageMap.values()],
    gaps_by_topic: [...topicMap.values()],
    top_competitors: topCompetitors,
    priority_prompts: priorityPrompts,
  };

  // GEO payload — per-engine counts
  const engineCountTotals = { claude: 0, gemini: 0 };
  for (const r of results) {
    engineCountTotals.claude += r.engineCounts?.claude ?? 0;
    engineCountTotals.gemini += r.engineCounts?.gemini ?? 0;
  }
  const ai_engine_counts = enginesUsed.map((engine) => ({
    engine,
    count: (engineCountTotals as any)[engine] ?? 0,
  }));
  const top_prompts = results
    .map((r) => ({ prompt: r.prompt, count: 1 }))
    .slice(0, 10);
  const topic_distribution = [...topicMap.values()].map((t) => ({
    topic: t.topic,
    count: t.total,
  }));
  const ai_coverage = Math.min(40, Math.round((coverage / 100) * 40));
  const topic_relevance = Math.min(
    30,
    Math.round((topic_distribution.length / Math.max(1, total)) * 60),
  );
  const prompt_diversity = Math.min(30, Math.round((total / DEFAULT_PROMPT_CAP) * 30));

  const geo_analysis = {
    total_podcasts_indexed: 0,
    unique_ai_engines: enginesUsed,
    ai_engine_counts,
    top_prompts,
    topic_distribution,
    geo_score: ai_coverage + topic_relevance + prompt_diversity,
    score_breakdown: { ai_coverage, topic_relevance, prompt_diversity },
    podcast_entries: [],
  };

  return { content_gap_analysis, geo_analysis };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as RunBody;
    if (!body.company_name) {
      return new Response(
        JSON.stringify({ error: "company_name required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cap = Math.min(body.prompt_cap ?? DEFAULT_PROMPT_CAP, 50);
    const model = body.model ?? "claude-haiku-4-5";
    const clientDomain = normalizeDomain(body.client_domain ?? "");
    const competitors = (body.competitors ?? []).map((c) => ({
      name: competitorName(c),
      domain: competitorDomain(c),
    })).filter((c) => c.name);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1) generate prompts
    const prompts = await generatePrompts({
      company_name: body.company_name,
      speaker_name: body.speaker_name,
      topics: body.topics ?? [],
      competitor_names: competitors.map((c) => c.name),
      campaign_strategy: body.campaign_strategy,
      talking_points: body.talking_points,
      credentials: body.professional_credentials,
      cap,
    });

    // 2) cache lookup (per company, 7-day TTL) — load both engines
    const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86400_000).toISOString();
    let cached: any[] = [];
    if (body.company_id) {
      const { data } = await supabase
        .from("aeo_audit_cache")
        .select("prompt, engine, response_text, citations, client_present, competitors_present")
        .eq("company_id", body.company_id)
        .in("engine", ["claude", "gemini", "openai"])
        .gte("created_at", cutoff);
      cached = data ?? [];
    }
    const cacheMap = new Map<string, any>(
      cached.map((c: any) => [`${c.engine}::${c.prompt}`, c]),
    );

    const geminiEnabled = !!GEMINI_API_KEY;
    const openaiEnabled = !!OPENAI_API_KEY;
    const enginesUsed = ["claude"];
    if (geminiEnabled) enginesUsed.push("gemini");
    if (openaiEnabled) enginesUsed.push("openai");

    // 3) query Claude (+ Gemini) per prompt with concurrency
    const queried = await runWithConcurrency(prompts, CONCURRENCY, async (p) => {
      const runEngine = async (
        engine: "claude" | "gemini",
      ): Promise<{ clientPresent: boolean; competitorsPresent: string[]; citations: any[] } | null> => {
        const key = `${engine}::${p.prompt}`;
        const hit = cacheMap.get(key);
        if (hit) {
          return {
            clientPresent: !!hit.client_present,
            competitorsPresent: hit.competitors_present ?? [],
            citations: hit.citations ?? [],
          };
        }
        try {
          const result = engine === "claude"
            ? await queryClaude(p.prompt, model)
            : await queryGemini(p.prompt);
          const { clientPresent, competitorsPresent } = detectPresence(
            result,
            clientDomain,
            competitors,
          );
          if (body.company_id && body.org_id) {
            await supabase.from("aeo_audit_cache").insert({
              org_id: body.org_id,
              company_id: body.company_id,
              prompt: p.prompt,
              engine,
              topic: p.topic,
              stage: p.stage,
              response_text: result.text.slice(0, 8000),
              citations: result.citations,
              client_present: clientPresent,
              competitors_present: competitorsPresent,
            });
          }
          return { clientPresent, competitorsPresent, citations: result.citations };
        } catch (e) {
          console.warn(`[run-aeo-audit] ${engine} failed for prompt:`, (e as Error).message);
          return null;
        }
      };

      const [claudeRes, geminiRes] = await Promise.all([
        runEngine("claude"),
        geminiEnabled ? runEngine("gemini") : Promise.resolve(null),
      ]);

      if (!claudeRes && !geminiRes) {
        return { error: "both engines failed" } as any;
      }

      // Per-engine presence + merged
      const enginesMissing: string[] = [];
      if (claudeRes && !claudeRes.clientPresent) enginesMissing.push("claude");
      if (geminiRes && !geminiRes.clientPresent) enginesMissing.push("gemini");

      const clientPresent = !!(claudeRes?.clientPresent || geminiRes?.clientPresent);
      const competitorsPresent = Array.from(
        new Set([
          ...(claudeRes?.competitorsPresent ?? []),
          ...(geminiRes?.competitorsPresent ?? []),
        ]),
      );
      const citations = [
        ...(claudeRes?.citations ?? []),
        ...(geminiRes?.citations ?? []),
      ];

      return {
        ...p,
        clientPresent,
        competitorsPresent,
        citations,
        enginesMissing,
        engineCounts: {
          claude: claudeRes ? 1 : 0,
          gemini: geminiRes ? 1 : 0,
        },
      };
    });

    const valid = queried.filter((r: any) => r && !r.error);
    const payloads = buildPayloads({ results: valid as any, competitors, enginesUsed });
    const promptsRun = valid.length;
    const promptsFailed = queried.length - valid.length;

    // 4) Persist permanent run snapshot for run-over-run history
    if (body.company_id && body.org_id) {
      const { error: runErr, data: runData } = await supabase
        .from("aeo_audit_runs")
        .insert({
          org_id: body.org_id,
          company_id: body.company_id,
          model,
          prompts_run: promptsRun,
          prompts_failed: promptsFailed,
          content_gap_analysis: payloads.content_gap_analysis,
          geo_analysis: payloads.geo_analysis,
          client_domain: clientDomain || null,
          competitor_names: competitors.map((c) => c.name),
          topics: body.topics ?? [],
          triggered_by: body.triggered_by ?? null,
        })
        .select("id")
        .single();
      if (runErr) {
        console.error("[run-aeo-audit] failed to insert run history:", runErr);
      } else {
        console.log("[run-aeo-audit] saved run snapshot:", runData?.id);
      }
    } else {
      console.warn(
        "[run-aeo-audit] skipped run history — missing company_id/org_id",
        { company_id: body.company_id, org_id: body.org_id },
      );
    }

    return new Response(
      JSON.stringify({
        ...payloads,
        prompts_run: promptsRun,
        prompts_failed: promptsFailed,
        engines: enginesUsed,
        model,
        last_aeo_audit_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[run-aeo-audit] error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
