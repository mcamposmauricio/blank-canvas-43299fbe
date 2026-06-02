import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY não configurada. Configure a chave no painel de secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { campaign_id, base_url, invitation_ids } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch campaign + tenant data
    const { data: campaign, error: campErr } = await supabase
      .from("survey_campaigns")
      .select("*, survey_templates(name), tenants:tenant_id(name, logo_url, primary_color)")
      .eq("id", campaign_id)
      .single();

    if (campErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campanha não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch pending invitations with employee data
    let query = supabase
      .from("survey_invitations")
      .select("id, token, is_used, employees(full_name, email)")
      .eq("campaign_id", campaign_id)
      .eq("is_used", false);

    // If specific invitation_ids provided, filter by them
    if (Array.isArray(invitation_ids) && invitation_ids.length > 0) {
      query = query.in("id", invitation_ids);
    }

    const { data: invitations, error: invErr } = await query;

    if (invErr) throw invErr;

    const withEmail = (invitations || []).filter(
      (inv: any) => inv.employees?.email
    );

    if (!withEmail.length) {
      return new Response(
        JSON.stringify({ error: "Nenhum convite pendente com email encontrado", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantName = (campaign as any).tenants?.name || "Empresa";
    const tenantColor = (campaign as any).tenants?.primary_color || "#1e3a5f";
    const origin = base_url || "https://avaliacaopsico.lovable.app";

    // Format deadline
    let deadlineText = "";
    if (campaign.ends_at) {
      const d = new Date(campaign.ends_at);
      deadlineText = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const inv of withEmail) {
      const emp = (inv as any).employees;
      const surveyUrl = `${origin}/survey?token=${inv.token}`;

      const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
  <div style="background: ${tenantColor}; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px;">${tenantName}</h1>
  </div>
  <div style="border: 1px solid #e5e7eb; border-top: none; padding: 32px 24px; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px;">Olá, <strong>${emp.full_name}</strong>,</p>

    <p style="font-size: 14px; line-height: 1.7;">
      A <strong>${tenantName}</strong> convida você a participar da nossa <strong>Avaliação de Riscos Psicossociais</strong>.
      O objetivo é entender o nosso ambiente de trabalho e identificar oportunidades reais de melhoria.
    </p>

    <p style="font-size: 14px; line-height: 1.7;">Para que você responda com tranquilidade, reforçamos que:</p>

    <ul style="font-size: 14px; line-height: 2; padding-left: 20px;">
      <li>O questionário é rápido.</li>
      <li>O processo é <strong>100% anônimo e confidencial</strong> (protegido nos termos da LGPD).</li>
      <li>A avaliação deve ser respondida com base nos processos e rotinas do dia a dia, e não com foco em pessoas.</li>
    </ul>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${surveyUrl}" style="background: ${tenantColor}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
        Acesse a avaliação aqui
      </a>
    </div>

    ${deadlineText ? `<p style="font-size: 14px; line-height: 1.7;">A pesquisa fica aberta até o dia <strong>${deadlineText}</strong>. Sua participação é fundamental para construirmos melhorias reais!</p>` : `<p style="font-size: 14px; line-height: 1.7;">Sua participação é fundamental para construirmos melhorias reais!</p>`}

    <p style="font-size: 14px; margin-top: 24px;">Abraços,</p>
    <p style="font-size: 14px; font-weight: 600;">Equipe de RH</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #9ca3af; text-align: center;">Este link é pessoal e intransferível.</p>
  </div>
</body>
</html>`;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${tenantName} <noreply@flewpulse.com.br>`,
            to: [emp.email],
            subject: "Convite: Avaliação de Riscos Psicossociais - Participe!",
            html: htmlBody,
          }),
        });

        if (res.ok) {
          sent++;
        } else {
          const errBody = await res.text();
          failed++;
          errors.push(`${emp.email}: ${errBody}`);
        }
      } catch (e) {
        failed++;
        errors.push(`${emp.email}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        sent,
        failed,
        total: withEmail.length,
        message: `${sent} emails enviados com sucesso`,
        ...(errors.length > 0 && { errors }),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
