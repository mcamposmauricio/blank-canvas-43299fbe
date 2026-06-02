import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Play, Square, Archive, Send, Loader2, ClipboardList, ChevronDown, Copy, Download, Link2, Calendar, Mail, AlertTriangle, Users, UserCheck } from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; border: string; dot: string }> = {
  draft: { label: "Rascunho", variant: "secondary", border: "border-l-muted-foreground", dot: "bg-muted-foreground" },
  scheduled: { label: "Agendada", variant: "outline", border: "border-l-warning", dot: "bg-warning" },
  active: { label: "Ativa", variant: "default", border: "border-l-success", dot: "bg-success animate-pulse" },
  closed: { label: "Encerrada", variant: "outline", border: "border-l-accent", dot: "bg-accent" },
  archived: { label: "Arquivada", variant: "destructive", border: "border-l-destructive", dot: "bg-destructive" },
};

async function writeAuditLog(tenantId: string, userId: string | undefined, action: string, entityType: string, entityId: string | null, details: Record<string, unknown>) {
  await (supabase.from("audit_logs") as any).insert({
    tenant_id: tenantId,
    user_id: userId ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
}

export default function Campanhas() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailConfirmOpen, setEmailConfirmOpen] = useState<string | null>(null);
  const [emailMode, setEmailMode] = useState<"all" | "select">("all");
  const [selectedInvitations, setSelectedInvitations] = useState<string[]>([]);
  const [pendingInvitationsList, setPendingInvitationsList] = useState<any[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [activateConfirmId, setActivateConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", template_id: "", starts_at: "", ends_at: "", invite_message: "" });
  const [dateError, setDateError] = useState("");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_campaigns")
        .select("*, survey_templates(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["survey_templates", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_templates")
        .select("id, name")
        .eq("is_active", true)
        .or(`tenant_id.eq.${tenantId},is_global.eq.true`);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const campaignIds = campaigns.map((c: any) => c.id);
  const { data: invitationStats = [] } = useQuery({
    queryKey: ["invitation_stats", campaignIds],
    queryFn: async () => {
      if (!campaignIds.length) return [];
      const { data, error } = await supabase
        .from("survey_invitations")
        .select("campaign_id, is_used")
        .in("campaign_id", campaignIds);
      if (error) throw error;
      const statsMap: Record<string, { total: number; used: number }> = {};
      (data || []).forEach((inv: any) => {
        if (!statsMap[inv.campaign_id]) statsMap[inv.campaign_id] = { total: 0, used: 0 };
        statsMap[inv.campaign_id].total++;
        if (inv.is_used) statsMap[inv.campaign_id].used++;
      });
      return Object.entries(statsMap).map(([campaign_id, stats]) => ({ campaign_id, ...stats }));
    },
    enabled: campaignIds.length > 0,
  });

  const getStats = (campaignId: string) => {
    const found = invitationStats.find((s: any) => s.campaign_id === campaignId);
    return found || { total: 0, used: 0 };
  };

  const validateDates = () => {
    if (form.starts_at && form.ends_at && form.ends_at <= form.starts_at) {
      setDateError("A data de fim deve ser posterior à data de início.");
      return false;
    }
    setDateError("");
    return true;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!validateDates()) throw new Error("Datas inválidas");
      const { data, error } = await supabase.from("survey_campaigns").insert({
        name: form.name,
        description: form.description || null,
        template_id: form.template_id,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        invite_message: form.invite_message || null,
        tenant_id: tenantId,
        status: "draft" as any,
      }).select("id").single();
      if (error) throw error;
      // Audit log
      await writeAuditLog(tenantId!, user?.id, "create", "campaign", data?.id ?? null, { name: form.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setOpen(false);
      setForm({ name: "", description: "", template_id: "", starts_at: "", ends_at: "", invite_message: "" });
      toast.success("Campanha criada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, campaignName }: { id: string; status: string; campaignName?: string }) => {
      const { error } = await supabase.from("survey_campaigns").update({ status: status as any }).eq("id", id);
      if (error) throw error;
      // Audit log
      const action = status === "active" ? "activate_campaign" : status === "archived" ? "archive_campaign" : `set_status_${status}`;
      await writeAuditLog(tenantId!, user?.id, action, "campaign", id, { status, name: campaignName });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["campaigns"] }); toast.success("Status atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const closeCampaign = useMutation({
    mutationFn: async (campaign: any) => {
      setClosingId(campaign.id);
      const stats = getStats(campaign.id);
      if (stats.used === 0) throw new Error("Nenhuma resposta registrada. Encerre a campanha apenas após receber respostas.");
      const res = await supabase.functions.invoke("process-scoring", { body: { campaign_id: campaign.id } });
      if (res.error) throw new Error(res.error.message || "Erro no scoring");
      const processed = res.data?.responses_processed ?? 0;
      if (processed === 0) throw new Error("Nenhuma resposta completa encontrada.");
      const { error } = await supabase.from("survey_campaigns").update({ status: "closed" as any }).eq("id", campaign.id);
      if (error) throw error;
      // Audit log
      await writeAuditLog(tenantId!, user?.id, "close_campaign", "campaign", campaign.id, { name: campaign.name, responses_processed: processed });
    },
    onSuccess: () => { setClosingId(null); queryClient.invalidateQueries({ queryKey: ["campaigns"] }); toast.success("Campanha encerrada e scores calculados"); },
    onError: (e: any) => { setClosingId(null); toast.error(e.message); },
  });

  const generateInvites = useMutation({
    mutationFn: async (campaignId: string) => {
      const { data: employees, error: empErr } = await supabase.from("employees").select("id").eq("is_active", true);
      if (empErr) throw empErr;
      if (!employees?.length) throw new Error("Nenhum colaborador ativo encontrado");
      // Use ON CONFLICT DO NOTHING via upsert with ignoreDuplicates
      const invites = employees.map((emp) => ({ campaign_id: campaignId, employee_id: emp.id }));
      const { error } = await supabase.from("survey_invitations").upsert(invites, { onConflict: "campaign_id,employee_id", ignoreDuplicates: true });
      if (error) throw error;
      return employees.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["invitation_stats"] });
      toast.success(`${count} convites gerados`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const loadPendingInvitations = async (campaignId: string) => {
    setLoadingInvitations(true);
    const { data, error } = await supabase
      .from("survey_invitations")
      .select("id, token, employees(full_name, email)")
      .eq("campaign_id", campaignId)
      .eq("is_used", false);
    if (error) { toast.error("Erro ao carregar convites"); setLoadingInvitations(false); return; }
    const withEmail = (data || []).filter((inv: any) => inv.employees?.email);
    setPendingInvitationsList(withEmail);
    setLoadingInvitations(false);
  };

  const openEmailDialog = (campaignId: string) => {
    setEmailMode("all");
    setSelectedInvitations([]);
    setPendingInvitationsList([]);
    setEmailConfirmOpen(campaignId);
    loadPendingInvitations(campaignId);
  };

  const toggleInvitation = (id: string) => {
    setSelectedInvitations(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAllInvitations = () => {
    if (selectedInvitations.length === pendingInvitationsList.length) {
      setSelectedInvitations([]);
    } else {
      setSelectedInvitations(pendingInvitationsList.map((inv: any) => inv.id));
    }
  };

  const sendEmails = useMutation({
    mutationFn: async (campaignId: string) => {
      setSendingEmailId(campaignId);
      const body: any = { campaign_id: campaignId, base_url: window.location.origin };
      if (emailMode === "select" && selectedInvitations.length > 0) {
        body.invitation_ids = selectedInvitations;
      }
      const res = await supabase.functions.invoke("send-survey-emails", { body });
      if (res.error) throw new Error(res.error.message || "Erro ao enviar emails");
      return res.data;
    },
    onSuccess: (data: any) => {
      setSendingEmailId(null);
      setEmailConfirmOpen(null);
      toast.success(data.message);
      if (data.failed > 0) {
        toast.warning(`${data.failed} emails falharam`);
      }
    },
    onError: (e: any) => { setSendingEmailId(null); toast.error(e.message); },
  });

  const handleCopyLinks = async (campaignId: string) => {
    const { data: invites, error } = await supabase
      .from("survey_invitations")
      .select("token, employees(full_name)")
      .eq("campaign_id", campaignId);
    if (error || !invites?.length) { toast.error("Nenhum convite encontrado"); return; }
    const lines = invites.map((inv: any) => {
      const name = inv.employees?.full_name || "—";
      return `${name}: ${window.location.origin}/survey?token=${inv.token}`;
    });
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success(`${invites.length} links copiados`);
  };

  const handleExportCsv = async (campaignId: string, campaignName: string) => {
    const { data: invites, error } = await supabase
      .from("survey_invitations")
      .select("token, is_used, employees(full_name, email)")
      .eq("campaign_id", campaignId);
    if (error || !invites?.length) { toast.error("Nenhum convite encontrado"); return; }
    const header = "Nome,Email,Link,Status";
    const rows = invites.map((inv: any) => {
      const name = inv.employees?.full_name || "";
      const email = inv.employees?.email || "";
      const link = `${window.location.origin}/survey?token=${inv.token}`;
      const status = inv.is_used ? "Respondido" : "Pendente";
      return `"${name}","${email}","${link}","${status}"`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `convites-${campaignName.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Campanhas</h1>
          <p className="text-muted-foreground mt-1">Gerencie os ciclos de avaliação psicossocial</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nova Campanha</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Avaliação Q1 2026" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Questionário</Label>
                <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input type="date" value={form.starts_at} onChange={(e) => { setForm({ ...form, starts_at: e.target.value }); setDateError(""); }} />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input type="date" value={form.ends_at} onChange={(e) => { setForm({ ...form, ends_at: e.target.value }); setDateError(""); }} />
                </div>
              </div>
              {dateError && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />{dateError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Mensagem de convite</Label>
                <Textarea value={form.invite_message} onChange={(e) => setForm({ ...form, invite_message: e.target.value })} placeholder="Mensagem opcional para o convite" />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.template_id || createMutation.isPending} className="w-full">
                Criar Campanha
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Activate confirmation dialog */}
      <AlertDialog open={!!activateConfirmId} onOpenChange={(v) => !v && setActivateConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha ficará disponível para os colaboradores. Certifique-se de que os convites foram gerados antes de ativar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (activateConfirmId) {
                const camp = campaigns.find((c: any) => c.id === activateConfirmId);
                updateStatus.mutate({ id: activateConfirmId, status: "active", campaignName: camp?.name });
                setActivateConfirmId(null);
              }
            }}>
              Ativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma campanha criada. Crie um template de questionário primeiro.</p>
            </CardContent>
          </Card>
        ) : campaigns.map((c: any) => {
          const st = statusConfig[c.status] || statusConfig.draft;
          const isClosing = closingId === c.id;
          const isSendingEmail = sendingEmailId === c.id;
          const stats = getStats(c.id);
          const adhesionPct = stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0;
          const hasInvites = stats.total > 0;
          const pendingInvites = stats.total - stats.used;

          return (
            <Collapsible key={c.id}>
              <Card className={`border-l-4 ${st.border} hover:shadow-md transition-shadow duration-200`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{c.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {c.survey_templates?.name} • {c.starts_at ? new Date(c.starts_at).toLocaleDateString("pt-BR") : "—"} a {c.ends_at ? new Date(c.ends_at).toLocaleDateString("pt-BR") : "—"}
                      </CardDescription>
                    </div>
                    <Badge variant={st.variant} className="gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                      {st.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Status actions */}
                  <div className="flex flex-wrap gap-2">
                    {c.status === "draft" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => generateInvites.mutate(c.id)} className="gap-1.5">
                          <Send className="h-3.5 w-3.5" />Gerar Convites
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!hasInvites) {
                              toast.warning("Gere os convites antes de ativar a campanha.");
                              return;
                            }
                            setActivateConfirmId(c.id);
                          }}
                          className="gap-1.5"
                        >
                          <Play className="h-3.5 w-3.5" />Ativar
                        </Button>
                        {hasInvites && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: "scheduled", campaignName: c.name })} className="gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />Agendar
                          </Button>
                        )}
                      </>
                    )}
                    {c.status === "scheduled" && (
                      <Button size="sm" onClick={() => setActivateConfirmId(c.id)} className="gap-1.5">
                        <Play className="h-3.5 w-3.5" />Ativar
                      </Button>
                    )}
                    {c.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => closeCampaign.mutate(c)} disabled={isClosing} className="gap-1.5">
                        {isClosing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                        {isClosing ? "Processando..." : "Encerrar"}
                      </Button>
                    )}
                    {c.status === "closed" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: "archived", campaignName: c.name })} className="gap-1.5">
                        <Archive className="h-3.5 w-3.5" />Arquivar
                      </Button>
                    )}
                  </div>

                  {/* Distribution actions - visible for ALL statuses when invites exist */}
                  {hasInvites && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
                      <Button size="sm" variant="ghost" onClick={() => handleCopyLinks(c.id)} className="gap-1.5">
                        <Copy className="h-3.5 w-3.5" />Copiar Links
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleExportCsv(c.id, c.name)} className="gap-1.5">
                        <Download className="h-3.5 w-3.5" />Exportar CSV
                      </Button>
                      {(c.status === "draft" || c.status === "active" || c.status === "scheduled") && pendingInvites > 0 && (
                        <Dialog open={emailConfirmOpen === c.id} onOpenChange={(v) => v ? openEmailDialog(c.id) : setEmailConfirmOpen(null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="gap-1.5">
                              <Mail className="h-3.5 w-3.5" />Enviar por Email
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Enviar convites por email</DialogTitle>
                              <DialogDescription>
                                Campanha: "{c.name}" — {pendingInvites} convites pendentes
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                              {/* Mode selection */}
                              <div className="flex gap-2">
                                <Button
                                  variant={emailMode === "all" ? "default" : "outline"}
                                  size="sm"
                                  className="gap-1.5 flex-1"
                                  onClick={() => setEmailMode("all")}
                                >
                                  <Users className="h-3.5 w-3.5" />Todos pendentes
                                </Button>
                                <Button
                                  variant={emailMode === "select" ? "default" : "outline"}
                                  size="sm"
                                  className="gap-1.5 flex-1"
                                  onClick={() => setEmailMode("select")}
                                >
                                  <UserCheck className="h-3.5 w-3.5" />Selecionar
                                </Button>
                              </div>

                              {emailMode === "all" && (
                                <p className="text-sm text-muted-foreground">
                                  E-mails serão enviados para <strong>todos os {pendingInvitationsList.length}</strong> colaboradores pendentes.
                                </p>
                              )}

                              {emailMode === "select" && (
                                <div className="space-y-2">
                                  {loadingInvitations ? (
                                    <div className="flex items-center justify-center py-4">
                                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center justify-between">
                                        <button
                                          type="button"
                                          className="text-xs text-primary hover:underline"
                                          onClick={toggleAllInvitations}
                                        >
                                          {selectedInvitations.length === pendingInvitationsList.length ? "Desmarcar todos" : "Selecionar todos"}
                                        </button>
                                        <span className="text-xs text-muted-foreground">
                                          {selectedInvitations.length} selecionado(s)
                                        </span>
                                      </div>
                                      <ScrollArea className="h-[240px] border rounded-md p-2">
                                        <div className="space-y-1">
                                          {pendingInvitationsList.map((inv: any) => (
                                            <label
                                              key={inv.id}
                                              className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/50 cursor-pointer"
                                            >
                                              <Checkbox
                                                checked={selectedInvitations.includes(inv.id)}
                                                onCheckedChange={() => toggleInvitation(inv.id)}
                                              />
                                              <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">{inv.employees?.full_name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{inv.employees?.email}</p>
                                              </div>
                                            </label>
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                              <Button variant="outline" onClick={() => setEmailConfirmOpen(null)}>Cancelar</Button>
                              <Button
                                onClick={() => sendEmails.mutate(c.id)}
                                disabled={isSendingEmail || (emailMode === "select" && selectedInvitations.length === 0)}
                                className="gap-1.5"
                              >
                                {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                {isSendingEmail ? "Enviando..." : emailMode === "select" ? `Enviar (${selectedInvitations.length})` : "Enviar para todos"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  )}

                  {/* Adhesion metrics - collapsible */}
                  {hasInvites && (
                    <>
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full pt-1">
                        <ChevronDown className="h-3.5 w-3.5 transition-transform" />
                        <Link2 className="h-3 w-3" />
                        {stats.total} convites • {stats.used} respostas • {adhesionPct}% adesão
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                              <p className="text-[11px] text-muted-foreground">Elegíveis</p>
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-success">{stats.used}</p>
                              <p className="text-[11px] text-muted-foreground">Respostas</p>
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-primary">{pendingInvites}</p>
                              <p className="text-[11px] text-muted-foreground">Pendentes</p>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Taxa de adesão</span>
                              <span className="font-medium">{adhesionPct}%</span>
                            </div>
                            <Progress value={adhesionPct} className="h-2" />
                          </div>
                        </div>
                      </CollapsibleContent>
                    </>
                  )}
                </CardContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
