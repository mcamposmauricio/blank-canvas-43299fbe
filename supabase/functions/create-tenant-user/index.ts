import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildWelcomeHtml(name: string, email: string, password: string, empresa: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;background:#f9fafb;">
  <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:white;margin:0 0 4px 0;font-size:22px;">Bem-vindo(a) à People Pulse! 🎉</h1>
    <p style="color:rgba(255,255,255,0.8);margin:0;font-size:14px;">Avaliação Psicossocial Inteligente</p>
  </div>
  <div style="background:white;border:1px solid #e5e7eb;border-top:none;padding:32px 24px;border-radius:0 0 12px 12px;">
    <p style="font-size:16px;">Olá, <strong>${name}</strong>!</p>
    <p style="font-size:14px;line-height:1.7;">Você foi adicionado(a) à plataforma <strong>People Pulse</strong> pela empresa <strong>${empresa}</strong>.</p>
    <p style="font-size:14px;line-height:1.7;">A People Pulse é uma plataforma de <strong>avaliação de riscos psicossociais</strong> que ajuda organizações a entender e melhorar o ambiente de trabalho, em conformidade com a <strong>LGPD</strong> e as normas regulatórias (NR-1).</p>
    <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px 0;font-weight:600;color:#92400e;font-size:14px;">🔑 Suas credenciais de acesso:</p>
      <p style="margin:0;font-size:14px;color:#78350f;"><strong>Email:</strong> ${email}<br/><strong>Senha temporária:</strong> ${password}</p>
      <p style="margin:8px 0 0 0;font-size:13px;color:#92400e;">⚠️ Você será solicitado a trocar a senha no primeiro acesso.</p>
    </div>
    <p style="font-size:14px;line-height:1.7;">Você já pode acessar a plataforma e explorar os recursos disponíveis para o seu perfil.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="https://avaliacaopsico.lovable.app" style="background:linear-gradient(135deg,#1e3a5f,#2563eb);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">Acessar a Plataforma</a>
    </div>
    <p style="font-size:14px;">Boas-vindas,</p>
    <p style="font-size:14px;font-weight:600;">Equipe People Pulse</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="font-size:12px;color:#9ca3af;text-align:center;">People Pulse · Avaliação Psicossocial Inteligente · flewpulse.com.br</p>
  </div>
</body></html>`;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, email, password, full_name, role } = await req.json();
    if (!tenant_id || !email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "tenant_id, email, password, full_name and role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Create user
    let userId: string;
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { tenant_id, full_name },
    });

    if (createErr) {
      // Handle duplicate email: link existing user to this tenant
      if (createErr.message?.includes("already been registered")) {
        const { data: { users } } = await adminClient.auth.admin.listUsers();
        const existing = users.find((u: any) => u.email === email);
        if (!existing) {
          return new Response(JSON.stringify({ error: "Usuário não encontrado no sistema de autenticação" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check if already has profile in this tenant
        const { data: existingProfile } = await adminClient
          .from("profiles")
          .select("user_id")
          .eq("user_id", existing.id)
          .eq("tenant_id", tenant_id)
          .maybeSingle();

        if (existingProfile) {
          return new Response(JSON.stringify({ error: "Este usuário já pertence a este tenant" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        userId = existing.id;

        // Update user password and metadata
        await adminClient.auth.admin.updateUserById(userId, {
          password,
          user_metadata: { tenant_id, full_name },
        });

        // Create profile for this tenant
        await adminClient
          .from("profiles")
          .upsert({ user_id: userId, tenant_id, full_name, email, must_change_password: true }, { onConflict: "user_id" });

      } else {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = created.user.id;
    }

    // Wait for trigger
    await new Promise((r) => setTimeout(r, 500));

    // Ensure profile has correct tenant_id and force password change
    await adminClient
      .from("profiles")
      .update({ tenant_id, full_name, must_change_password: true })
      .eq("user_id", userId);

    // For gestor, assign first department
    if (role === "gestor") {
      const { data: departments } = await adminClient
        .from("departments")
        .select("id")
        .eq("tenant_id", tenant_id)
        .limit(1);
      if (departments?.[0]?.id) {
        await adminClient
          .from("profiles")
          .update({ department_id: departments[0].id })
          .eq("user_id", userId);
      }
    }

    // Remove auto-assigned admin_rh
    await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("tenant_id", tenant_id);

    // Insert chosen role
    await adminClient
      .from("user_roles")
      .insert({ user_id: userId, tenant_id, role });

    // Send welcome email (fire-and-forget)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      // Fetch tenant name
      const { data: tenantData } = await adminClient
        .from("tenants")
        .select("name")
        .eq("id", tenant_id)
        .single();

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `People Pulse <noreply@flewpulse.com.br>`,
            to: [email],
            subject: `Bem-vindo(a) à ${tenantData?.name || "People Pulse"} — Seus dados de acesso`,
            html: buildWelcomeHtml(full_name, email, password, tenantData?.name || "People Pulse"),
          }),
        });
      } catch (emailErr) {
        console.error("Welcome email error:", emailErr);
      }
    }

    return new Response(JSON.stringify({ user_id: userId, email, role, status: "created" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
