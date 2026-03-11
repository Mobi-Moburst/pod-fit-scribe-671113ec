import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const KITCASTER_COMPANY_ID = "0d1e306e-159a-4cf3-a9f5-0a6c40488ed5";

const NICKNAME_MAP: Record<string, string[]> = {
  james: ["jim", "jimmy", "jamie"],
  jim: ["james", "jimmy", "jamie"],
  william: ["will", "bill", "billy", "willy"],
  bill: ["william", "will", "billy"],
  will: ["william", "bill", "billy", "willy"],
  robert: ["rob", "bob", "bobby", "robbie"],
  bob: ["robert", "rob", "bobby"],
  rob: ["robert", "bob", "bobby", "robbie"],
  richard: ["rick", "dick", "rich", "ricky"],
  rick: ["richard", "dick", "rich", "ricky"],
  michael: ["mike", "mikey"],
  mike: ["michael", "mikey"],
  christopher: ["chris"],
  chris: ["christopher"],
  matthew: ["matt"],
  matt: ["matthew"],
  daniel: ["dan", "danny"],
  dan: ["daniel", "danny"],
  joseph: ["joe", "joey"],
  joe: ["joseph", "joey"],
  thomas: ["tom", "tommy"],
  tom: ["thomas", "tommy"],
  anthony: ["tony"],
  tony: ["anthony"],
  edward: ["ed", "eddie", "ted"],
  ed: ["edward", "eddie", "ted"],
  benjamin: ["ben"],
  ben: ["benjamin"],
  nicholas: ["nick"],
  nick: ["nicholas"],
  alexander: ["alex"],
  alex: ["alexander"],
  timothy: ["tim"],
  tim: ["timothy"],
  stephen: ["steve"],
  steven: ["steve"],
  steve: ["stephen", "steven"],
  jonathan: ["jon"],
  jon: ["jonathan"],
  katherine: ["kate", "kathy", "katie"],
  kate: ["katherine", "kathy", "katie"],
  elizabeth: ["liz", "beth", "lizzy"],
  liz: ["elizabeth", "beth", "lizzy"],
  jennifer: ["jen", "jenny"],
  jen: ["jennifer", "jenny"],
  margaret: ["maggie", "meg", "peggy"],
  patricia: ["pat", "patty"],
  rebecca: ["becky"],
  becky: ["rebecca"],
  samantha: ["sam"],
  sam: ["samantha", "samuel"],
  samuel: ["sam"],
};

function getNameVariants(name: string): string[] {
  const lower = name.toLowerCase();
  const variants = [lower];
  if (NICKNAME_MAP[lower]) {
    variants.push(...NICKNAME_MAP[lower]);
  }
  return variants;
}

function namesMatch(name1: string, name2: string): boolean {
  const a = name1.toLowerCase().trim();
  const b = name2.toLowerCase().trim();
  if (a === b) return true;
  const aVariants = getNameVariants(a);
  if (aVariants.includes(b)) return true;
  const aParts = a.split(/\s+/);
  const bParts = b.split(/\s+/);
  if (aParts.length >= 2 && bParts.length >= 2) {
    const aLast = aParts[aParts.length - 1];
    const bLast = bParts[bParts.length - 1];
    if (aLast === bLast) {
      const aFirstVariants = getNameVariants(aParts[0]);
      if (aFirstVariants.includes(bParts[0])) return true;
    }
  }
  return false;
}

function matchSpeaker(
  participantNames: string[],
  meetingTitle: string,
  summary: string | null,
  speakers: any[],
  companies: any[]
): { speakerId: string | null; companyId: string | null } {
  // TIER 0: Company-name matching from meeting title
  const titleLower = meetingTitle.toLowerCase();
  for (const company of companies) {
    const companyName = company.name?.toLowerCase();
    if (companyName && companyName.length >= 3 && titleLower.includes(companyName)) {
      const companySpeakers = speakers.filter((s: any) => s.company_id === company.id);
      if (companySpeakers.length > 0) {
        for (const pName of participantNames) {
          for (const s of companySpeakers) {
            if (namesMatch(pName, s.name)) {
              return { speakerId: s.id, companyId: company.id };
            }
          }
        }
        return { speakerId: companySpeakers[0].id, companyId: company.id };
      }
      return { speakerId: null, companyId: company.id };
    }
  }

  // TIER 1: Exact/partial name match from participants (with nicknames)
  for (const pName of participantNames) {
    for (const s of speakers) {
      if (namesMatch(pName, s.name)) {
        return { speakerId: s.id, companyId: s.company_id };
      }
    }
    const lower = pName.toLowerCase().trim();
    const partial = speakers.find((s: any) => {
      const sLower = s.name.toLowerCase().trim();
      return lower.includes(sLower) || sLower.includes(lower);
    });
    if (partial) return { speakerId: partial.id, companyId: partial.company_id };
  }

  const searchText = `${meetingTitle} ${summary || ""}`.toLowerCase();

  // TIER 2: Full name match in title/summary
  for (const s of speakers) {
    const sName = s.name.toLowerCase().trim();
    if (sName.length >= 3 && searchText.includes(sName)) {
      return { speakerId: s.id, companyId: s.company_id };
    }
  }

  // TIER 3: Name parts match
  for (const s of speakers) {
    const nameParts = s.name.toLowerCase().trim().split(/\s+/).filter((p: string) => p.length >= 3);
    if (nameParts.length >= 2 && nameParts.every((p: string) => searchText.includes(p))) {
      return { speakerId: s.id, companyId: s.company_id };
    }
  }

  // TIER 4: Unique first-name match (with nicknames)
  const firstNameMatches: any[] = [];
  for (const s of speakers) {
    const firstName = s.name.toLowerCase().trim().split(/\s+/)[0];
    const variants = getNameVariants(firstName);
    if (variants.some((v) => v.length >= 3 && searchText.includes(v))) {
      firstNameMatches.push(s);
    }
  }
  if (firstNameMatches.length === 1) {
    return { speakerId: firstNameMatches[0].id, companyId: firstNameMatches[0].company_id };
  }

  // TIER 5: Email local-part match
  const emails = participantNames.filter((p: string) => p.includes("@"));
  for (const email of emails) {
    const localPart = email.split("@")[0].toLowerCase().replace(/[^a-z]/g, "");
    if (localPart.length < 3) continue;
    const matches = speakers.filter((s: any) => {
      const firstName = s.name.toLowerCase().trim().split(/\s+/)[0];
      const variants = getNameVariants(firstName);
      return variants.includes(localPart);
    });
    if (matches.length === 1) {
      return { speakerId: matches[0].id, companyId: matches[0].company_id };
    }
  }

  // TIER 6: Email domain match against company URLs
  for (const email of emails) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) continue;
    const match = companies.find((c: any) => {
      if (!c.company_url) return false;
      const urlDomain = c.company_url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
      return urlDomain === domain;
    });
    if (match) {
      const compSpeaker = speakers.find((s: any) => s.company_id === match.id);
      return { speakerId: compSpeaker?.id || null, companyId: match.id };
    }
  }

  return { speakerId: null, companyId: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("FATHOM_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "FATHOM_API_KEY secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const fathomRes = await fetch(
      "https://api.fathom.video/v1/calls?limit=50",
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!fathomRes.ok) {
      const errText = await fathomRes.text();
      console.error("Fathom API error:", fathomRes.status, errText);
      return new Response(
        JSON.stringify({ error: `Fathom API error: ${fathomRes.status}`, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fathomData = await fathomRes.json();
    const meetings = fathomData.calls || fathomData.meetings || fathomData.data || fathomData || [];

    if (!Array.isArray(meetings)) {
      console.log("Fathom response shape:", JSON.stringify(fathomData).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Unexpected Fathom API response format", shape: Object.keys(fathomData) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingNotes } = await supabase
      .from("call_notes")
      .select("fathom_meeting_id")
      .eq("source", "fathom")
      .not("fathom_meeting_id", "is", null);

    const existingIds = new Set((existingNotes || []).map((n: any) => n.fathom_meeting_id));

    const { data: allSpeakers } = await supabase
      .from("speakers")
      .select("id, name, company_id")
      .eq("org_id", ORG_ID);

    // Filter out Kitcaster internal speakers
    const speakers = (allSpeakers || []).filter(
      (s: any) => s.company_id !== KITCASTER_COMPANY_ID
    );

    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, company_url")
      .eq("org_id", ORG_ID)
      .neq("id", KITCASTER_COMPANY_ID)
      .not("company_url", "is", null);

    let imported = 0;
    let skipped = 0;

    for (const meeting of meetings) {
      const meetingId = String(meeting.id || meeting.call_id || "");
      if (!meetingId || existingIds.has(meetingId)) {
        skipped++;
        continue;
      }

      const participantNames: string[] = [];
      const attendees = meeting.attendees || meeting.participants || [];
      if (Array.isArray(attendees)) {
        for (const a of attendees) {
          if (typeof a === "string") participantNames.push(a);
          else if (a?.name) participantNames.push(a.name);
          else if (a?.email) participantNames.push(a.email);
        }
      }

      const meetingTitle = meeting.title || "Untitled Meeting";
      const summaryText = typeof meeting.summary === "string" ? meeting.summary : (meeting.summary ? JSON.stringify(meeting.summary) : null);
      const { speakerId, companyId } = matchSpeaker(participantNames, meetingTitle, summaryText, speakers, companies || []);

      let transcriptText = "";
      const transcript = meeting.transcript;
      if (typeof transcript === "string") {
        transcriptText = transcript;
      } else if (Array.isArray(transcript)) {
        transcriptText = transcript
          .map((seg: any) => `${seg.speaker || seg.name || "Speaker"}: ${seg.text || seg.content || ""}`)
          .join("\n");
      }

      let actionItemsArray: any[] = [];
      const actionItems = meeting.action_items || [];
      if (Array.isArray(actionItems)) {
        actionItemsArray = actionItems.map((item: any) =>
          typeof item === "string" ? { text: item } : item
        );
      }

      const { error } = await supabase.from("call_notes").insert({
        org_id: ORG_ID,
        fathom_meeting_id: meetingId,
        meeting_title: meetingTitle,
        meeting_date: meeting.created_at || meeting.date || new Date().toISOString(),
        duration_seconds: typeof meeting.duration === "number" ? meeting.duration : null,
        summary: summaryText,
        action_items: actionItemsArray,
        transcript: transcriptText,
        participants: participantNames,
        speaker_id: speakerId,
        company_id: companyId,
        source: "fathom",
      });

      if (error) {
        console.error(`Failed to insert meeting ${meetingId}:`, error.message);
        skipped++;
      } else {
        imported++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, imported, skipped, total: meetings.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-fathom-meetings error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
