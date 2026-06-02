import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TEAM_ORG_ID = "11111111-1111-1111-1111-111111111111";
const LTV_BASE_ID = "appKSO0Fu50JdheHt";
const OFFBOARDING_TABLE_ID = "tbluZpcw7xXjCb1mp";

const FIELD_ALIASES: Record<string, string[]> = {
  client_name: ["Client", "Client Name", "Name"],
  campaign_manager: ["Campaign Manager"],
  date_ended: ["Date ended", "Date Ended"],
};

function getField(fields: Record<string, any>, key: string): any {
  for (const name of FIELD_ALIASES[key] ?? []) {
    if (fields[name] !== undefined && fields[name] !== null && fields[name] !== "") {
      return fields[name];
    }
  }
  return null;
}

function unwrap(v: any): any {
  if (v && typeof v === "object" && !Array.isArray(v) && "value" in v) {
    return (v as any).value;
  }
  return v;
}

function toText(v: any): string | null {
  v = unwrap(v);
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const pat = Deno.env.get("AIRTABLE_PAT");
    if (!pat) throw new Error("AIRTABLE_PAT not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const records: any[] = [];
    let offset: string | undefined;
    do {
      const url = new URL(`https://api.airtable.com/v0/${LTV_BASE_ID}/${OFFBOARDING_TABLE_ID}`);
      if (offset) url.searchParams.append("offset", offset);
      const resp = await fetch(url.toString(), { headers: { Authorization: `Bearer ${pat}` } });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Airtable ${resp.status}: ${txt}`);
      }
      const body = await resp.json();
      records.push(...(body.records ?? []));
      offset = body.offset;
    } while (offset);

    console.log(`Fetched ${records.length} Offboarding rows`);

    // Build company/speaker lookups (same pattern as ltv sync)
    const { data: companies } = await supabase
      .from("companies").select("id, name")
      .eq("org_id", TEAM_ORG_ID).is("archived_at", null);
    const { data: speakers } = await supabase
      .from("speakers").select("id, name, company_id")
      .eq("org_id", TEAM_ORG_ID).is("archived_at", null);

    const companyMap = new Map<string, string>();
    const companyList: Array<{ id: string; norm: string }> = [];
    for (const c of companies ?? []) {
      const n = normalize(c.name);
      if (!n) continue;
      if (!companyMap.has(n)) companyMap.set(n, c.id);
      companyList.push({ id: c.id, norm: n });
    }
    companyList.sort((a, b) => b.norm.length - a.norm.length);

    const speakerMap = new Map<string, { id: string; company_id: string }>();
    const speakerList: Array<{ id: string; company_id: string; norm: string }> = [];
    for (const s of speakers ?? []) {
      const n = normalize(s.name);
      if (!n) continue;
      if (!speakerMap.has(n)) speakerMap.set(n, { id: s.id, company_id: s.company_id });
      speakerList.push({ id: s.id, company_id: s.company_id, norm: n });
    }
    speakerList.sort((a, b) => b.norm.length - a.norm.length);

    const tokenize = (s: string) =>
      s.split(/\s*(?:[-/+&,]|\b(?:and|x)\b)\s*/i).map((p) => p.trim()).filter(Boolean);

    function matchClient(clientName: string): { company_id: string | null; speaker_id: string | null } {
      if (!clientName) return { company_id: null, speaker_id: null };
      const full = normalize(clientName);
      const exactS = speakerMap.get(full);
      if (exactS) return { company_id: exactS.company_id, speaker_id: exactS.id };
      const exactC = companyMap.get(full);
      if (exactC) return { company_id: exactC, speaker_id: null };
      const parts = tokenize(clientName);
      for (const p of parts) {
        const np = normalize(p);
        const sp = np ? speakerMap.get(np) : null;
        if (sp) return { company_id: sp.company_id, speaker_id: sp.id };
      }
      for (const p of parts) {
        const np = normalize(p);
        const co = np ? companyMap.get(np) : null;
        if (co) return { company_id: co, speaker_id: null };
      }
      for (const s of speakerList) {
        if (s.norm.length >= 5 && full.includes(s.norm))
          return { company_id: s.company_id, speaker_id: s.id };
      }
      for (const c of companyList) {
        if (c.norm.length >= 4 && full.includes(c.norm))
          return { company_id: c.id, speaker_id: null };
      }
      return { company_id: null, speaker_id: null };
    }

    const rows = records.map((rec) => {
      const f = rec.fields ?? {};
      const clientName = toText(getField(f, "client_name")) ?? "";
      const m = matchClient(clientName);
      return {
        org_id: TEAM_ORG_ID,
        airtable_record_id: rec.id,
        client_name: clientName,
        campaign_manager: toText(getField(f, "campaign_manager")),
        date_ended: toDate(getField(f, "date_ended")),
        company_id: m.company_id,
        speaker_id: m.speaker_id,
        raw_fields: f,
        synced_at: new Date().toISOString(),
      };
    }).filter((r) => r.client_name);

    const CHUNK = 100;
    let upserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("ltv_offboarding")
        .upsert(chunk, { onConflict: "org_id,airtable_record_id" });
      if (error) throw error;
      upserted += chunk.length;
    }

    const liveIds = rows.map((r) => r.airtable_record_id);
    let deleted = 0;
    if (liveIds.length > 0) {
      const { data: del } = await supabase
        .from("ltv_offboarding")
        .delete()
        .eq("org_id", TEAM_ORG_ID)
        .not("airtable_record_id", "in", `(${liveIds.map((id) => `"${id}"`).join(",")})`)
        .select("id");
      deleted = del?.length ?? 0;
    }

    return new Response(
      JSON.stringify({
        success: true,
        fetched: records.length,
        upserted,
        deleted,
        synced_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-ltv-offboarding error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
