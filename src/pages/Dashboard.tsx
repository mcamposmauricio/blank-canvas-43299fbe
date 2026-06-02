import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, ClipboardList, TrendingUp, Activity, Calendar, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { classifyRisk, getBarColorClass, getRiskBadgeClass, FLEW_DISCLAIMER } from "@/lib/flew";

// SVG Gauge component for IGP
function GaugeChart({ value, size = 200 }: { value: number; size?: number }) {
  const risk = classifyRisk(value);
  const riskColors = { low: "hsl(var(--success))", attention: "hsl(var(--warning))", high: "hsl(var(--destructive))" };
  const color = riskColors[risk.level];
  const radius = size * 0.38;
  const cx = size / 2;
  const cy = size * 0.55;
  const startAngle = -180;
  const endAngle = 0;
  const range = endAngle - startAngle;
  const clampedValue = Math.min(100, Math.max(0, value));
  const valueAngle = startAngle + (clampedValue / 100) * range;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (start: number, end: number) => {
    const x1 = cx + radius * Math.cos(toRad(start));
    const y1 = cy + radius * Math.sin(toRad(start));
    const x2 = cx + radius * Math.cos(toRad(end));
    const y2 = cy + radius * Math.sin(toRad(end));
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const needleLen = radius * 0.85;
  const nx = cx + needleLen * Math.cos(toRad(valueAngle));
  const ny = cy + needleLen * Math.sin(toRad(valueAngle));

  return (
    <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
      <path d={arcPath(startAngle, endAngle)} fill="none" stroke="hsl(var(--muted))" strokeWidth={size * 0.06} strokeLinecap="round" />
      <path d={arcPath(startAngle, valueAngle)} fill="none" stroke={color} strokeWidth={size * 0.06} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4} fill={color} />
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={size * 0.16} fontWeight="bold" fill="currentColor">{value.toFixed(1)}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={size * 0.055} fill={color} fontWeight="600">{risk.label}</text>
    </svg>
  );
}

export default function Dashboard() {
  const { tenantId, profile } = useTenant();
  const { isGestor, departmentFilter } = usePermissions();

  const { data: activeCampaigns = 0, isLoading: loadingCamp } = useQuery({
    queryKey: ["dashboard_active_campaigns", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("survey_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("status", "active" as any)
        .eq("tenant_id", tenantId!);
      return count || 0;
    },
    enabled: !!tenantId,
  });

  const { data: employeeCount = 0, isLoading: loadingEmp } = useQuery({
    queryKey: ["dashboard_employees", tenantId, departmentFilter],
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (isGestor && departmentFilter) {
        query = query.eq("department_id", departmentFilter);
      }
      const { count } = await query;
      return count || 0;
    },
    enabled: !!tenantId,
  });

  const { data: activeCampaign } = useQuery({
    queryKey: ["dashboard_active_campaign_detail", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("survey_campaigns")
        .select("id, name, starts_at, ends_at")
        .eq("status", "active" as any)
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: inviteStats } = useQuery({
    queryKey: ["dashboard_invite_stats", activeCampaign?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("survey_invitations")
        .select("is_used")
        .eq("campaign_id", activeCampaign!.id);
      const total = data?.length || 0;
      const used = data?.filter((i) => i.is_used).length || 0;
      return { total, used, rate: total > 0 ? Math.round((used / total) * 100) : 0 };
    },
    enabled: !!activeCampaign?.id,
  });

  const { data: lastClosedCampaign } = useQuery({
    queryKey: ["dashboard_last_closed", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("survey_campaigns")
        .select("id")
        .in("status", ["closed", "archived"] as any[])
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: dimensionScores = [] } = useQuery({
    queryKey: ["dashboard_dim_scores", lastClosedCampaign?.id, isGestor, departmentFilter],
    queryFn: async () => {
      if (isGestor && departmentFilter) {
        // Gestor: use group_scores filtered by their department (RLS also enforces this)
        const { data } = await supabase
          .from("group_scores")
          .select("avg_score, survey_dimensions(name, sort_order)")
          .eq("campaign_id", lastClosedCampaign!.id)
          .eq("group_type", "department")
          .eq("group_id", departmentFilter)
          .eq("is_suppressed", false);
        return data || [];
      }
      const { data } = await supabase
        .from("campaign_scores")
        .select("avg_score, survey_dimensions(name, sort_order)")
        .eq("campaign_id", lastClosedCampaign!.id)
        .order("survey_dimensions(sort_order)");
      return data || [];
    },
    enabled: !!lastClosedCampaign?.id,
  });

  const { data: riskAlerts = [] } = useQuery({
    queryKey: ["dashboard_risk_alerts", lastClosedCampaign?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("risk_alerts")
        .select("*")
        .eq("campaign_id", lastClosedCampaign!.id)
        .is("resolved_at", null)
        .order("score", { ascending: false });
      return data || [];
    },
    enabled: !!lastClosedCampaign?.id,
  });

  const igp = dimensionScores.length > 0
    ? Math.round((dimensionScores.reduce((s: number, d: any) => s + Number(d.avg_score), 0) / dimensionScores.length) * 10) / 10
    : null;

  const igpRisk = igp != null ? classifyRisk(igp) : null;
  const adhesionRate = inviteStats?.rate ?? 0;

  // Top 3 critical dimensions (highest scores = highest risk)
  const top3Critical = [...dimensionScores]
    .sort((a: any, b: any) => Number(b.avg_score) - Number(a.avg_score))
    .slice(0, 3);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const stats = [
    { title: "Campanhas Ativas", value: String(activeCampaigns), icon: ClipboardList, sub: "", loading: loadingCamp, color: "bg-primary/10 text-primary" },
    { title: "Taxa de Adesão", value: `${adhesionRate}%`, icon: TrendingUp, sub: inviteStats ? `${inviteStats.used}/${inviteStats.total}` : "", loading: false, color: "bg-accent/10 text-accent" },
    { title: "Colaboradores", value: String(employeeCount), icon: Users, sub: "ativos", loading: loadingEmp, color: "bg-success/10 text-success" },
    { title: "Índice Geral (IGP)", value: igp != null ? String(igp) : "—", icon: BarChart3, sub: igpRisk ? igpRisk.label : "Sem dados", loading: false, color: igpRisk ? `${getRiskBadgeClass(igpRisk.level).split(" ")[0]} ${getRiskBadgeClass(igpRisk.level).split(" ")[1]}` : "bg-muted text-muted-foreground" },
  ];

  return (
    <div className="space-y-8">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          {greeting()}, {profile?.full_name?.split(" ")[0] || "Usuário"}
        </h1>
        <p className="text-muted-foreground mt-1">Visão geral do sistema de avaliação psicossocial</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow duration-200 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</CardTitle>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {stat.loading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk Alerts */}
      {riskAlerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Alertas de Risco Elevado ({riskAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {riskAlerts.map((alert: any) => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-destructive/20">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                    <span className="font-medium text-sm text-foreground">{alert.dimension_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-destructive">{Number(alert.score).toFixed(1)}</span>
                    <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                      {alert.alert_type === "critical_risk" ? "Crítico" : "Elevado"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* IGP Gauge + Top 3 */}
        <Card className="animate-fade-in" style={{ animationDelay: "320ms" }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              Índice Geral Psicossocial (IGP)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {igp == null ? (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma campanha encerrada com scores calculados</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <GaugeChart value={igp} size={220} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Top 3 — Maiores Riscos</h4>
                  <div className="space-y-2">
                    {top3Critical.map((dim: any, idx) => {
                      const score = Number(dim.avg_score);
                      const risk = classifyRisk(score);
                      return (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                          <span className="text-sm text-foreground">{dim.survey_dimensions?.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${getRiskBadgeClass(risk.level)}`}>
                            {score.toFixed(1)} — {risk.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dimensions bar chart */}
        <Card className="animate-fade-in" style={{ animationDelay: "400ms" }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Dimensões Psicossociais
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dimensionScores.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Sem dados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dimensionScores.map((dim: any) => {
                  const score = Number(dim.avg_score);
                  const risk = classifyRisk(score);
                  return (
                    <div key={dim.survey_dimensions?.name} className="space-y-1.5">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-foreground font-medium text-xs">{dim.survey_dimensions?.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-xs">{score.toFixed(1)}</span>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${getRiskBadgeClass(risk.level)}`}>
                            {risk.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getBarColorClass(score)} transition-all duration-500`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Campaign */}
      <Card className="animate-fade-in" style={{ animationDelay: "480ms" }}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent" />
            Campanha Ativa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeCampaign ? (
            <>
              <div>
                <h3 className="font-semibold text-foreground text-base">{activeCampaign.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeCampaign.starts_at ? new Date(activeCampaign.starts_at).toLocaleDateString("pt-BR") : "—"} — {activeCampaign.ends_at ? new Date(activeCampaign.ends_at).toLocaleDateString("pt-BR") : "—"}
                </p>
              </div>
              {inviteStats && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-semibold text-foreground">{inviteStats.rate}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${inviteStats.rate}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    {[
                      { label: "Convidados", value: inviteStats.total },
                      { label: "Respondidos", value: inviteStats.used },
                      { label: "Pendentes", value: inviteStats.total - inviteStats.used },
                    ].map((item) => (
                      <div key={item.label} className="text-center p-3 rounded-xl bg-muted/50">
                        <div className="text-xl font-bold text-foreground">{item.value}</div>
                        <div className="text-[11px] text-muted-foreground font-medium">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma campanha ativa</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* People Pulse Disclaimer */}
      <div className="text-[11px] text-muted-foreground/60 text-center italic px-4">
        {FLEW_DISCLAIMER}
      </div>
    </div>
  );
}
