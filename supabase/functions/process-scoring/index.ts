import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// People Pulse risk classification
function classifyRisk(score: number): string {
  if (score <= 33) return "Baixo risco";
  if (score <= 66) return "Atenção";
  return "Risco elevado";
}

// Critical dimensions that trigger alerts at score >= 67
const CRITICAL_DIMENSIONS = [
  "Demandas de Trabalho",
  "Liderança e Justiça Organizacional",
  "Trabalho e Vida Pessoal",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error("campaign_id is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get campaign + template
    const { data: campaign, error: campErr } = await supabase
      .from("survey_campaigns")
      .select("id, template_id, tenant_id")
      .eq("id", campaign_id)
      .single();
    if (campErr) throw campErr;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("min_group_size")
      .eq("id", campaign.tenant_id)
      .single();
    const minGroupSize = tenant?.min_group_size ?? 7;

    // 2. Get dimensions + items
    const { data: dimensions } = await supabase
      .from("survey_dimensions")
      .select("id, name, sort_order")
      .eq("template_id", campaign.template_id)
      .order("sort_order");

    const dimensionIds = dimensions!.map((d: any) => d.id);
    const dimNameMap = new Map<string, string>();
    for (const d of dimensions!) dimNameMap.set(d.id, d.name);

    const { data: items } = await supabase
      .from("survey_items")
      .select("id, dimension_id, is_inverted")
      .in("dimension_id", dimensionIds);

    const itemMap = new Map<string, { dimension_id: string; is_inverted: boolean }>();
    for (const item of items!) {
      itemMap.set(item.id, { dimension_id: item.dimension_id, is_inverted: item.is_inverted });
    }

    // Count items per dimension for missing data rules
    const itemsPerDim = new Map<string, number>();
    for (const item of items!) {
      itemsPerDim.set(item.dimension_id, (itemsPerDim.get(item.dimension_id) || 0) + 1);
    }

    // 3. Get all complete responses
    const { data: responses } = await supabase
      .from("survey_responses")
      .select("id, department_id, org_unit_id, job_role_id")
      .eq("campaign_id", campaign_id)
      .eq("is_complete", true);

    if (!responses?.length) {
      return new Response(JSON.stringify({ message: "No complete responses found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseIds = responses.map((r: any) => r.id);

    // Fetch all answers in batches
    let allAnswers: any[] = [];
    for (let i = 0; i < responseIds.length; i += 50) {
      const batch = responseIds.slice(i, i + 50);
      const { data: answers } = await supabase
        .from("survey_answers")
        .select("response_id, item_id, value")
        .in("response_id", batch);
      if (answers) allAnswers = allAnswers.concat(answers);
    }

    // 4. Delete old scores and alerts for this campaign
    await supabase.from("response_scores").delete().in("response_id", responseIds);
    await supabase.from("campaign_scores").delete().eq("campaign_id", campaign_id);
    await supabase.from("group_scores").delete().eq("campaign_id", campaign_id);
    await supabase.from("risk_alerts").delete().eq("campaign_id", campaign_id);

    // 5. Group answers by response
    const answersByResponse = new Map<string, any[]>();
    for (const a of allAnswers) {
      if (!answersByResponse.has(a.response_id)) answersByResponse.set(a.response_id, []);
      answersByResponse.get(a.response_id)!.push(a);
    }

    const responseMeta = new Map<string, any>();
    for (const r of responses) responseMeta.set(r.id, r);

    // 6. Calculate per-response scores with People Pulse formula and missing data rules
    const responseScoreRows: any[] = [];
    const dimScoresAgg: Record<string, number[]> = {};
    const groupAgg: Record<string, Record<string, number[]>> = {};
    const totalItemCount = items!.length;

    for (const [responseId, answers] of answersByResponse) {
      // Missing data rule: < 90% answered → discard entire response
      if (answers.length < totalItemCount * 0.9) continue;

      // Group answers by dimension
      const dimValues: Record<string, number[]> = {};
      for (const a of answers) {
        const meta = itemMap.get(a.item_id);
        if (!meta) continue;
        // Apply inversion: for inverted items, 6 - response so higher = higher risk
        const value = meta.is_inverted ? 6 - a.value : a.value;
        if (!dimValues[meta.dimension_id]) dimValues[meta.dimension_id] = [];
        dimValues[meta.dimension_id].push(value);
      }

      // Calculate score per dimension with missing data rules
      for (const [dimId, values] of Object.entries(dimValues)) {
        const totalInDim = itemsPerDim.get(dimId) || values.length;
        const missing = totalInDim - values.length;

        // Missing >= 2 items in dimension → exclude dimension for this respondent
        if (missing >= 2) continue;
        // Missing 1 item → use mean of answered items (already happens naturally)

        const avg = values.reduce((s, v) => s + v, 0) / values.length;
        // People Pulse formula: Score = média × 20 (range 20-100)
        const score = avg * 20;

        responseScoreRows.push({
          response_id: responseId,
          dimension_id: dimId,
          score: Math.round(score * 100) / 100,
          items_count: values.length,
        });

        if (!dimScoresAgg[dimId]) dimScoresAgg[dimId] = [];
        dimScoresAgg[dimId].push(score);
      }

      // Aggregate for groups
      const meta = responseMeta.get(responseId);
      if (!meta) continue;

      const groups: [string, string][] = [];
      if (meta.department_id) groups.push(["department", meta.department_id]);
      if (meta.org_unit_id) groups.push(["org_unit", meta.org_unit_id]);
      if (meta.job_role_id) groups.push(["job_role", meta.job_role_id]);

      for (const [groupType, groupId] of groups) {
        const key = `${groupType}::${groupId}`;
        if (!groupAgg[key]) groupAgg[key] = {};
        for (const [dimId, values] of Object.entries(dimValues)) {
          const totalInDim = itemsPerDim.get(dimId) || values.length;
          if ((totalInDim - values.length) >= 2) continue;
          const avg = values.reduce((s, v) => s + v, 0) / values.length;
          const score = avg * 20;
          if (!groupAgg[key][dimId]) groupAgg[key][dimId] = [];
          groupAgg[key][dimId].push(score);
        }
      }
    }

    // Insert response_scores in batches
    for (let i = 0; i < responseScoreRows.length; i += 500) {
      await supabase.from("response_scores").insert(responseScoreRows.slice(i, i + 500));
    }

    // 7. Campaign-level aggregation
    const campaignScoreRows: any[] = [];
    for (const [dimId, scores] of Object.entries(dimScoresAgg)) {
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const variance = scores.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);

      campaignScoreRows.push({
        campaign_id,
        dimension_id: dimId,
        avg_score: Math.round(avg * 100) / 100,
        min_score: Math.round(min * 100) / 100,
        max_score: Math.round(max * 100) / 100,
        std_dev: Math.round(stdDev * 100) / 100,
        responses_count: scores.length,
      });
    }
    await supabase.from("campaign_scores").insert(campaignScoreRows);

    // 8. Generate risk alerts for dimensions with score >= 67
    const alertRows: any[] = [];
    for (const row of campaignScoreRows) {
      if (row.avg_score >= 67) {
        const dimName = dimNameMap.get(row.dimension_id) || "";
        const isCritical = CRITICAL_DIMENSIONS.some(cd => dimName.includes(cd));
        alertRows.push({
          tenant_id: campaign.tenant_id,
          campaign_id,
          dimension_id: row.dimension_id,
          dimension_name: dimName,
          score: row.avg_score,
          alert_type: isCritical ? "critical_risk" : "elevated_risk",
        });
      }
    }
    if (alertRows.length > 0) {
      await supabase.from("risk_alerts").insert(alertRows);
    }

    // 9. Group-level aggregation
    const groupScoreRows: any[] = [];
    for (const [key, dims] of Object.entries(groupAgg)) {
      const [groupType, groupId] = key.split("::");
      for (const [dimId, scores] of Object.entries(dims)) {
        const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
        groupScoreRows.push({
          campaign_id,
          dimension_id: dimId,
          group_type: groupType,
          group_id: groupId,
          avg_score: Math.round(avg * 100) / 100,
          responses_count: scores.length,
          is_suppressed: scores.length < minGroupSize,
        });
      }
    }
    if (groupScoreRows.length > 0) {
      for (let i = 0; i < groupScoreRows.length; i += 500) {
        await supabase.from("group_scores").insert(groupScoreRows.slice(i, i + 500));
      }
    }

    return new Response(
      JSON.stringify({
        message: "Scoring People Pulse complete",
        responses_processed: responses.length,
        campaign_scores: campaignScoreRows.length,
        group_scores: groupScoreRows.length,
        alerts_generated: alertRows.length,
        formula: "Score = média × 20 (range 20-100)",
        classification: "0-33: Baixo risco | 34-66: Atenção | 67-100: Risco elevado",
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
