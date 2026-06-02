import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { BarChart3, Grid3X3, GitCompareArrows, TrendingUp } from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, ReferenceLine,
} from "recharts";
import { classifyRisk, getRiskBadgeClass } from "@/lib/flew";

function getScoreColor(score: number): string {
  const { level } = classifyRisk(score);
  return getRiskBadgeClass(level);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-foreground text-background rounded-lg px-3 py-2 shadow-lg text-xs">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {Number(p.value).toFixed(1)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analises() {
  const { tenantId } = useTenant();
  const { isGestor, departmentFilter } = usePermissions();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["analises_campaigns", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("survey_campaigns")
        .select("id, name, status, updated_at")
        .eq("tenant_id", tenantId!)
        .in("status", ["closed", "archived"] as any[])
        .order("updated_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const campaignId = selectedCampaignId || campaigns[0]?.id || "";

  const { data: campaignScores = [] } = useQuery({
    queryKey: ["analises_scores", campaignId, isGestor, departmentFilter],
    queryFn: async () => {
      if (isGestor && departmentFilter) {
        // Gestor sees only their department's scores
        const { data } = await supabase
          .from("group_scores")
          .select("avg_score, responses_count, dimension_id, survey_dimensions(name, sort_order)")
          .eq("campaign_id", campaignId)
          .eq("group_type", "department")
          .eq("group_id", departmentFilter)
          .eq("is_suppressed", false);
        return (data || []).map((d: any) => ({
          ...d,
          min_score: null,
          max_score: null,
          std_dev: null,
        }));
      }
      const { data } = await supabase
        .from("campaign_scores")
        .select("avg_score, min_score, max_score, std_dev, responses_count, dimension_id, survey_dimensions(name, sort_order)")
        .eq("campaign_id", campaignId)
        .order("survey_dimensions(sort_order)");
      return data || [];
    },
    enabled: !!campaignId && campaignId.length > 0,
  });

  const { data: groupScores = [] } = useQuery({
    queryKey: ["analises_group_scores", campaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_scores")
        .select("avg_score, group_type, group_id, dimension_id, is_suppressed, responses_count, survey_dimensions(name)")
        .eq("campaign_id", campaignId)
        .eq("group_type", "department")
        .eq("is_suppressed", false);
      return data || [];
    },
    enabled: !!campaignId && campaignId.length > 0,
  });

  const deptIds = [...new Set(groupScores.map((g: any) => g.group_id))];
  const { data: departments = [] } = useQuery({
    queryKey: ["analises_depts", deptIds],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name").in("id", deptIds);
      return data || [];
    },
    enabled: deptIds.length > 0,
  });
  const deptNameMap = new Map(departments.map((d: any) => [d.id, d.name]));

  const { data: evolutionData = [] } = useQuery({
    queryKey: ["analises_evolution", tenantId],
    queryFn: async () => {
      const { data: allCamps } = await supabase
        .from("survey_campaigns")
        .select("id, name")
        .eq("tenant_id", tenantId!)
        .in("status", ["closed", "archived"] as any[])
        .order("updated_at");
      if (!allCamps?.length) return [];
      const results: any[] = [];
      for (const camp of allCamps) {
        const { data: scores } = await supabase
          .from("campaign_scores")
          .select("avg_score, survey_dimensions(name)")
          .eq("campaign_id", camp.id);
        if (!scores?.length) continue;
        const entry: any = { periodo: camp.name };
        let total = 0;
        for (const s of scores) {
          const name = (s as any).survey_dimensions?.name || "?";
          const short = name.split(" ")[0];
          entry[short] = Number((s as any).avg_score).toFixed(1);
          total += Number((s as any).avg_score);
        }
        entry.IGP = (total / scores.length).toFixed(1);
        results.push(entry);
      }
      return results;
    },
    enabled: !!tenantId,
  });

  // Bar chart data for dimensions
  const barData = campaignScores.map((s: any) => ({
    name: s.survey_dimensions?.name || "",
    short: (s.survey_dimensions?.name || "").split(" ").slice(0, 2).join(" "),
    score: Number(s.avg_score),
    risk: classifyRisk(Number(s.avg_score)).label,
  }));

  // Compute company average per dimension for comparison
  const companyAvg = new Map<string, number>();
  for (const s of campaignScores as any[]) {
    const dimName = s.survey_dimensions?.name?.split(" ")[0]?.toLowerCase() || "?";
    companyAvg.set(dimName, Number(s.avg_score));
  }

  const heatmapByDept = new Map<string, Record<string, number>>();
  for (const gs of groupScores as any[]) {
    const deptName = deptNameMap.get(gs.group_id) || gs.group_id.substring(0, 8);
    if (!heatmapByDept.has(deptName)) heatmapByDept.set(deptName, {});
    const dimName = gs.survey_dimensions?.name?.split(" ")[0]?.toLowerCase() || "?";
    heatmapByDept.get(deptName)![dimName] = Number(gs.avg_score);
  }
  const heatmapData = Array.from(heatmapByDept.entries()).map(([area, dims]) => ({ area, ...dims }));
  const dimKeys = [...new Set((groupScores as any[]).map((g: any) => g.survey_dimensions?.name?.split(" ")[0]?.toLowerCase() || "?"))];

  // Add company average row to comparison
  const comparisonData = [...heatmapData];
  if (companyAvg.size > 0) {
    const avgRow: any = { area: "Média Empresa" };
    for (const [k, v] of companyAvg) avgRow[k] = v;
    comparisonData.push(avgRow);
  }

  const barColors = ["hsl(199, 89%, 48%)", "hsl(160, 84%, 39%)", "hsl(43, 96%, 56%)", "hsl(217, 91%, 30%)", "hsl(350, 89%, 60%)", "hsl(270, 50%, 50%)", "hsl(30, 90%, 50%)", "hsl(190, 70%, 40%)"];

  const evoKeys = evolutionData.length > 0 ? Object.keys(evolutionData[0]).filter((k) => k !== "periodo") : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Análises</h1>
          <p className="text-muted-foreground mt-1">Dashboards e visualizações — People Pulse Index</p>
        </div>
        {campaigns.length > 0 && (
          <Select value={campaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecione a campanha" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Encerre uma campanha para visualizar as análises.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="dimensions">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="dimensions" className="rounded-lg gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"><BarChart3 className="h-4 w-4" />Dimensões</TabsTrigger>
            <TabsTrigger value="heatmap" className="rounded-lg gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"><Grid3X3 className="h-4 w-4" />Heatmap</TabsTrigger>
            <TabsTrigger value="comparison" className="rounded-lg gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"><GitCompareArrows className="h-4 w-4" />Comparativo</TabsTrigger>
            <TabsTrigger value="evolution" className="rounded-lg gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"><TrendingUp className="h-4 w-4" />Evolução</TabsTrigger>
          </TabsList>

          <TabsContent value="dimensions" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Dimensões Psicossociais — Score por Dimensão</CardTitle></CardHeader>
              <CardContent>
                {barData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12">Sem dados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={barData} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="short" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine x={67} stroke="hsl(0, 84%, 60%)" strokeDasharray="5 5" label={{ value: "Risco ≥67", position: "top", fontSize: 11, fill: "hsl(0, 84%, 60%)" }} />
                      <ReferenceLine x={33} stroke="hsl(43, 96%, 56%)" strokeDasharray="3 3" />
                      <Bar dataKey="score" name="Score" fill="hsl(199, 89%, 48%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="heatmap" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Heatmap por Departamento</CardTitle></CardHeader>
              <CardContent>
                {heatmapData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12">Sem dados de grupo (N ≥ 7 necessário)</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left p-3 font-medium text-muted-foreground">Departamento</th>
                          {dimKeys.map((k) => (
                            <th key={k} className="p-3 font-medium text-muted-foreground capitalize">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {heatmapData.map((row: any) => (
                          <tr key={row.area} className="border-t border-border/50">
                            <td className="p-3 font-medium text-foreground">{row.area}</td>
                            {dimKeys.map((key) => {
                              const val = row[key] as number | undefined;
                              return (
                                <td key={key} className="p-2">
                                  {val != null ? (
                                    <div className={`rounded-xl p-2.5 text-center font-bold text-sm ${getScoreColor(val)}`}>
                                      {val.toFixed(1)}
                                    </div>
                                  ) : (
                                    <div className="rounded-xl p-2.5 text-center text-muted-foreground">—</div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comparison" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Comparativo entre Departamentos (+ Média Empresa)</CardTitle></CardHeader>
              <CardContent>
                {comparisonData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12">Sem dados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                      <XAxis dataKey="area" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <ReferenceLine y={67} stroke="hsl(0, 84%, 60%)" strokeDasharray="5 5" />
                      {dimKeys.map((key, i) => (
                        <Bar key={key} dataKey={key} name={key} fill={barColors[i % barColors.length]} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evolution" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Evolução Temporal</CardTitle></CardHeader>
              <CardContent>
                {evolutionData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-12">Necessário ao menos 1 campanha encerrada</p>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                      <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <ReferenceLine y={67} stroke="hsl(0, 84%, 60%)" strokeDasharray="5 5" label={{ value: "Risco ≥67", position: "right", fontSize: 11, fill: "hsl(0, 84%, 60%)" }} />
                      {evoKeys.map((key, i) => (
                        <Line key={key} type="monotone" dataKey={key} name={key === "IGP" ? "Índice Geral (IGP)" : key} stroke={barColors[i % barColors.length]} strokeWidth={key === "IGP" ? 3 : 1.5} dot={{ r: 3 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
