import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TENANT_ID = "babf34c7-9548-4442-a5a4-7bb67bbee7bd";

// Weighted random Likert value — bias controls mean (higher = riskier)
function weightedLikert(bias: number): number {
  // bias 1..5, we shift distribution toward it
  const weights = [1, 2, 3, 4, 5].map(v => Math.exp(-0.5 * Math.pow(v - bias, 2)));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i + 1;
  }
  return 3;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("seed-demo-tenant v2 started");
    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id || TENANT_ID;
    console.log("tenant_id:", tenantId);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── CLEANUP existing data ───
    // Get existing campaign IDs
    const { data: existingCamps } = await supabase
      .from("survey_campaigns").select("id").eq("tenant_id", tenantId);
    const campIds = existingCamps?.map(c => c.id) || [];

    if (campIds.length > 0) {
      // Get response IDs
      const { data: existingResps } = await supabase
        .from("survey_responses").select("id").in("campaign_id", campIds);
      const respIds = existingResps?.map(r => r.id) || [];

      if (respIds.length > 0) {
        for (let i = 0; i < respIds.length; i += 100) {
          await supabase.from("response_scores").delete().in("response_id", respIds.slice(i, i + 100));
          await supabase.from("survey_answers").delete().in("response_id", respIds.slice(i, i + 100));
        }
        for (let i = 0; i < respIds.length; i += 100)
          await supabase.from("survey_responses").delete().in("id", respIds.slice(i, i + 100));
      }

      for (const cid of campIds) {
        await supabase.from("campaign_scores").delete().eq("campaign_id", cid);
        await supabase.from("group_scores").delete().eq("campaign_id", cid);
        await supabase.from("risk_alerts").delete().eq("campaign_id", cid);
        await supabase.from("consent_records").delete().eq("campaign_id", cid);
        await supabase.from("survey_invitations").delete().eq("campaign_id", cid);
      }
      await supabase.from("survey_campaigns").delete().eq("tenant_id", tenantId);
    }

    // Delete template chain
    const { data: existingTemplates } = await supabase
      .from("survey_templates").select("id").eq("tenant_id", tenantId);
    if (existingTemplates?.length) {
      const tmplIds = existingTemplates.map(t => t.id);
      const { data: existingDims } = await supabase
        .from("survey_dimensions").select("id").in("template_id", tmplIds);
      if (existingDims?.length) {
        const dimIds = existingDims.map(d => d.id);
        for (let i = 0; i < dimIds.length; i += 100)
          await supabase.from("survey_items").delete().in("dimension_id", dimIds.slice(i, i + 100));
        await supabase.from("survey_dimensions").delete().in("template_id", tmplIds);
      }
      await supabase.from("survey_templates").delete().eq("tenant_id", tenantId);
    }

    await supabase.from("action_plans").delete().eq("tenant_id", tenantId);
    await supabase.from("audit_logs").delete().eq("tenant_id", tenantId);
    await supabase.from("reports").delete().eq("tenant_id", tenantId);
    await supabase.from("employees").delete().eq("tenant_id", tenantId);
    await supabase.from("departments").delete().eq("tenant_id", tenantId);
    await supabase.from("org_units").delete().eq("tenant_id", tenantId);
    await supabase.from("job_roles").delete().eq("tenant_id", tenantId);
    console.log("cleanup done");

    // ─── 1. ORG UNITS ───
    const orgUnitsData = [
      { name: "Matriz São Paulo", tenant_id: tenantId },
      { name: "Filial Rio de Janeiro", tenant_id: tenantId },
      { name: "Filial Belo Horizonte", tenant_id: tenantId },
    ];
    const { data: orgUnits, error: ouErr } = await supabase
      .from("org_units").insert(orgUnitsData).select("id, name");
    if (ouErr) throw new Error(`org_units: ${ouErr.message}`);
    console.log("org_units created:", orgUnits?.length);

    const ouMap = new Map(orgUnits!.map(u => [u.name, u.id]));
    const spId = ouMap.get("Matriz São Paulo")!;
    const rjId = ouMap.get("Filial Rio de Janeiro")!;
    const bhId = ouMap.get("Filial Belo Horizonte")!;

    // ─── 2. DEPARTMENTS ───
    const deptsData = [
      { name: "Recursos Humanos", org_unit_id: spId, tenant_id: tenantId },
      { name: "Financeiro", org_unit_id: spId, tenant_id: tenantId },
      { name: "Tecnologia da Informação", org_unit_id: spId, tenant_id: tenantId },
      { name: "Comercial", org_unit_id: rjId, tenant_id: tenantId },
      { name: "Operações", org_unit_id: rjId, tenant_id: tenantId },
      { name: "Marketing", org_unit_id: rjId, tenant_id: tenantId },
      { name: "Jurídico", org_unit_id: bhId, tenant_id: tenantId },
      { name: "Engenharia", org_unit_id: bhId, tenant_id: tenantId },
    ];
    const { data: depts, error: dErr } = await supabase
      .from("departments").insert(deptsData).select("id, name, org_unit_id");
    if (dErr) throw new Error(`departments: ${dErr.message}`);
    console.log("depts created:", depts?.length);

    // ─── 3. JOB ROLES ───
    const roleNames = [
      "Analista", "Coordenador", "Gerente", "Diretor", "Estagiário",
      "Assistente", "Supervisor", "Especialista", "Consultor",
      "Técnico", "Auxiliar", "Trainee",
    ];
    const { data: roles, error: rErr } = await supabase
      .from("job_roles")
      .insert(roleNames.map(name => ({ name, tenant_id: tenantId })))
      .select("id, name");
    if (rErr) throw new Error(`job_roles: ${rErr.message}`);
    console.log("roles created:", roles?.length);

    // ─── 4. EMPLOYEES ───
    const brNames = [
      "Ana Silva", "Bruno Costa", "Carla Oliveira", "Daniel Santos", "Elena Pereira",
      "Felipe Souza", "Gabriela Lima", "Henrique Almeida", "Isabela Rodrigues", "João Ferreira",
      "Karen Martins", "Lucas Araújo", "Mariana Barbosa", "Nicolas Ribeiro", "Olívia Cardoso",
      "Pedro Gomes", "Queila Nascimento", "Rafael Teixeira", "Sara Moreira", "Thiago Carvalho",
      "Ursula Monteiro", "Vinícius Correia", "Wanda Duarte", "Xavier Mendes", "Yara Pinto",
      "Amanda Rocha", "Bernardo Fonseca", "Cíntia Lopes", "Diego Machado", "Elisa Freitas",
      "Fábio Vieira", "Giovana Nunes", "Hugo Campos", "Ingrid Castro", "Juliano Ramos",
      "Larissa Moura", "Marcelo Dias", "Natália Azevedo", "Oscar Andrade", "Patrícia Melo",
      "Roberto Cunha", "Simone Nogueira", "Tânia Borges", "Valter Reis", "Zilda Tavares",
    ];

    const employeesData = brNames.map((name, i) => {
      const dept = depts![i % depts!.length];
      const role = roles![i % roles!.length];
      const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".");
      return {
        full_name: name,
        email: `${slug}@testepsico.exemplo.br`,
        department_id: dept.id,
        job_role_id: role.id,
        tenant_id: tenantId,
        is_active: true,
      };
    });

    const { data: employees, error: eErr } = await supabase
      .from("employees").insert(employeesData).select("id, department_id, job_role_id");
    if (eErr) throw new Error(`employees: ${eErr.message}`);
    console.log("employees created:", employees?.length);

    // Build dept → org_unit map
    const deptOrgMap = new Map(depts!.map(d => [d.id, d.org_unit_id]));

    console.log("starting template creation");
    // ─── 5. SURVEY TEMPLATE ───
    const { data: template, error: tErr } = await supabase
      .from("survey_templates")
      .insert({
        name: "PPI — Fatores Psicossociais Integrados v1.0",
        description: "Instrumento padronizado para avaliação de fatores de risco psicossocial organizacional conforme NR-1.",
        tenant_id: tenantId,
        is_active: true,
        version: 1,
      })
      .select("id")
      .single();
    if (tErr) throw new Error(`template: ${tErr.message}`);

    // ─── 6. DIMENSIONS ───
    const dimDefs = [
      { name: "Demandas de Trabalho", description: "Carga, ritmo e exigências cognitivas/emocionais do trabalho.", bias: 3.8 },
      { name: "Organização do Trabalho", description: "Clareza de papéis, autonomia e participação nas decisões.", bias: 3.2 },
      { name: "Relações Sociais", description: "Qualidade das relações interpessoais, suporte social e cooperação.", bias: 2.2 },
      { name: "Liderança e Justiça Organizacional", description: "Confiança na liderança, equidade e reconhecimento.", bias: 3.6 },
      { name: "Trabalho e Vida Pessoal", description: "Equilíbrio entre demandas profissionais e pessoais.", bias: 3.5 },
      { name: "Ambiente Físico", description: "Condições físicas, ergonômicas e de segurança do ambiente de trabalho.", bias: 2.8 },
      { name: "Significado do Trabalho", description: "Sentido, propósito e satisfação com as atividades realizadas.", bias: 2.4 },
      { name: "Saúde e Bem-Estar", description: "Percepção geral de saúde física e mental relacionada ao trabalho.", bias: 3.0 },
    ];

    const { data: dimensions, error: dimErr } = await supabase
      .from("survey_dimensions")
      .insert(dimDefs.map((d, i) => ({
        template_id: template!.id,
        name: d.name,
        description: d.description,
        sort_order: i + 1,
      })))
      .select("id, name, sort_order");
    if (dimErr) throw new Error(`dimensions: ${dimErr.message}`);

    // Map dimension name to {id, bias}
    const dimInfoMap = new Map<string, { id: string; bias: number }>();
    for (const dim of dimensions!) {
      const def = dimDefs.find(d => d.name === dim.name);
      dimInfoMap.set(dim.name, { id: dim.id, bias: def?.bias ?? 3 });
    }

    // ─── 7. SURVEY ITEMS (30 questions) ───
    const itemsDefs: { dimName: string; text: string; inverted: boolean }[] = [
      // Demandas de Trabalho (4 items)
      { dimName: "Demandas de Trabalho", text: "Meu volume de trabalho é excessivo para o tempo disponível.", inverted: false },
      { dimName: "Demandas de Trabalho", text: "Consigo realizar minhas tarefas sem pressão excessiva de prazos.", inverted: true },
      { dimName: "Demandas de Trabalho", text: "Meu trabalho exige esforço emocional intenso.", inverted: false },
      { dimName: "Demandas de Trabalho", text: "Frequentemente preciso trabalhar além do horário regular.", inverted: false },
      // Organização do Trabalho (4 items)
      { dimName: "Organização do Trabalho", text: "Minhas responsabilidades e papéis são claramente definidos.", inverted: true },
      { dimName: "Organização do Trabalho", text: "Tenho autonomia para decidir como realizar meu trabalho.", inverted: true },
      { dimName: "Organização do Trabalho", text: "Sinto que não participo das decisões que afetam meu trabalho.", inverted: false },
      { dimName: "Organização do Trabalho", text: "Recebo informações claras sobre o que é esperado de mim.", inverted: true },
      // Relações Sociais (4 items)
      { dimName: "Relações Sociais", text: "Posso contar com o apoio dos meus colegas quando preciso.", inverted: true },
      { dimName: "Relações Sociais", text: "O ambiente de trabalho é colaborativo e respeitoso.", inverted: true },
      { dimName: "Relações Sociais", text: "Já vivenciei ou presenciei situações de assédio no trabalho.", inverted: false },
      { dimName: "Relações Sociais", text: "Sinto-me isolado(a) no meu ambiente de trabalho.", inverted: false },
      // Liderança e Justiça (4 items)
      { dimName: "Liderança e Justiça Organizacional", text: "Confio nas decisões tomadas pela minha liderança.", inverted: true },
      { dimName: "Liderança e Justiça Organizacional", text: "O tratamento na empresa é justo e equitativo.", inverted: true },
      { dimName: "Liderança e Justiça Organizacional", text: "Não recebo feedback adequado sobre meu desempenho.", inverted: false },
      { dimName: "Liderança e Justiça Organizacional", text: "Sinto que meu trabalho é reconhecido e valorizado.", inverted: true },
      // Trabalho e Vida Pessoal (4 items)
      { dimName: "Trabalho e Vida Pessoal", text: "Consigo equilibrar minha vida profissional e pessoal.", inverted: true },
      { dimName: "Trabalho e Vida Pessoal", text: "O trabalho interfere negativamente na minha vida familiar.", inverted: false },
      { dimName: "Trabalho e Vida Pessoal", text: "Tenho tempo suficiente para atividades de lazer e descanso.", inverted: true },
      { dimName: "Trabalho e Vida Pessoal", text: "Sinto culpa quando não estou disponível fora do expediente.", inverted: false },
      // Ambiente Físico (3 items)
      { dimName: "Ambiente Físico", text: "As condições físicas do meu local de trabalho são adequadas.", inverted: true },
      { dimName: "Ambiente Físico", text: "Estou exposto(a) a ruído, temperatura ou iluminação inadequados.", inverted: false },
      { dimName: "Ambiente Físico", text: "Os equipamentos e ferramentas disponíveis são suficientes.", inverted: true },
      // Significado do Trabalho (3 items)
      { dimName: "Significado do Trabalho", text: "Sinto que meu trabalho tem propósito e significado.", inverted: true },
      { dimName: "Significado do Trabalho", text: "Minhas atividades diárias me proporcionam satisfação.", inverted: true },
      { dimName: "Significado do Trabalho", text: "Sinto orgulho de fazer parte desta organização.", inverted: true },
      // Saúde e Bem-Estar (4 items)
      { dimName: "Saúde e Bem-Estar", text: "Tenho me sentido emocionalmente esgotado(a) pelo trabalho.", inverted: false },
      { dimName: "Saúde e Bem-Estar", text: "Minha saúde física piorou desde que comecei nesta função.", inverted: false },
      { dimName: "Saúde e Bem-Estar", text: "Consigo dormir bem e descansar adequadamente.", inverted: true },
      { dimName: "Saúde e Bem-Estar", text: "Sinto que minha saúde mental está boa.", inverted: true },
    ];

    const itemsInsert = itemsDefs.map((item, i) => {
      const dimInfo = dimInfoMap.get(item.dimName);
      return {
        dimension_id: dimInfo!.id,
        text: item.text,
        is_inverted: item.inverted,
        sort_order: i + 1,
      };
    });

    const { data: items, error: iErr } = await supabase
      .from("survey_items").insert(itemsInsert).select("id, dimension_id");
    if (iErr) throw new Error(`items: ${iErr.message}`);

    // ─── 8. CAMPAIGN 1 — CLOSED ───
    const closedStart = "2025-03-01T08:00:00Z";
    const closedEnd = "2025-04-01T23:59:59Z";

    const { data: camp1, error: c1Err } = await supabase
      .from("survey_campaigns")
      .insert({
        name: "Avaliação Anual 2025",
        description: "Avaliação psicossocial anual completa — todos os colaboradores.",
        template_id: template!.id,
        tenant_id: tenantId,
        status: "closed",
        starts_at: closedStart,
        ends_at: closedEnd,
      })
      .select("id").single();
    if (c1Err) throw new Error(`campaign1: ${c1Err.message}`);
    console.log("campaign1 created:", camp1!.id);

    // Invitations for all 45
    const inv1Data = employees!.map(e => ({
      campaign_id: camp1!.id,
      employee_id: e.id,
    }));
    const { data: inv1, error: inv1Err } = await supabase
      .from("survey_invitations").insert(inv1Data).select("id, employee_id, token");
    if (inv1Err) throw new Error(`inv1: ${inv1Err.message}`);
    console.log("inv1 created:", inv1?.length);

    // Simulate 45 responses with weighted Likert
    const responseRows: any[] = [];
    const answerRows: any[] = [];
    const consentRows: any[] = [];

    // Build dim bias lookup by dimension_id
    const dimBiasById = new Map<string, number>();
    for (const [, info] of dimInfoMap) dimBiasById.set(info.id, info.bias);

    for (const inv of inv1!) {
      const emp = employees!.find(e => e.id === inv.employee_id)!;
      const orgUnitId = emp.department_id ? deptOrgMap.get(emp.department_id) || null : null;
      const responseId = crypto.randomUUID();

      // Random completion date within campaign window
      const startMs = new Date(closedStart).getTime();
      const endMs = new Date(closedEnd).getTime();
      const completedAt = new Date(startMs + Math.random() * (endMs - startMs)).toISOString();

      responseRows.push({
        id: responseId,
        campaign_id: camp1!.id,
        is_complete: true,
        completed_at: completedAt,
        department_id: emp.department_id,
        org_unit_id: orgUnitId,
        job_role_id: emp.job_role_id,
      });

      for (const item of items!) {
        const bias = dimBiasById.get(item.dimension_id) ?? 3;
        answerRows.push({
          response_id: responseId,
          item_id: item.id,
          value: weightedLikert(bias),
        });
      }

      consentRows.push({
        campaign_id: camp1!.id,
        consent_text: "Concordo em participar voluntariamente desta avaliação psicossocial organizacional. Entendo que minhas respostas serão tratadas de forma anônima e confidencial.",
        consent_version: 1,
      });
    }
    console.log("response rows built:", responseRows.length, "answer rows:", answerRows.length);

    // Batch inserts
    console.log("first response row:", JSON.stringify(responseRows[0]));
    for (let i = 0; i < responseRows.length; i += 100) {
      const { error: rErr2 } = await supabase.from("survey_responses").insert(responseRows.slice(i, i + 100));
      if (rErr2) throw new Error(`responses batch ${i}: ${JSON.stringify(rErr2)}`);
    }
    console.log("responses inserted");
    for (let i = 0; i < answerRows.length; i += 500) {
      const { error: aErr2 } = await supabase.from("survey_answers").insert(answerRows.slice(i, i + 500));
      if (aErr2) throw new Error(`answers batch ${i}: ${JSON.stringify(aErr2)}`);
    }
    console.log("answers inserted");
    for (let i = 0; i < consentRows.length; i += 100) {
      const { error: cErr2 } = await supabase.from("consent_records").insert(consentRows.slice(i, i + 100));
      if (cErr2) throw new Error(`consent batch ${i}: ${JSON.stringify(cErr2)}`);
    }
    console.log("consents inserted");

    // Mark invitations as used
    const inv1Ids = inv1!.map(i => i.id);
    for (let i = 0; i < inv1Ids.length; i += 100)
      await supabase.from("survey_invitations")
        .update({ is_used: true, used_at: new Date(closedEnd).toISOString() })
        .in("id", inv1Ids.slice(i, i + 100));

    // ─── 9. PROCESS SCORING for campaign 1 ───
    let scoringResult = null;
    try {
      const scoringUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-scoring`;
      const res = await fetch(scoringUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ campaign_id: camp1!.id }),
      });
      scoringResult = await res.json();
    } catch (e: any) {
      scoringResult = { error: e.message };
    }

    // ─── 10. CAMPAIGN 2 — ACTIVE ───
    const activeStart = "2026-02-01T08:00:00Z";
    const activeEnd = "2026-03-15T23:59:59Z";

    const { data: camp2, error: c2Err } = await supabase
      .from("survey_campaigns")
      .insert({
        name: "Avaliação Semestral 2026",
        description: "Avaliação semestral de acompanhamento — campanha em andamento.",
        template_id: template!.id,
        tenant_id: tenantId,
        status: "active",
        starts_at: activeStart,
        ends_at: activeEnd,
      })
      .select("id").single();
    if (c2Err) throw new Error(`campaign2: ${c2Err.message}`);

    const inv2Data = employees!.map(e => ({
      campaign_id: camp2!.id,
      employee_id: e.id,
    }));
    const { data: inv2, error: inv2Err } = await supabase
      .from("survey_invitations").insert(inv2Data).select("id, employee_id, token");
    if (inv2Err) throw new Error(`inv2: ${inv2Err.message}`);

    // 30 responded, 15 pending
    const respondedInv = inv2!.slice(0, 30);
    const pendingInv = inv2!.slice(30);

    const resp2Rows: any[] = [];
    const ans2Rows: any[] = [];
    const consent2Rows: any[] = [];

    for (const inv of respondedInv) {
      const emp = employees!.find(e => e.id === inv.employee_id)!;
      const orgUnitId = emp.department_id ? deptOrgMap.get(emp.department_id) || null : null;
      const responseId = crypto.randomUUID();
      const completedAt = new Date(
        new Date(activeStart).getTime() + Math.random() * (Date.now() - new Date(activeStart).getTime())
      ).toISOString();

      resp2Rows.push({
        id: responseId,
        campaign_id: camp2!.id,
        is_complete: true,
        completed_at: completedAt,
        department_id: emp.department_id,
        org_unit_id: orgUnitId,
        job_role_id: emp.job_role_id,
      });

      for (const item of items!) {
        const bias = dimBiasById.get(item.dimension_id) ?? 3;
        ans2Rows.push({
          response_id: responseId,
          item_id: item.id,
          value: weightedLikert(bias),
        });
      }

      consent2Rows.push({
        campaign_id: camp2!.id,
        consent_text: "Concordo em participar voluntariamente desta avaliação psicossocial organizacional.",
        consent_version: 1,
      });
    }

    for (let i = 0; i < resp2Rows.length; i += 100)
      await supabase.from("survey_responses").insert(resp2Rows.slice(i, i + 100));
    for (let i = 0; i < ans2Rows.length; i += 500)
      await supabase.from("survey_answers").insert(ans2Rows.slice(i, i + 500));
    for (let i = 0; i < consent2Rows.length; i += 100)
      await supabase.from("consent_records").insert(consent2Rows.slice(i, i + 100));

    // Mark responded invitations as used
    const respInvIds = respondedInv.map(i => i.id);
    for (let i = 0; i < respInvIds.length; i += 100)
      await supabase.from("survey_invitations")
        .update({ is_used: true, used_at: new Date().toISOString() })
        .in("id", respInvIds.slice(i, i + 100));

    // Collect pending tokens for output
    const pendingTokens = pendingInv.map(inv => ({
      token: inv.token,
      url: `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app') || ''}/pesquisa/${inv.token}`,
    }));

    // ─── 11. CAMPAIGN 3 — DRAFT ───
    const { error: c3Err } = await supabase
      .from("survey_campaigns")
      .insert({
        name: "Piloto Q1 2025",
        description: "Campanha piloto para teste — ainda não ativada.",
        template_id: template!.id,
        tenant_id: tenantId,
        status: "draft",
      });
    if (c3Err) throw new Error(`campaign3: ${c3Err.message}`);

    // ─── 12. ACTION PLANS ───
    const actionPlans = [
      { title: "Programa de Gestão de Carga de Trabalho", dimension_name: "Demandas de Trabalho", status: "in_progress", description: "Implementar controle de horas extras e redistribuição de tarefas nos departamentos com sobrecarga identificada.", responsible: "Coordenação RH", due_date: "2025-06-30" },
      { title: "Treinamento de Liderança em Feedback", dimension_name: "Liderança e Justiça Organizacional", status: "pending", description: "Capacitar gestores em técnicas de feedback construtivo e reconhecimento de equipe.", responsible: "Diretoria de Pessoas", due_date: "2025-07-15" },
      { title: "Política de Desconexão Digital", dimension_name: "Trabalho e Vida Pessoal", status: "pending", description: "Criar e implementar política de desconexão fora do horário de trabalho.", responsible: "Jurídico + RH", due_date: "2025-08-01" },
      { title: "Revisão Ergonômica dos Postos de Trabalho", dimension_name: "Ambiente Físico", status: "completed", description: "Avaliação e ajuste ergonômico de todas as estações de trabalho na Matriz SP.", responsible: "Engenharia + Segurança", due_date: "2025-04-15" },
      { title: "Grupo de Apoio à Saúde Mental", dimension_name: "Saúde e Bem-Estar", status: "in_progress", description: "Criar programa de apoio psicológico e rodas de conversa mensais.", responsible: "RH + Parceiro Clínico", due_date: "2025-09-01" },
    ];

    const { error: apErr } = await supabase.from("action_plans").insert(
      actionPlans.map(ap => ({
        ...ap,
        tenant_id: tenantId,
        campaign_id: camp1!.id,
      }))
    );
    if (apErr) throw new Error(`action_plans: ${apErr.message}`);

    // ─── 13. AUDIT LOGS ───
    const auditLogs = [
      { entity_type: "survey_campaign", action: "create", details: { campaign_name: "Avaliação Anual 2025" }, entity_id: camp1!.id },
      { entity_type: "survey_campaign", action: "activate", details: { campaign_name: "Avaliação Anual 2025", invitations_sent: 45 }, entity_id: camp1!.id },
      { entity_type: "survey_campaign", action: "close", details: { campaign_name: "Avaliação Anual 2025", responses: 45 }, entity_id: camp1!.id },
      { entity_type: "scoring", action: "process", details: { campaign_name: "Avaliação Anual 2025", dimensions_scored: 8 }, entity_id: camp1!.id },
      { entity_type: "report", action: "generate", details: { type: "technical", campaign_name: "Avaliação Anual 2025" }, entity_id: camp1!.id },
      { entity_type: "report", action: "generate", details: { type: "executive", campaign_name: "Avaliação Anual 2025" }, entity_id: camp1!.id },
      { entity_type: "action_plan", action: "create", details: { title: "Programa de Gestão de Carga de Trabalho" } },
      { entity_type: "survey_campaign", action: "create", details: { campaign_name: "Avaliação Semestral 2026" }, entity_id: camp2!.id },
      { entity_type: "survey_campaign", action: "activate", details: { campaign_name: "Avaliação Semestral 2026", invitations_sent: 45 }, entity_id: camp2!.id },
      { entity_type: "survey_campaign", action: "create", details: { campaign_name: "Piloto Q1 2025" } },
      { entity_type: "employee", action: "bulk_import", details: { count: 45, source: "seed-demo" } },
      { entity_type: "org_structure", action: "setup", details: { units: 3, departments: 8, roles: 12 } },
    ];

    const { error: alErr } = await supabase.from("audit_logs").insert(
      auditLogs.map(l => ({ ...l, tenant_id: tenantId }))
    );
    if (alErr) throw new Error(`audit_logs: ${alErr.message}`);

    // ─── SUMMARY ───
    return new Response(
      JSON.stringify({
        message: "🎉 Tenant populado com sucesso!",
        tenant_id: tenantId,
        summary: {
          org_units: orgUnits!.length,
          departments: depts!.length,
          job_roles: roles!.length,
          employees: employees!.length,
          template: template!.id,
          dimensions: dimensions!.length,
          items: items!.length,
          campaigns: {
            closed: { id: camp1!.id, name: "Avaliação Anual 2025", responses: responseRows.length },
            active: { id: camp2!.id, name: "Avaliação Semestral 2026", responded: respondedInv.length, pending: pendingInv.length },
            draft: "Piloto Q1 2025",
          },
          action_plans: actionPlans.length,
          audit_logs: auditLogs.length,
          scoring: scoringResult,
          pending_survey_links: pendingTokens.slice(0, 3),
          note: `${pendingTokens.length} links de pesquisa pendentes na campanha ativa`,
        },
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
