import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ORG_ID = "11111111-1111-1111-1111-111111111111";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch unmatched call notes
    const { data: unmatched, error: fetchErr } = await supabase
      .from("call_notes")
      .select("id, participants, meeting_title, summary")
      .eq("org_id", ORG_ID)
      .is("speaker_id", null);

    if (fetchErr) throw fetchErr;
    if (!unmatched || unmatched.length === 0) {
      return new Response(
        JSON.stringify({ success: true, matched: 0, total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch speakers and companies for matching
    const { data: speakers } = await supabase
      .from("speakers")
      .select("id, name, company_id")
      .eq("org_id", ORG_ID);

    const { data: companies } = await supabase
      .from("companies")
      .select("id, company_url")
      .eq("org_id", ORG_ID)
      .not("company_url", "is", null);

    if (!speakers || speakers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, matched: 0, total: unmatched.length, reason: "no speakers in DB" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let matched = 0;

    for (const note of unmatched) {
      const participantNames: string[] = [];
      if (Array.isArray(note.participants)) {
        for (const p of note.participants) {
          if (typeof p === "string") participantNames.push(p);
          else if (p?.name) participantNames.push(p.name);
          else if (p?.email) participantNames.push(p.email);
        }
      }

      const result = matchSpeaker(participantNames, note.meeting_title || "", note.summary || "", speakers, companies || []);

      if (result.speakerId || result.companyId) {
        const update: Record<string, string | null> = {};
        if (result.speakerId) update.speaker_id = result.speakerId;
        if (result.companyId) update.company_id = result.companyId;

        const { error: updateErr } = await supabase
          .from("call_notes")
          .update(update)
          .eq("id", note.id);

        if (!updateErr) {
          matched++;
          console.log(`Matched note "${note.meeting_title}" -> speaker ${result.speakerId}`);
        } else {
          console.error(`Failed to update note ${note.id}:`, updateErr.message);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, matched, total: unmatched.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("rematch-call-notes error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function matchSpeaker(
  participantNames: string[],
  meetingTitle: string,
  summary: string,
  speakers: any[],
  companies: any[]
): { speakerId: string | null; companyId: string | null } {
  // 1. Exact/partial name match from participants
  for (const pName of participantNames) {
    const lower = pName.toLowerCase().trim();
    const exact = speakers.find((s) => s.name.toLowerCase().trim() === lower);
    if (exact) return { speakerId: exact.id, companyId: exact.company_id };
    const partial = speakers.find((s) => {
      const sLower = s.name.toLowerCase().trim();
      return lower.includes(sLower) || sLower.includes(lower);
    });
    if (partial) return { speakerId: partial.id, companyId: partial.company_id };
  }

  const searchText = `${meetingTitle} ${summary}`.toLowerCase();

  // 2. Full name match in title/summary
  for (const s of speakers) {
    const sName = s.name.toLowerCase().trim();
    if (sName.length >= 3 && searchText.includes(sName)) {
      return { speakerId: s.id, companyId: s.company_id };
    }
  }

  // 3. Name parts match
  for (const s of speakers) {
    const nameParts = s.name.toLowerCase().trim().split(/\s+/).filter((p: string) => p.length >= 3);
    if (nameParts.length >= 2 && nameParts.every((p: string) => searchText.includes(p))) {
      return { speakerId: s.id, companyId: s.company_id };
    }
  }

  // 4. Unique first-name match
  const firstNameMatches: any[] = [];
  for (const s of speakers) {
    const firstName = s.name.toLowerCase().trim().split(/\s+/)[0];
    if (firstName.length >= 3 && searchText.includes(firstName)) {
      firstNameMatches.push(s);
    }
  }
  if (firstNameMatches.length === 1) {
    return { speakerId: firstNameMatches[0].id, companyId: firstNameMatches[0].company_id };
  }

  // 5. Email local-part match
  const emails = participantNames.filter((p) => p.includes("@"));
  for (const email of emails) {
    const localPart = email.split("@")[0].toLowerCase().replace(/[^a-z]/g, "");
    if (localPart.length < 3) continue;
    const matches = speakers.filter((s) => s.name.toLowerCase().trim().split(/\s+/)[0] === localPart);
    if (matches.length === 1) {
      return { speakerId: matches[0].id, companyId: matches[0].company_id };
    }
  }

  // 6. Email domain match against company URLs
  for (const email of emails) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) continue;
    const match = companies.find((c) => {
      if (!c.company_url) return false;
      const urlDomain = c.company_url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
      return urlDomain === domain;
    });
    if (match) {
      const compSpeaker = speakers.find((s) => s.company_id === match.id);
      return { speakerId: compSpeaker?.id || null, companyId: match.id };
    }
  }

  return { speakerId: null, companyId: null };
}
