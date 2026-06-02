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
        JSON.stringify({ error: "RESEND_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, full_name, tenant_name, is_admin_created, temp_password } = await req.json();

    if (!email || !full_name) {
      return new Response(
        JSON.stringify({ error: "email and full_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = "https://avaliacaopsico.lovable.app";
    const empresa = tenant_name || "People Pulse";

    const adminCreatedBlock = is_admin_created
      ? `
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e; font-size: 14px;">🔑 Suas credenciais de acesso:</p>
          <p style="margin: 0; font-size: 14px; color: #78350f;">
            <strong>Email:</strong> ${email}<br/>
            <strong>Senha temporária:</strong> ${temp_password || "(definida pelo administrador)"}
          </p>
          <p style="margin: 8px 0 0 0; font-size: 13px; color: #92400e;">
            ⚠️ Você será solicitado a trocar a senha no primeiro acesso.
          </p>
        </div>`
      : "";

    const selfSignupBlock = !is_admin_created
      ? `
        <p style="font-size: 14px; line-height: 1.7;">
          Agora que sua conta está criada, recomendamos os primeiros passos:
        </p>
        <ol style="font-size: 14px; line-height: 2; padding-left: 20px; color: #374151;">
          <li><strong>Estrutura Organizacional</strong> — Cadastre unidades, departamentos e cargos</li>
          <li><strong>Colaboradores</strong> — Importe sua equipe para a plataforma</li>
          <li><strong>Campanhas</strong> — Crie sua primeira avaliação psicossocial</li>
          <li><strong>Análises</strong> — Acompanhe os resultados em tempo real</li>
        </ol>`
      : `
        <p style="font-size: 14px; line-height: 1.7;">
          Você já pode acessar a plataforma e explorar os recursos disponíveis para o seu perfil.
        </p>`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937; background: #f9fafb;">
  <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0 0 4px 0; font-size: 22px;">Bem-vindo(a) à People Pulse! 🎉</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 14px;">Avaliação Psicossocial Inteligente</p>
  </div>
  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; padding: 32px 24px; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px;">Olá, <strong>${full_name}</strong>!</p>

    <p style="font-size: 14px; line-height: 1.7;">
      ${is_admin_created
        ? `Você foi adicionado(a) à plataforma <strong>People Pulse</strong> pela empresa <strong>${empresa}</strong>.`
        : `Sua conta na <strong>People Pulse</strong> foi criada com sucesso para a empresa <strong>${empresa}</strong>.`
      }
    </p>

    <p style="font-size: 14px; line-height: 1.7;">
      A People Pulse é uma plataforma de <strong>avaliação de riscos psicossociais</strong> que ajuda organizações a
      entender e melhorar o ambiente de trabalho, em conformidade com a <strong>LGPD</strong> e as normas regulatórias (NR-1).
    </p>

    ${adminCreatedBlock}

    ${selfSignupBlock}

    <div style="text-align: center; margin: 32px 0;">
      <a href="${appUrl}" style="background: linear-gradient(135deg, #1e3a5f, #2563eb); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
        Acessar a Plataforma
      </a>
    </div>

    <p style="font-size: 14px; line-height: 1.7;">
      Se precisar de ajuda, entre em contato com o administrador da sua empresa ou responda este email.
    </p>

    <p style="font-size: 14px; margin-top: 24px;">Boas-vindas,</p>
    <p style="font-size: 14px; font-weight: 600;">Equipe People Pulse</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
      People Pulse · Avaliação Psicossocial Inteligente · flewpulse.com.br
    </p>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `People Pulse <noreply@flewpulse.com.br>`,
        to: [email],
        subject: is_admin_created
          ? `Bem-vindo(a) à ${empresa} na People Pulse — Seus dados de acesso`
          : `Bem-vindo(a) à People Pulse! 🎉 Sua conta está pronta`,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Resend error:", errBody);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar email", details: errBody }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    return new Response(
      JSON.stringify({ success: true, message_id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
