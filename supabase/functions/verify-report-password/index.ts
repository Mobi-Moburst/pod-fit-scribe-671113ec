import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple SHA-256 hash for report passwords (not user auth passwords)
async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return encodeHex(new Uint8Array(hashBuffer));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { slug, password, action } = await req.json();

    if (!slug) {
      return new Response(JSON.stringify({ success: false, error: "slug is required" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Action: set or remove password (called by CMs)
    if (action === 'set') {
      if (!password) {
        // Remove password
        const { error } = await supabase
          .from('reports')
          .update({ report_password_hash: null })
          .eq('public_slug', slug);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, removed: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const hash = await hashPassword(password);
      const { error } = await supabase
        .from('reports')
        .update({ report_password_hash: hash })
        .eq('public_slug', slug);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: verify password (called by clients)
    if (!password) {
      return new Response(JSON.stringify({ success: false, error: "password is required" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('report_password_hash')
      .eq('public_slug', slug)
      .eq('is_published', true)
      .single();

    if (fetchError || !report) {
      return new Response(JSON.stringify({ success: false, error: "Report not found" }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!report.report_password_hash) {
      // No password set — allow access
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const inputHash = await hashPassword(password);
    const isValid = inputHash === report.report_password_hash;

    return new Response(JSON.stringify({ success: isValid }), {
      status: isValid ? 200 : 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
