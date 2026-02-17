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

    // Extract fields from Fathom webhook payload
    const meetingId = payload.id || payload.meeting?.id || payload.call_id;
    const meetingTitle = payload.title || payload.meeting?.title || "Untitled Meeting";
    const meetingDate = payload.created_at || payload.meeting?.created_at || new Date().toISOString();
    const duration = payload.duration || payload.meeting?.duration || null;
    const summary = payload.summary || payload.meeting?.summary || null;
    const transcript = payload.transcript || payload.meeting?.transcript || null;
    const actionItems = payload.action_items || payload.meeting?.action_items || [];
    const attendees = payload.attendees || payload.participants || payload.meeting?.attendees || [];

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

    if (participantNames.length > 0) {
      const { data: speakers } = await supabase
        .from("speakers")
        .select("id, name, company_id")
        .eq("org_id", ORG_ID);

      if (speakers && speakers.length > 0) {
        for (const pName of participantNames) {
          const lower = pName.toLowerCase().trim();
          // Exact match
          const exact = speakers.find((s: any) => s.name.toLowerCase().trim() === lower);
          if (exact) {
            speakerId = exact.id;
            companyId = exact.company_id;
            break;
          }
          // Partial match (participant name contains speaker name or vice versa)
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
