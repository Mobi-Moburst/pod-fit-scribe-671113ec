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
    const payload = await req.json();
    console.log("Fathom webhook received:", JSON.stringify(payload).slice(0, 500));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Extract fields from Fathom webhook payload (real Fathom structure)
    const meetingId = payload.id || payload.call_id || payload.share_url || payload.created_at;
    const meetingTitle = payload.title || payload.meeting_title || "Untitled Meeting";
    const meetingDate = payload.created_at || new Date().toISOString();
    const duration = payload.duration || payload.duration_seconds || null;
    
    // Fathom sends summary in default_summary.markdown_formatted
    const summary = typeof payload.summary === "string" 
      ? payload.summary 
      : payload.default_summary?.markdown_formatted 
        || payload.default_summary?.text 
        || (typeof payload.default_summary === "string" ? payload.default_summary : null);
    
    const transcript = payload.transcript || null;
    const actionItems = payload.action_items || [];
    
    // Fathom uses calendar_invitees for attendees
    const attendees = payload.attendees || payload.participants || payload.calendar_invitees || [];

    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: "No meeting ID found in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize transcript to string
    let transcriptText = "";
    if (typeof transcript === "string") {
      transcriptText = transcript;
    } else if (Array.isArray(transcript)) {
      transcriptText = transcript
        .map((seg: any) => `${seg.speaker || seg.name || "Speaker"}: ${seg.text || seg.content || ""}`)
        .join("\n");
    }

    // Normalize action items
    let actionItemsArray: any[] = [];
    if (Array.isArray(actionItems)) {
      actionItemsArray = actionItems.map((item: any) =>
        typeof item === "string" ? { text: item } : item
      );
    }

    // Extract participant names for matching
    const participantNames: string[] = [];
    if (Array.isArray(attendees)) {
      for (const a of attendees) {
        if (typeof a === "string") participantNames.push(a);
        else if (a?.name) participantNames.push(a.name);
        else if (a?.email) participantNames.push(a.email);
      }
    }

    // Attempt speaker matching
    let speakerId: string | null = null;
    let companyId: string | null = null;

    const { data: speakers } = await supabase
      .from("speakers")
      .select("id, name, company_id")
      .eq("org_id", ORG_ID);

    if (speakers && speakers.length > 0) {
      // 1. Match by participant names
      for (const pName of participantNames) {
        const lower = pName.toLowerCase().trim();
        const exact = speakers.find((s: any) => s.name.toLowerCase().trim() === lower);
        if (exact) {
          speakerId = exact.id;
          companyId = exact.company_id;
          break;
        }
        const partial = speakers.find((s: any) => {
          const sLower = s.name.toLowerCase().trim();
          return lower.includes(sLower) || sLower.includes(lower);
        });
        if (partial) {
          speakerId = partial.id;
          companyId = partial.company_id;
          break;
        }
      }

      // 2. Fallback: scan meeting title and summary for speaker names
      if (!speakerId) {
        const searchText = `${meetingTitle} ${summary || ""}`.toLowerCase();
        
        // Try full name match first
        for (const s of speakers) {
          const sName = (s as any).name.toLowerCase().trim();
          if (sName.length >= 3 && searchText.includes(sName)) {
            speakerId = (s as any).id;
            companyId = (s as any).company_id;
            console.log(`Matched speaker "${(s as any).name}" from title/summary (full name)`);
            break;
          }
        }

        // Try first+last name parts match
        if (!speakerId) {
          for (const s of speakers) {
            const sName = (s as any).name.toLowerCase().trim();
            const nameParts = sName.split(/\s+/).filter((p: string) => p.length >= 3);
            if (nameParts.length >= 2 && nameParts.every((p: string) => searchText.includes(p))) {
              speakerId = (s as any).id;
              companyId = (s as any).company_id;
              console.log(`Matched speaker "${(s as any).name}" from title/summary (name parts)`);
              break;
            }
          }
        }

        // Try first-name-only match (only if exactly one speaker has that first name)
        if (!speakerId) {
          const firstNameMatches: any[] = [];
          for (const s of speakers) {
            const firstName = (s as any).name.toLowerCase().trim().split(/\s+/)[0];
            if (firstName.length >= 3 && searchText.includes(firstName)) {
              firstNameMatches.push(s);
            }
          }
          if (firstNameMatches.length === 1) {
            speakerId = firstNameMatches[0].id;
            companyId = firstNameMatches[0].company_id;
            console.log(`Matched speaker "${firstNameMatches[0].name}" from title/summary (first name unique)`);
          }
        }
      }
    }

    // Upsert the call note
    const { error } = await supabase.from("call_notes").upsert(
      {
        org_id: ORG_ID,
        fathom_meeting_id: String(meetingId),
        meeting_title: meetingTitle,
        meeting_date: meetingDate,
        duration_seconds: typeof duration === "number" ? duration : null,
        summary: typeof summary === "string" ? summary : JSON.stringify(summary),
        action_items: actionItemsArray,
        transcript: transcriptText,
        participants: participantNames,
        speaker_id: speakerId,
        company_id: companyId,
        source: "fathom",
      },
      { onConflict: "fathom_meeting_id" }
    );

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, speaker_matched: !!speakerId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fathom-webhook error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
