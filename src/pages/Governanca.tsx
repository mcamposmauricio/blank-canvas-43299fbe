import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, FileCheck, History, BookOpen, Users, ChevronDown, ChevronRight, Info } from "lucide-react";
import { FLEW_DIMENSIONS, FLEW_DISCLAIMER } from "@/lib/flew";

// ─── Helpers ────────────────────────────────────────────────────────────────

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  closed: "Encerrada",
  archived: "Arquivada",
  scheduled: "Agendada",
};

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-success/10 text-success border-success/20",
  closed: "bg-secondary/10 text-secondary-foreground border-secondary/20",
  archived: "bg-muted text-muted-foreground",
  scheduled: "bg-primary/10 text-primary border-primary/20",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  update: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  delete: "bg-destructive/10 text-destructive border-destructive/20",
  login: "bg-muted text-muted-foreground",
  activate_campaign: "bg-success/10 text-success border-success/20",
  close_campaign: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  generate_report: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  export: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
};

function getActionColor(action: string): string {
  return ACTION_COLORS[action] ?? "bg-muted text-muted-foreground";
}

function periodToDate(period: string): Date | null {
  const now = new Date();
  if (period === "24h") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (period === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ConsentTextExpander({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      className="flex items-center gap-1 text-xs text-primary hover:underline"
      onClick={() => setOpen((v) => !v)}
    >
      {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      {open ? "Recolher" : "Ver texto"}
      {open && (
        <span
          className="fixed inset-0 z-0"
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
        />
      )}
    </button>
  );
}

function AuditDetailsPopover({ details }: { details: unknown }) {
  if (!details) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-primary hover:underline">
          <Info className="h-3 w-3" /> Ver detalhes
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-64 overflow-auto">
        <pre className="text-xs whitespace-pre-wrap break-all text-foreground">
          {JSON.stringify(details, null, 2)}
        </pre>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Governanca() {
  const { tenantId, tenant } = useTenant();

  // Filters for audit log
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditPeriodFilter, setAuditPeriodFilter] = useState("all");
  // Filter for consents
  const [consentCampaignFilter, setConsentCampaignFilter] = useState("all");
  // Expand consent rows
  const [expandedConsent, setExpandedConsent] = useState<string | null>(null);

  // ── Counts (real, no limit) ────────────────────────────────────────────────
  const { data: consentCount = 0 } = useQuery({
    queryKey: ["consent_count", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("consent_records")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
    enabled: !!tenantId,
  });

  const { data: responsesCompleteCount = 0 } = useQuery({
    queryKey: ["responses_complete_count", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("survey_responses")
        .select("id", { count: "exact", head: true })
        .eq("is_complete", true);
      return count ?? 0;
    },
    enabled: !!tenantId,
  });

  const { data: auditCount = 0 } = useQuery({
    queryKey: ["audit_count", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
    enabled: !!tenantId,
  });

  // ── Audit logs ────────────────────────────────────────────────────────────
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["audit_logs", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // ── Consent records ───────────────────────────────────────────────────────
  const { data: consentRecords = [] } = useQuery({
    queryKey: ["consent_records", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consent_records")
        .select("*, survey_campaigns(id, name, status)")
        .order("accepted_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // ── Campaigns for participation tab ───────────────────────────────────────
  const { data: campaignParticipation = [] } = useQuery({
    queryKey: ["campaign_participation", tenantId],
    queryFn: async () => {
      const { data: campaigns, error: cErr } = await supabase
        .from("survey_campaigns")
        .select("id, name, status")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (cErr) throw cErr;

      const results = await Promise.all(
        (campaigns ?? []).map(async (c) => {
          const [{ count: total }, { count: used }, { count: consents }] = await Promise.all([
            supabase.from("survey_invitations").select("id", { count: "exact", head: true }).eq("campaign_id", c.id),
            supabase.from("survey_invitations").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("is_used", true),
            supabase.from("consent_records").select("id", { count: "exact", head: true }).eq("campaign_id", c.id),
          ]);
          const invited = total ?? 0;
          const responded = used ?? 0;
          const consentCount = consents ?? 0;
          const rate = invited > 0 ? Math.round((responded / invited) * 100) : 0;
          return { ...c, invited, responded, pending: invited - responded, rate, consentCount };
        })
      );
      return results;
    },
    enabled: !!tenantId,
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const uniqueActions = [...new Set(auditLogs.map((l: any) => l.action))];
  const campaignOptions = [...new Map(consentRecords.map((c: any) => [c.campaign_id, c.survey_campaigns?.name ?? c.campaign_id])).entries()];

  const filteredAuditLogs = auditLogs.filter((log: any) => {
    if (auditActionFilter !== "all" && log.action !== auditActionFilter) return false;
    const cutoff = periodToDate(auditPeriodFilter);
    if (cutoff && new Date(log.created_at) < cutoff) return false;
    return true;
  });

  const filteredConsents = consentRecords.filter((c: any) =>
    consentCampaignFilter === "all" ? true : c.campaign_id === consentCampaignFilter
  );

  const allTestMode = auditLogs.length > 0 && auditLogs.every((l: any) => (l.details as any)?.source === "test_mode");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Governança e Compliance</h1>
        <p className="text-muted-foreground mt-1">LGPD, auditoria, consentimento e metodologia</p>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            title: "Política de Anonimato",
            value: `N ≥ ${tenant?.min_group_size || 7}`,
            sub: "Tamanho mínimo de grupo",
            icon: Shield,
            color: "bg-primary/10 text-primary",
          },
          {
            title: "Consentimentos",
            value: String(consentCount),
            sub: `${campaignOptions.length} campanha(s)`,
            icon: FileCheck,
            color: "bg-success/10 text-success",
          },
          {
            title: "Respostas Completas",
            value: String(responsesCompleteCount),
            sub: "Total de respostas válidas",
            icon: Users,
            color: "bg-accent/10 text-accent",
          },
          {
            title: "Audit Log",
            value: String(auditCount),
            sub: allTestMode ? "Todos dados de teste" : "Registros de auditoria",
            icon: History,
            color: "bg-warning/10 text-warning",
          },
        ].map((item) => (
          <Card key={item.title}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="methodology">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="methodology" className="rounded-lg gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <BookOpen className="h-4 w-4" />Metodologia
          </TabsTrigger>
          <TabsTrigger value="participation" className="rounded-lg gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Users className="h-4 w-4" />Participação
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <History className="h-4 w-4" />Auditoria
          </TabsTrigger>
          <TabsTrigger value="consent" className="rounded-lg gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <FileCheck className="h-4 w-4" />Consentimentos
          </TabsTrigger>
        </TabsList>

        {/* ── METODOLOGIA ──────────────────────────────────────────────────── */}
        <TabsContent value="methodology" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">People Pulse Index (PPI) v1.0</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Total de Itens", value: "30" },
                  { label: "Dimensões", value: "8" },
                  { label: "Escala", value: "Likert 1-5" },
                ].map((s) => (
                  <div key={s.label} className="p-4 rounded-xl bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-3">Dimensões Avaliadas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FLEW_DIMENSIONS.map((dim, idx) => (
                    <div key={dim} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-foreground">{dim}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-3">Classificação de Risco</h4>
                <div className="space-y-2">
                  {[
                    { range: "0–33: Baixo risco", desc: "Condições adequadas", cls: "bg-success/10 border-success/20", dot: "bg-success" },
                    { range: "34–66: Atenção", desc: "Necessita monitoramento", cls: "bg-warning/10 border-warning/20", dot: "bg-warning" },
                    { range: "67–100: Risco elevado", desc: "Requer ação prioritária", cls: "bg-destructive/10 border-destructive/20", dot: "bg-destructive" },
                  ].map((r) => (
                    <div key={r.range} className={`flex items-center gap-3 p-3 rounded-lg border ${r.cls}`}>
                      <div className={`h-3 w-3 rounded-full ${r.dot}`} />
                      <span className="text-sm font-medium text-foreground">{r.range}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{r.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-3">Fórmula de Scoring</h4>
                <div className="p-4 rounded-xl bg-muted/50 font-mono text-sm space-y-1">
                  <p>Score_dimensão = Média × 20</p>
                  <p>Item_invertido = 6 − resposta_original</p>
                  <p>IGP = Média simples dos scores das 8 dimensões</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-3">Regras de Governança</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />Grupos com N &lt; {tenant?.min_group_size || 7} são suprimidos para garantir anonimato</li>
                  <li className="flex items-start gap-2"><Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />Respostas com &lt; 90% completude são descartadas</li>
                  <li className="flex items-start gap-2"><Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />Dados pessoais nunca são vinculados às respostas</li>
                  <li className="flex items-start gap-2"><Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />Consentimento LGPD registrado eletronicamente</li>
                  <li className="flex items-start gap-2"><Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />Retenção de dados conforme política da empresa ({tenant?.data_retention_days || 1825} dias)</li>
                </ul>
              </div>

              <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
                <p className="text-xs text-warning font-medium italic">{FLEW_DISCLAIMER}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PARTICIPAÇÃO ─────────────────────────────────────────────────── */}
        <TabsContent value="participation" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Taxa de Participação por Campanha</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Campanha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Convidados</TableHead>
                    <TableHead className="text-right">Respondidos</TableHead>
                    <TableHead className="text-right">Pendentes</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead className="text-right">Consentimentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignParticipation.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16">
                        <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-muted-foreground text-sm">Nenhuma campanha encontrada</p>
                      </TableCell>
                    </TableRow>
                  ) : campaignParticipation.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-sm">{c.name}</TableCell>
                      <TableCell>
                        <Badge className={`border text-xs ${CAMPAIGN_STATUS_COLORS[c.status] ?? "bg-muted text-muted-foreground"}`}>
                          {CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{c.invited}</TableCell>
                      <TableCell className="text-right text-sm text-success">{c.responded}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{c.pending}</TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-semibold ${c.rate >= 70 ? "text-success" : c.rate >= 40 ? "text-warning" : "text-destructive"}`}>
                          {c.rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm">{c.consentCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AUDITORIA ─────────────────────────────────────────────────────── */}
        <TabsContent value="audit" className="mt-6 space-y-4">
          {allTestMode && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" />
              Todos os registros abaixo são dados de teste (gerados via seed). Ações reais serão registradas conforme o uso do sistema.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {uniqueActions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={auditPeriodFilter} onValueChange={setAuditPeriodFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo período</SelectItem>
                <SelectItem value="24h">Últimas 24h</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-xs text-muted-foreground self-center">
              {filteredAuditLogs.length} registro(s)
            </span>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Data</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAuditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-16">
                        <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-muted-foreground text-sm">Nenhum registro encontrado</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredAuditLogs.map((log: any) => {
                    const isTestMode = (log.details as any)?.source === "test_mode";
                    return (
                      <TableRow key={log.id} className="hover:bg-muted/50">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {log.user_id ? log.user_id.slice(0, 8) + "…" : <span className="text-muted-foreground italic">Sistema</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge className={`border text-xs ${getActionColor(log.action)}`}>{log.action}</Badge>
                            {isTestMode && (
                              <Badge className="border text-xs bg-muted text-muted-foreground">teste</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{log.entity_type}</TableCell>
                        <TableCell>
                          <AuditDetailsPopover details={log.details} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CONSENTIMENTOS ────────────────────────────────────────────────── */}
        <TabsContent value="consent" className="mt-6 space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-primary shrink-0" />
            Consentimentos são registrados de forma anônima por design (LGPD). Não é possível identificar o respondente.
          </div>

          <div className="flex flex-wrap gap-3">
            <Select value={consentCampaignFilter} onValueChange={setConsentCampaignFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Filtrar por campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as campanhas</SelectItem>
                {campaignOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground self-center">
              {filteredConsents.length} registro(s)
            </span>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Texto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConsents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-16">
                        <FileCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-muted-foreground text-sm">Nenhum registro de consentimento</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredConsents.map((c: any) => {
                    const isExpanded = expandedConsent === c.id;
                    const campaignStatus = c.survey_campaigns?.status ?? "draft";
                    return (
                      <>
                        <TableRow key={c.id} className="hover:bg-muted/50">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(c.accepted_at).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm">{c.survey_campaigns?.name ?? "—"}</span>
                              <Badge className={`border text-xs ${CAMPAIGN_STATUS_COLORS[campaignStatus]}`}>
                                {CAMPAIGN_STATUS_LABELS[campaignStatus] ?? campaignStatus}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {c.ip_address ?? <span className="italic">—</span>}
                          </TableCell>
                          <TableCell className="text-sm">v{c.consent_version}</TableCell>
                          <TableCell>
                            <button
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                              onClick={() => setExpandedConsent(isExpanded ? null : c.id)}
                            >
                              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              {isExpanded ? "Recolher" : "Ver texto"}
                            </button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${c.id}-expanded`} className="bg-muted/20 hover:bg-muted/30">
                            <TableCell colSpan={5} className="py-3 px-6">
                              <p className="text-xs text-muted-foreground italic leading-relaxed max-w-2xl">
                                {c.consent_text}
                              </p>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
