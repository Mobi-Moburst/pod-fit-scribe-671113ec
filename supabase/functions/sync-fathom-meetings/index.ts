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

    // Fetch recent meetings from Fathom API
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

    // Get existing fathom_meeting_ids to skip duplicates
    const { data: existingNotes } = await supabase
      .from("call_notes")
      .select("fathom_meeting_id")
      .eq("source", "fathom")
      .not("fathom_meeting_id", "is", null);

    const existingIds = new Set((existingNotes || []).map((n: any) => n.fathom_meeting_id));

    // Get speakers for matching
    const { data: speakers } = await supabase
      .from("speakers")
      .select("id, name, company_id")
      .eq("org_id", ORG_ID);

    // Fetch companies for email domain matching
    const { data: companies } = await supabase
      .from("companies")
      .select("id, company_url")
      .eq("org_id", ORG_ID)
      .not("company_url", "is", null);

    const matchSpeaker = (participantNames: string[], meetingTitle: string, summary: string | null) => {
      if (!speakers || speakers.length === 0) return { speakerId: null, companyId: null };
      
      // 1. Exact/partial name match from participants
      for (const pName of participantNames) {
        const lower = pName.toLowerCase().trim();
        const exact = speakers.find((s: any) => s.name.toLowerCase().trim() === lower);
        if (exact) return { speakerId: exact.id, companyId: exact.company_id };
        const partial = speakers.find((s: any) => {
          const sLower = s.name.toLowerCase().trim();
          return lower.includes(sLower) || sLower.includes(lower);
        });
        if (partial) return { speakerId: partial.id, companyId: partial.company_id };
      }

      // 2-4. Title/summary scanning
      const searchText = `${meetingTitle} ${summary || ""}`.toLowerCase();
      
      // 2. Full name match
      for (const s of speakers) {
        const sName = (s as any).name.toLowerCase().trim();
        if (sName.length >= 3 && searchText.includes(sName)) {
          return { speakerId: (s as any).id, companyId: (s as any).company_id };
        }
      }

      // 3. Name parts match
      for (const s of speakers) {
        const sName = (s as any).name.toLowerCase().trim();
        const nameParts = sName.split(/\s+/).filter((p: string) => p.length >= 3);
        if (nameParts.length >= 2 && nameParts.every((p: string) => searchText.includes(p))) {
          return { speakerId: (s as any).id, companyId: (s as any).company_id };
        }
      }

      // 4. Unique first-name match
      const firstNameMatches: any[] = [];
      for (const s of speakers) {
        const firstName = (s as any).name.toLowerCase().trim().split(/\s+/)[0];
        if (firstName.length >= 3 && searchText.includes(firstName)) {
          firstNameMatches.push(s);
        }
      }
      if (firstNameMatches.length === 1) {
        return { speakerId: firstNameMatches[0].id, companyId: firstNameMatches[0].company_id };
      }

      // 5. Email local-part match against speaker first names
      const emails = participantNames.filter((p: string) => p.includes("@"));
      for (const email of emails) {
        const localPart = email.split("@")[0].toLowerCase().replace(/[^a-z]/g, "");
        if (localPart.length < 3) continue;
        const matches = speakers.filter((s: any) => {
          const firstName = s.name.toLowerCase().trim().split(/\s+/)[0];
          return firstName === localPart;
        });
        if (matches.length === 1) {
          return { speakerId: matches[0].id, companyId: matches[0].company_id };
        }
      }

      // 6. Email domain match against company URLs
      let matchedCompanyId: string | null = null;
      let matchedSpeakerId: string | null = null;
      if (companies && companies.length > 0) {
        for (const email of emails) {
          const domain = email.split("@")[1]?.toLowerCase();
          if (!domain) continue;
          const match = companies.find((c: any) => {
            if (!c.company_url) return false;
            const urlDomain = c.company_url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
            return urlDomain === domain;
          });
          if (match) {
            matchedCompanyId = match.id;
            const compSpeaker = speakers.find((s: any) => s.company_id === match.id);
            if (compSpeaker) matchedSpeakerId = (compSpeaker as any).id;
            break;
          }
        }
      }
      if (matchedCompanyId) return { speakerId: matchedSpeakerId, companyId: matchedCompanyId };

      return { speakerId: null, companyId: null };
    };

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
      const { speakerId, companyId } = matchSpeaker(participantNames, meetingTitle, summaryText);

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
        meeting_title: meeting.title || "Untitled Meeting",
        meeting_date: meeting.created_at || meeting.date || new Date().toISOString(),
        duration_seconds: typeof meeting.duration === "number" ? meeting.duration : null,
        summary: typeof meeting.summary === "string" ? meeting.summary : (meeting.summary ? JSON.stringify(meeting.summary) : null),
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
