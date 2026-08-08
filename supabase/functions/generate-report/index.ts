import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function classifyRisk(score: number): { label: string; color: string } {
  if (score <= 33) return { label: "Baixo risco", color: "#22c55e" };
  if (score <= 66) return { label: "Atenção", color: "#eab308" };
  return { label: "Risco elevado", color: "#ef4444" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, report_type, tenant_id, report_id } = await req.json();
    if (!campaign_id || !report_type || !tenant_id || !report_id)
      throw new Error("campaign_id, report_type, tenant_id, report_id are required");

    // ── Auth & Tenant Validation ────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Use service role for data operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user belongs to the claimed tenant
    const { data: userProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();
    if (profileErr || !userProfile || userProfile.tenant_id !== tenant_id) {
      return new Response(JSON.stringify({ error: "Forbidden: tenant mismatch" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify campaign belongs to the same tenant
    const { data: campaignCheck } = await supabase
      .from("survey_campaigns")
      .select("tenant_id")
      .eq("id", campaign_id)
      .single();
    if (!campaignCheck || campaignCheck.tenant_id !== tenant_id) {
      return new Response(JSON.stringify({ error: "Forbidden: campaign does not belong to tenant" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify report belongs to the same tenant
    const { data: reportCheck } = await supabase
      .from("reports")
      .select("tenant_id")
      .eq("id", report_id)
      .single();
    if (!reportCheck || reportCheck.tenant_id !== tenant_id) {
      return new Response(JSON.stringify({ error: "Forbidden: report does not belong to tenant" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Data Fetch ──────────────────────────────────────────────────────
    // Fetch all data in parallel
    const [tenantRes, campaignRes, scoresRes, groupRes, responsesRes, alertsRes] = await Promise.all([
      supabase.from("tenants").select("*").eq("id", tenant_id).single(),
      supabase.from("survey_campaigns").select("*, survey_templates(name, description)").eq("id", campaign_id).single(),
      supabase.from("campaign_scores").select("*, survey_dimensions(name, sort_order, description)").eq("campaign_id", campaign_id).order("survey_dimensions(sort_order)"),
      supabase.from("group_scores").select("*, survey_dimensions(name)").eq("campaign_id", campaign_id).eq("is_suppressed", false),
      supabase.from("survey_responses").select("id", { count: "exact", head: true }).eq("campaign_id", campaign_id).eq("is_complete", true),
      supabase.from("risk_alerts").select("*").eq("campaign_id", campaign_id),
    ]);

    const tenant = tenantRes.data;
    const campaign = campaignRes.data;
    const scores = scoresRes.data || [];
    const groupScores = groupRes.data || [];
    const totalResponses = responsesRes.count || 0;
    const alerts = alertsRes.data || [];
    const primaryColor = tenant?.primary_color || "#1e3a5f";
    const minGroupSize = tenant?.min_group_size ?? 7;

    // ── Pré-condição: sem dados válidos não existe laudo ─────────────────
    if (totalResponses < minGroupSize || scores.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            `Não é possível emitir o laudo: a campanha possui ${totalResponses} resposta(s) completa(s) e ` +
            `${scores.length} dimensão(ões) apurada(s). São necessárias no mínimo ${minGroupSize} respostas ` +
            `completas e o processamento do scoring (Reprocessar) antes da emissão.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    // Estrutura do instrumento vinda do survey_template da campanha (sem mapeamento fixo)
    const { data: templateDimensions } = await supabase
      .from("survey_dimensions")
      .select("id, name, sort_order, survey_items(item_number, text, is_inverted, has_individual_alert)")
      .eq("template_id", campaign?.template_id)
      .order("sort_order");

    const instrumentDimensions = (templateDimensions || []).map((d: any) => {
      const items = (d.survey_items || [])
        .slice()
        .sort((a: any, b: any) => (a.item_number ?? 0) - (b.item_number ?? 0));
      return {
        name: d.name as string,
        items,
        itemNumbers: items.map((i: any) => i.item_number).filter((n: any) => n != null),
      };
    });
    const totalItems = instrumentDimensions.reduce((s, d) => s + d.items.length, 0);

    // Calculate IGP
    const igp = scores.length > 0
      ? Math.round((scores.reduce((s: number, sc: any) => s + Number(sc.avg_score), 0) / scores.length) * 100) / 100
      : 0;
    const igpRisk = classifyRisk(igp);

    // Alerta de ocorrência do item com alerta individual (item 20 — assédio/violência)
    const harassmentAlert = alerts.find((a: any) => a.alert_type === "harassment_alert");
    const harassmentCount = harassmentAlert ? Number(harassmentAlert.score) : 0;


    // ── Conteúdo dinâmico das seções (13, 14 e 16) ──────────────────────
    // Cada seção recebe seu próprio campo do JSON estruturado — sem divisão
    // por separadores, que causava o deslocamento entre as seções.
    let aiAnalysis = "";
    let aiRecommendations = "";
    let aiConclusion = "";

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY não configurada — não é possível gerar o conteúdo do laudo.");

    const scoresText = scores
      .map((s: any) => `${s.survey_dimensions?.name}: ${Number(s.avg_score).toFixed(1)} (${classifyRisk(Number(s.avg_score)).label})`)
      .join("\n");
    const criticalDims = scores
      .filter((s: any) => Number(s.avg_score) >= 67)
      .map((s: any) => s.survey_dimensions?.name)
      .join(", ");
    const dimensionNames = instrumentDimensions.map((d) => d.name).join("; ");

    const contextoComum = `Instrumento: People Pulse Index (PPI) v1.1 (${totalItems} itens, ${instrumentDimensions.length} dimensões).
Empresa: ${tenant?.name || "—"}
Campanha: ${campaign?.name || "—"}
IGP (Índice Geral Psicossocial): ${igp.toFixed(1)}/100 — ${igpRisk.label}
Total de respondentes válidos: ${totalResponses}
Dimensões do instrumento (use exatamente estes nomes): ${dimensionNames}
Scores por dimensão:
${scoresText}
${criticalDims ? `Dimensões em risco elevado (≥67): ${criticalDims}` : "Nenhuma dimensão em risco elevado"}
${harassmentCount > 0 ? `Alerta de ocorrência (item 20 — tratamento desrespeitoso/humilhante, assédio moral ou sexual): ${harassmentCount} resposta(s) com valor 4 ou 5, de forma anônima.` : "Sem ocorrências registradas no item 20."}
Critério de anonimato aplicado: grupos com N ≥ ${minGroupSize}.

Regras de escrita obrigatórias:
- Português do Brasil, linguagem técnica não-clínica, foco em fatores organizacionais.
- NUNCA use placeholders ou marcadores entre colchetes (ex.: [Nome da Empresa], [Data]); use os dados reais fornecidos.
- Não invente dimensões: use somente os nomes listados acima.
- Não escreva títulos de seção nem numeração de seção; devolva apenas o texto corrido de cada campo.`;

    const schema = report_type === "technical"
      ? {
          type: "object",
          additionalProperties: false,
          required: ["analise", "recomendacoes", "conclusao"],
          properties: {
            analise: { type: "string", description: "Análise interpretativa do IGP e de cada dimensão (máx. 300 palavras)." },
            recomendacoes: { type: "string", description: "Recomendações técnicas priorizadas por nível de risco (máx. 200 palavras)." },
            conclusao: { type: "string", description: "Conclusão técnica: síntese do IGP, das dimensões em risco e parecer final (máx. 150 palavras)." },
          },
        }
      : {
          type: "object",
          additionalProperties: false,
          required: ["analise"],
          properties: {
            analise: { type: "string", description: "Sumário executivo para a diretoria, com top 3 riscos e recomendações estratégicas (máx. 200 palavras)." },
          },
        };

    const instrucao = report_type === "technical"
      ? `Você é especialista em saúde ocupacional e riscos psicossociais. Produza o conteúdo das seções finais de um laudo técnico conforme NR-1/GRO, preenchendo os três campos do JSON: "analise" (Análise Interpretativa), "recomendacoes" (Recomendações Técnicas) e "conclusao" (Conclusão Técnica). Cada campo deve conter exclusivamente o conteúdo da sua própria seção.${harassmentCount > 0 ? " Na análise e nas recomendações, registre a ocorrência do item 20 apenas com a contagem anônima e recomende apuração pelos canais internos adequados." : ""}`
      : `Você é especialista em saúde ocupacional. Produza o sumário executivo de uma avaliação psicossocial organizacional no campo "analise".`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Lovable-API-Key": lovableApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        input: [
          { role: "system", content: instrucao },
          { role: "user", content: contextoComum },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "conteudo_laudo",
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      if (aiRes.status === 429) throw new Error("Limite de requisições de IA atingido. Tente novamente em alguns minutos.");
      if (aiRes.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos para gerar o laudo.");
      throw new Error(`Falha ao gerar o conteúdo do laudo (IA): ${detail.slice(0, 300)}`);
    }

    const aiData = await aiRes.json();
    let rawText: string = aiData.output_text || "";
    if (!rawText && Array.isArray(aiData.output)) {
      for (const out of aiData.output) {
        for (const c of out?.content || []) {
          if (typeof c?.text === "string") rawText += c.text;
        }
      }
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error("A IA não devolveu um conteúdo válido para as seções do laudo. Tente gerar novamente.");
    }

    aiAnalysis = (parsed.analise || "").trim();
    aiRecommendations = (parsed.recomendacoes || "").trim();
    aiConclusion = (parsed.conclusao || "").trim();

    if (!aiAnalysis || (report_type === "technical" && (!aiRecommendations || !aiConclusion))) {
      throw new Error("Conteúdo das seções finais incompleto. O laudo não foi emitido — tente gerar novamente.");
    }


    // Group scores by department
    const deptGroups: Record<string, any[]> = {};
    for (const gs of groupScores) {
      if (gs.group_type === "department") {
        if (!deptGroups[gs.group_id]) deptGroups[gs.group_id] = [];
        deptGroups[gs.group_id].push(gs);
      }
    }

    // Fetch department names
    const deptIds = Object.keys(deptGroups);
    let deptNameMap: Record<string, string> = {};
    if (deptIds.length > 0) {
      const { data: depts } = await supabase.from("departments").select("id, name").in("id", deptIds);
      if (depts) deptNameMap = Object.fromEntries(depts.map((d: any) => [d.id, d.name]));
    }

    const date = new Date().toLocaleDateString("pt-BR");
    const title = report_type === "technical" ? "Laudo Técnico de Avaliação de Riscos Psicossociais" : "Relatório Executivo";

    // Build dimension rows — as dimensões vêm do survey_template (nome e ordem)
    const scoreByDimName = new Map<string, any>();
    for (const s of scores) {
      const nm = s.survey_dimensions?.name;
      if (nm) scoreByDimName.set(nm, s);
    }
    const orderedDimensions = instrumentDimensions.length > 0
      ? instrumentDimensions.map((d) => ({ name: d.name, score: scoreByDimName.get(d.name) }))
      : scores.map((s: any) => ({ name: s.survey_dimensions?.name || "—", score: s }));

    const dimensionRows = orderedDimensions.map(({ name, score: s }) => {
      if (!s) {
        return `<tr>
        <td style="padding:10px;border:1px solid #ddd;">${name}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">—</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">Sem dados suficientes</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">—</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">—</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">—</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">0</td>
      </tr>`;
      }
      const score = Number(s.avg_score);
      const risk = classifyRisk(score);
      return `<tr>
        <td style="padding:10px;border:1px solid #ddd;">${name}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;font-weight:bold;">${score.toFixed(1)}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">
          <span style="background:${risk.color}20;color:${risk.color};padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">${risk.label}</span>
        </td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${s.min_score != null ? Number(s.min_score).toFixed(1) : "—"}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${s.max_score != null ? Number(s.max_score).toFixed(1) : "—"}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${s.std_dev != null ? Number(s.std_dev).toFixed(2) : "—"}</td>
        <td style="padding:10px;border:1px solid #ddd;text-align:center;">${s.responses_count}</td>
      </tr>`;
    }).join("");


    // Group section
    let groupSection = "";
    if (report_type === "technical" && Object.keys(deptGroups).length > 0) {
      const groupRows = Object.entries(deptGroups).map(([deptId, deptScores]) =>
        deptScores.map((gs: any) => {
          const risk = classifyRisk(Number(gs.avg_score));
          return `<tr>
            <td style="padding:8px;border:1px solid #ddd;">${deptNameMap[deptId] || deptId.substring(0, 8)}</td>
            <td style="padding:8px;border:1px solid #ddd;">${gs.survey_dimensions?.name || "—"}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:bold;">${Number(gs.avg_score).toFixed(1)}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">
              <span style="color:${risk.color};font-weight:600;">${risk.label}</span>
            </td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${gs.responses_count}</td>
          </tr>`;
        }).join("")
      ).join("");

      groupSection = `
        <div class="section">
          <h2>11. Análise por Áreas e Unidades</h2>
          <table>
            <thead><tr style="background:${primaryColor};color:white;">
              <th style="padding:8px;">Departamento</th>
              <th style="padding:8px;">Dimensão</th>
              <th style="padding:8px;">Score</th>
              <th style="padding:8px;">Classificação</th>
              <th style="padding:8px;">N</th>
            </tr></thead>
            <tbody>${groupRows}</tbody>
          </table>
          <p class="note">Apenas grupos com N ≥ ${minGroupSize} respondentes são exibidos, garantindo o anonimato.</p>
        </div>`;
    }

    // Critical factors
    let criticalSection = "";
    const dimensionAlerts = alerts.filter((a: any) => a.alert_type !== "harassment_alert");
    if (dimensionAlerts.length > 0 || harassmentCount > 0) {
      const alertRows = dimensionAlerts.map((a: any) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${a.dimension_name}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:bold;color:#ef4444;">${Number(a.score).toFixed(1)}</td>
          <td style="padding:8px;border:1px solid #ddd;">${a.alert_type === "critical_risk" ? "Crítico — ação prioritária" : "Elevado — monitoramento reforçado"}</td>
        </tr>
      `).join("");
      criticalSection = `
        <div class="section alert-box">
          <h2>12. Fatores Críticos Identificados</h2>
          ${dimensionAlerts.length > 0 ? `
          <p>As seguintes dimensões apresentaram score ≥ 67, indicando risco elevado que requer intervenção:</p>
          <table>
            <thead><tr style="background:#ef4444;color:white;">
              <th style="padding:8px;">Dimensão</th>
              <th style="padding:8px;">Score</th>
              <th style="padding:8px;">Prioridade</th>
            </tr></thead>
            <tbody>${alertRows}</tbody>
          </table>` : "<p>Nenhuma dimensão apresentou score ≥ 67 nesta campanha.</p>"}
          ${harassmentCount > 0 ? `
          <p style="margin-top:18px;"><strong>Alerta de ocorrência — item 20 (tratamento desrespeitoso, humilhante ou hostil, incluindo assédio moral ou sexual)</strong></p>
          <p><strong>${harassmentCount}</strong> resposta(s) registraram valor 4 ou 5 nesse item, independentemente da média da dimensão "${harassmentAlert?.dimension_name || "Relações Sociais no Trabalho"}". O registro é anônimo e não permite identificar respondentes.</p>
          <p>Recomenda-se apuração pelos canais internos adequados da empresa (canal de denúncias, comitê de ética, área de compliance ou RH), com garantia de sigilo e vedação a retaliação.</p>` : ""}
        </div>`;
    }


    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 40px; color: #333; line-height: 1.6; }
  h1 { color: ${primaryColor}; border-bottom: 3px solid ${primaryColor}; padding-bottom: 10px; font-size: 24px; }
  h2 { color: ${primaryColor}; font-size: 18px; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
  .cover { text-align: center; padding: 60px 0; border-bottom: 3px solid ${primaryColor}; margin-bottom: 40px; }
  .cover h1 { border: none; font-size: 28px; }
  .cover .subtitle { font-size: 16px; color: #666; margin-top: 10px; }
  .section { margin: 25px 0; }
  .igp-box { background: linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd); color: white; padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0; }
  .igp-value { font-size: 56px; font-weight: bold; }
  .igp-label { font-size: 14px; opacity: 0.85; }
  .igp-risk { font-size: 18px; margin-top: 8px; font-weight: 600; }
  .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
  .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; }
  th { background: ${primaryColor}; color: white; padding: 10px; text-align: left; }
  td { padding: 8px; border: 1px solid #ddd; }
  .methodology { background: #f0f7ff; padding: 20px; border-left: 4px solid ${primaryColor}; margin: 20px 0; font-size: 13px; }
  .note { font-size: 12px; color: #888; font-style: italic; margin-top: 8px; }
  .disclaimer { background: #fffbeb; border: 1px solid #fed7aa; border-radius: 8px; padding: 15px; margin: 25px 0; font-size: 13px; }
  .footer { margin-top: 50px; text-align: center; color: #999; font-size: 11px; border-top: 1px solid #ddd; padding-top: 15px; }
  .page-break { page-break-before: always; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0; }
  .info-item { background: #f8f9fa; padding: 10px 15px; border-radius: 6px; }
  .info-item label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-item span { display: block; font-weight: 600; margin-top: 2px; }
  @media print {
    body { padding: 20px; }
    .page-break { page-break-before: always; }
    .igp-box, .alert-box, .methodology, .disclaimer, .summary, .info-item {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    span { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head>
<body>
  <!-- 1. CAPA -->
  <div class="cover">
    <h1>${title}</h1>
    <p class="subtitle">Metodologia People Pulse Index (PPI) v1.1</p>
    <p class="subtitle">${tenant?.name || "—"}</p>
    <p style="color:#999;margin-top:20px;">Documento gerado em ${date}</p>
  </div>

  <!-- 2. IDENTIFICAÇÃO DAS PARTES -->
  <div class="section">
    <h2>2. Identificação</h2>
    <div class="info-grid">
      <div class="info-item"><label>Empresa</label><span>${tenant?.name || "—"}</span></div>
      <div class="info-item"><label>Campanha</label><span>${campaign?.name || "—"}</span></div>
      <div class="info-item"><label>Período</label><span>${campaign?.starts_at ? new Date(campaign.starts_at).toLocaleDateString("pt-BR") : "—"} a ${campaign?.ends_at ? new Date(campaign.ends_at).toLocaleDateString("pt-BR") : "—"}</span></div>
      <div class="info-item"><label>Template</label><span>${campaign?.survey_templates?.name || "PPI v1.0"}</span></div>
    </div>
  </div>

  <!-- 3. OBJETIVO -->
  <div class="section">
    <h2>3. Objetivo</h2>
    <p>Avaliar os fatores de risco psicossocial presentes no ambiente organizacional da empresa ${tenant?.name || ""}, conforme exigências da Norma Regulamentadora nº 1 (NR-1) e do Gerenciamento de Riscos Ocupacionais (GRO), identificando dimensões que necessitam de intervenção para promoção de condições saudáveis de trabalho.</p>
  </div>

  <!-- 4. FUNDAMENTAÇÃO LEGAL -->
  <div class="section">
    <h2>4. Fundamentação Legal</h2>
    <p>Este laudo atende às seguintes bases normativas:</p>
    <ul>
      <li><strong>NR-1 (Portaria SEPRT nº 6.730/2020)</strong> — Programa de Gerenciamento de Riscos (PGR), que inclui riscos psicossociais como fatores a serem identificados, avaliados e controlados.</li>
      <li><strong>GRO — Gerenciamento de Riscos Ocupacionais</strong> — Estabelece a obrigatoriedade de inventário e plano de ação para todos os riscos, incluindo psicossociais.</li>
      <li><strong>LGPD (Lei 13.709/2018)</strong> — Tratamento de dados pessoais com consentimento, anonimização e finalidade legítima.</li>
    </ul>
  </div>

  <!-- 5. FUNDAMENTAÇÃO METODOLÓGICA -->
  <div class="section">
    <h2>5. Fundamentação Metodológica — PPI</h2>
    <div class="methodology">
      <p><strong>People Pulse Index (PPI) v1.1</strong></p>
      <p>Instrumento padronizado de avaliação de riscos psicossociais organizacionais composto por ${totalItems} itens distribuídos em ${instrumentDimensions.length} dimensões, baseado no modelo Demanda-Controle-Suporte complementado com dimensões de Reconhecimento, Trabalho e Vida Pessoal e Sinais de Desgaste.</p>
      <p><strong>Escala:</strong> Likert de 5 pontos (1 = Nunca/Quase nunca a 5 = Sempre)</p>
      <p><strong>Itens invertidos:</strong> Tratados com fórmula (6 − resposta) para uniformizar a direção do risco</p>
      <p><strong>Score por dimensão:</strong> Média × 20 (range 20-100)</p>
      <p><strong>IGP — Índice Geral Psicossocial:</strong> média dos scores das dimensões avaliadas, na mesma escala de 20 a 100</p>
      <p><strong>Anonimato:</strong> resultados por grupo são divulgados apenas quando N ≥ ${minGroupSize} respondentes</p>
      <p><strong>Classificação de risco:</strong></p>
      <ul>
        <li>0–33: <span style="color:#22c55e;font-weight:bold;">Baixo risco</span> — Condições adequadas</li>
        <li>34–66: <span style="color:#eab308;font-weight:bold;">Atenção</span> — Necessita monitoramento</li>
        <li>67–100: <span style="color:#ef4444;font-weight:bold;">Risco elevado</span> — Requer ação prioritária</li>
      </ul>
    </div>
    <h3 style="margin-top:22px;">5.1 Dimensões avaliadas</h3>
    <ul>
      ${instrumentDimensions.map((d) => `<li><strong>${d.name}</strong></li>`).join("")}
    </ul>

  </div>


  <!-- 6. PROCEDIMENTOS DE COLETA -->
  <div class="section">
    <h2>6. Procedimentos de Coleta</h2>
    <p>A coleta foi realizada por meio de questionário eletrônico anônimo, acessado via link individual (token único). Os participantes foram previamente informados sobre o objetivo da avaliação e consentiram eletronicamente conforme LGPD. Tempo médio estimado de resposta: 6–8 minutos.</p>
  </div>

  <!-- 7. CARACTERIZAÇÃO DA AMOSTRA -->
  <div class="section">
    <h2>7. Caracterização da Amostra</h2>
    <div class="info-grid">
      <div class="info-item"><label>Respostas válidas</label><span>${totalResponses}</span></div>
      <div class="info-item"><label>Critério de validação</label><span>≥ 90% do questionário respondido</span></div>
      <div class="info-item"><label>Anonimato</label><span>Grupos com N ≥ ${minGroupSize}</span></div>
      <div class="info-item"><label>Dimensões avaliadas</label><span>${orderedDimensions.length}</span></div>

    </div>
  </div>

  <!-- 8. CRITÉRIOS DE ANÁLISE -->
  <div class="section">
    <h2>8. Critérios de Análise e Classificação</h2>
    <table>
      <thead><tr><th>Faixa</th><th>Classificação</th><th>Interpretação</th><th>Ação Recomendada</th></tr></thead>
      <tbody>
        <tr><td style="color:#22c55e;font-weight:bold;">0–33</td><td>Baixo risco</td><td>Condições psicossociais adequadas</td><td>Manutenção e monitoramento contínuo</td></tr>
        <tr><td style="color:#eab308;font-weight:bold;">34–66</td><td>Atenção</td><td>Fatores que necessitam monitoramento</td><td>Investigação complementar e ações preventivas</td></tr>
        <tr><td style="color:#ef4444;font-weight:bold;">67–100</td><td>Risco elevado</td><td>Fatores que requerem intervenção imediata</td><td>Ação corretiva prioritária e plano de ação</td></tr>
      </tbody>
    </table>
  </div>

  <div class="page-break"></div>

  <!-- 9. RESULTADOS CONSOLIDADOS -->
  <div class="section">
    <h2>9. Resultados Consolidados — Índice Geral Psicossocial (IGP)</h2>
    <div class="igp-box">
      <div class="igp-label">ÍNDICE GERAL PSICOSSOCIAL (IGP)</div>
      <div class="igp-value">${igp.toFixed(1)}</div>
      <div class="igp-risk" style="color:${igpRisk.color === "#22c55e" ? "#bbf7d0" : igpRisk.color === "#eab308" ? "#fef08a" : "#fecaca"}">${igpRisk.label}</div>
      <div class="igp-label">Escala 0–100 | People Pulse Index</div>
    </div>
  </div>

  <!-- 10. RESULTADOS POR DIMENSÃO -->
  <div class="section">
    <h2>10. Resultados por Dimensão</h2>
    <table>
      <thead><tr>
        <th>Dimensão</th><th>Score</th><th>Classificação</th><th>Mín</th><th>Máx</th><th>Desvio</th><th>N</th>
      </tr></thead>
      <tbody>${dimensionRows}</tbody>
    </table>
  </div>

  ${groupSection}

  ${criticalSection}

  <!-- 13. ANÁLISE INTERPRETATIVA -->
  <div class="section">
    <h2>${report_type === "technical" ? "13. Análise Interpretativa" : "Sumário Executivo"}</h2>
    <div class="summary">${aiAnalysis.replace(/\n/g, "<br>")}</div>
  </div>

  ${report_type === "technical" ? `
  <!-- 14. RECOMENDAÇÕES TÉCNICAS -->
  <div class="section">
    <h2>14. Recomendações Técnicas</h2>
    <div class="summary">${aiRecommendations.replace(/\n/g, "<br>")}</div>
  </div>

  <!-- 15. LIMITAÇÕES -->
  <div class="section">
    <h2>15. Limitações do Estudo</h2>
    <ul>
      <li>Os resultados refletem percepções autorrelatadas dos participantes em um momento específico.</li>
      <li>A avaliação é organizacional e não permite inferências individuais.</li>
      <li>Grupos com menos de ${minGroupSize} respondentes foram suprimidos para garantir anonimato.</li>
      <li>Respondentes que completaram menos de 90% do questionário foram excluídos da análise.</li>
      <li>O instrumento avalia fatores organizacionais e não constitui avaliação clínica de saúde mental.</li>
    </ul>
  </div>

  <!-- 16. CONCLUSÃO TÉCNICA -->
  <div class="section">
    <h2>16. Conclusão Técnica</h2>
    <div class="summary">${aiConclusion.replace(/\n/g, "<br>")}</div>
  </div>` : ""}


  <!-- DISCLAIMER -->
  <div class="disclaimer">
    <strong>⚠️ Disclaimer</strong><br>
    Este instrumento avalia fatores organizacionais de risco psicossocial relacionados ao trabalho. Os resultados não constituem diagnóstico clínico individual, nem substituem avaliação médica ou psicológica. A metodologia People Pulse Index (PPI) foi desenvolvida para fins de monitoramento e gestão de riscos ocupacionais conforme NR-1/GRO.
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <p>Documento gerado automaticamente em ${date} — ${tenant?.name || ""}</p>
    <p>Metodologia: People Pulse Index (PPI) v1.1 | Classificação: NR-1/GRO</p>
    <p style="margin-top:10px;font-size:10px;">Este documento é confidencial e destinado exclusivamente à organização avaliada.</p>
  </div>
</body>
</html>`;

    // ── Verificação de integridade (obrigatória em emissão e reemissão) ──
    const expectedSections = report_type === "technical"
      ? [
          "2. Identificação",
          "3. Objetivo",
          "4. Fundamentação Legal",
          "5. Fundamentação Metodológica",
          "6. Procedimentos de Coleta",
          "7. Caracterização da Amostra",
          "8. Critérios de Análise",
          "9. Resultados Consolidados",
          "10. Resultados por Dimensão",
          "13. Análise Interpretativa",
          "14. Recomendações Técnicas",
          "15. Limitações do Estudo",
          "16. Conclusão Técnica",
        ]
      : ["Sumário Executivo", "9. Resultados Consolidados", "10. Resultados por Dimensão"];

    const missingSections = expectedSections.filter((s) => !html.includes(s));
    const placeholders = [...html.matchAll(/\[[^\]\n<>]{2,60}\]/g)].map((m) => m[0]);

    if (missingSections.length > 0 || placeholders.length > 0) {
      await supabase.from("reports").delete().eq("id", report_id);
      const problemas = [
        missingSections.length ? `seções ausentes: ${missingSections.join(", ")}` : "",
        placeholders.length ? `placeholders não preenchidos: ${[...new Set(placeholders)].join(", ")}` : "",
      ].filter(Boolean).join(" | ");
      throw new Error(`Verificação de integridade do laudo falhou (${problemas}). O laudo não foi gravado — tente gerar novamente.`);
    }

    // Store HTML
    const fileName = `${campaign_id}/${report_type}_v${Date.now()}.html`;
    const { error: uploadErr } = await supabase.storage
      .from("reports")
      .upload(fileName, new Blob([html], { type: "text/html" }), { contentType: "text/html", upsert: true });
    if (uploadErr) throw uploadErr;


    const { data: urlData } = await supabase.storage
      .from("reports")
      .createSignedUrl(fileName, 60 * 60 * 24 * 7);
    const fileUrl = urlData?.signedUrl || null;

    await supabase.from("reports").update({ file_url: fileUrl }).eq("id", report_id);

    return new Response(JSON.stringify({ message: "People Pulse report generated", file_url: fileUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
