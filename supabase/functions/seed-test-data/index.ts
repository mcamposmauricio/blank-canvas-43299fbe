import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const campaignName = body.campaign_name || `Campanha Teste People Pulse — ${new Date().toLocaleDateString("pt-BR")}`;
    const skipScoring = body.skip_scoring || false;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Find PPI template
    const { data: template } = await supabase
      .from("survey_templates")
      .select("id, tenant_id")
      .ilike("name", "%PPI%")
      .limit(1)
      .single();
    if (!template) throw new Error("Template PPI não encontrado. Execute o seed do questionário primeiro.");

    const tenantId = template.tenant_id;

    // 2. Get all items for the template
    const { data: dimensions } = await supabase
      .from("survey_dimensions")
      .select("id, name")
      .eq("template_id", template.id);
    if (!dimensions?.length) throw new Error("Nenhuma dimensão encontrada no template PPI.");

    const dimIds = dimensions.map(d => d.id);
    const { data: items } = await supabase
      .from("survey_items")
      .select("id, dimension_id")
      .in("dimension_id", dimIds);
    if (!items?.length) throw new Error("Nenhum item encontrado no template PPI.");

    // 3. Get active employees
    const { data: employees } = await supabase
      .from("employees")
      .select("id, department_id, job_role_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);
    if (!employees?.length) throw new Error("Nenhum colaborador ativo encontrado.");

    // Get org_unit_id for each employee's department
    const deptIds = [...new Set(employees.filter(e => e.department_id).map(e => e.department_id!))];
    const deptOrgMap = new Map<string, string>();
    if (deptIds.length > 0) {
      const { data: depts } = await supabase
        .from("departments")
        .select("id, org_unit_id")
        .in("id", deptIds);
      if (depts) depts.forEach(d => deptOrgMap.set(d.id, d.org_unit_id));
    }

    // 4. Create campaign
    const now = new Date();
    const startsAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endsAt = now.toISOString();

    const { data: campaign, error: campErr } = await supabase
      .from("survey_campaigns")
      .insert({
        name: campaignName,
        template_id: template.id,
        tenant_id: tenantId,
        status: "active",
        starts_at: startsAt,
        ends_at: endsAt,
        description: "Campanha gerada automaticamente para validação do padrão People Pulse.",
      })
      .select("id")
      .single();
    if (campErr) throw campErr;

    const campaignId = campaign.id;

    // 5. Create invitations
    const invites = employees.map(emp => ({
      campaign_id: campaignId,
      employee_id: emp.id,
    }));
    const { data: inviteRows, error: invErr } = await supabase
      .from("survey_invitations")
      .insert(invites)
      .select("id, employee_id, token");
    if (invErr) throw invErr;

    // 6. Simulate responses
    const responseRows: any[] = [];
    const answerRows: any[] = [];
    const consentRows: any[] = [];

    for (const inv of inviteRows!) {
      const emp = employees.find(e => e.id === inv.employee_id);
      const orgUnitId = emp?.department_id ? deptOrgMap.get(emp.department_id) || null : null;

      const responseId = crypto.randomUUID();
      responseRows.push({
        id: responseId,
        campaign_id: campaignId,
        is_complete: true,
        completed_at: now.toISOString(),
        department_id: emp?.department_id || null,
        org_unit_id: orgUnitId,
        job_role_id: emp?.job_role_id || null,
      });

      // Random Likert 1-5 for each item
      for (const item of items!) {
        answerRows.push({
          response_id: responseId,
          item_id: item.id,
          value: Math.floor(Math.random() * 5) + 1,
        });
      }

      // Consent record
      consentRows.push({
        campaign_id: campaignId,
        consent_text: "Concordo com os termos de participação na avaliação psicossocial organizacional. Este instrumento avalia fatores organizacionais de risco psicossocial relacionados ao trabalho.",
        consent_version: 1,
      });
    }

    // Insert responses in batches
    for (let i = 0; i < responseRows.length; i += 100) {
      await supabase.from("survey_responses").insert(responseRows.slice(i, i + 100));
    }

    // Insert answers in batches
    for (let i = 0; i < answerRows.length; i += 500) {
      await supabase.from("survey_answers").insert(answerRows.slice(i, i + 500));
    }

    // Insert consent
    for (let i = 0; i < consentRows.length; i += 100) {
      await supabase.from("consent_records").insert(consentRows.slice(i, i + 100));
    }

    // Mark invitations as used
    const invIds = inviteRows!.map(i => i.id);
    for (let i = 0; i < invIds.length; i += 100) {
      await supabase.from("survey_invitations")
        .update({ is_used: true, used_at: now.toISOString() })
        .in("id", invIds.slice(i, i + 100));
    }

    // 7. Trigger scoring
    let scoringResult = null;
    if (!skipScoring) {
      const scoringUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-scoring`;
      const res = await fetch(scoringUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      scoringResult = await res.json();
    }

    // 8. Close campaign
    await supabase.from("survey_campaigns")
      .update({ status: "closed" })
      .eq("id", campaignId);

    return new Response(
      JSON.stringify({
        message: "Campanha de teste criada com sucesso",
        campaign_id: campaignId,
        campaign_name: campaignName,
        employees_count: employees.length,
        responses_count: responseRows.length,
        answers_count: answerRows.length,
        consents_count: consentRows.length,
        scoring: scoringResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
