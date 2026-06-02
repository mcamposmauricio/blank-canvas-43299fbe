import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, consent_text, consent_version } = await req.json();
    if (!campaign_id || !consent_text) {
      return new Response(JSON.stringify({ error: "campaign_id and consent_text are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                       req.headers.get("x-real-ip") || null;
    const user_agent = req.headers.get("user-agent") || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.from("consent_records").insert({
      campaign_id,
      consent_text,
      consent_version: consent_version || 1,
      ip_address,
      user_agent,
    }).select("id").single();

    if (error) throw error;

    return new Response(JSON.stringify({ id: data.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
