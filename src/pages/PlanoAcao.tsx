import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, Clock, Loader2, Target, AlertCircle, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FLEW_DIMENSIONS, classifyRisk, getRiskBadgeClass } from "@/lib/flew";


const statusConfig: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "outline"; border: string; color: string }> = {
  pending: { label: "Pendente", icon: Clock, variant: "secondary", border: "border-l-muted-foreground", color: "bg-muted-foreground" },
  in_progress: { label: "Em Andamento", icon: Loader2, variant: "default", border: "border-l-accent", color: "bg-accent" },
  completed: { label: "Concluído", icon: CheckCircle2, variant: "outline", border: "border-l-success", color: "bg-success" },
};

export default function PlanoAcao() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete, departmentFilter } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", dimension_name: "", responsible: "", due_date: "" });
  const [editForm, setEditForm] = useState({ title: "", description: "", dimension_name: "", responsible: "", due_date: "" });

  const { data: plans = [] } = useQuery({
    queryKey: ["action_plans", tenantId, departmentFilter],
    queryFn: async () => {
      let query = supabase
        .from("action_plans")
        .select("*, departments(name), survey_campaigns(name)")
        .order("created_at", { ascending: false });
      if (departmentFilter) {
        query = query.eq("department_id", departmentFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: riskAlerts = [] } = useQuery({
    queryKey: ["plano_risk_alerts", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("risk_alerts")
        .select("*")
        .is("resolved_at", null)
        .order("score", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("action_plans").insert({
        title: form.title,
        description: form.description || null,
        dimension_name: form.dimension_name || null,
        responsible: form.responsible,
        due_date: form.due_date,
        tenant_id: tenantId,
        created_by: user?.id,
        status: "pending" as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action_plans"] });
      setOpen(false);
      setForm({ title: "", description: "", dimension_name: "", responsible: "", due_date: "" });
      toast.success("Plano de ação criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("action_plans").update({
        title: editForm.title,
        description: editForm.description || null,
        dimension_name: editForm.dimension_name || null,
        responsible: editForm.responsible || null,
        due_date: editForm.due_date || null,
      }).eq("id", editPlan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action_plans"] });
      setEditOpen(false);
      setEditPlan(null);
      toast.success("Ação atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("action_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["action_plans"] });
      toast.success("Ação removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("action_plans").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["action_plans"] }); toast.success("Status atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEditDialog = (plan: any) => {
    setEditPlan(plan);
    setEditForm({
      title: plan.title,
      description: plan.description || "",
      dimension_name: plan.dimension_name || "",
      responsible: plan.responsible || "",
      due_date: plan.due_date || "",
    });
    setEditOpen(true);
  };

  const summary = {
    total: plans.length,
    pending: plans.filter((p: any) => p.status === "pending").length,
    in_progress: plans.filter((p: any) => p.status === "in_progress").length,
    completed: plans.filter((p: any) => p.status === "completed").length,
  };

  const completionPct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  function getDueStatus(dueDate: string | null) {
    if (!dueDate) return null;
    const diff = new Date(dueDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: "Atrasado", className: "text-destructive" };
    if (days <= 7) return { label: `${days}d restantes`, className: "text-warning" };
    return { label: `${days}d restantes`, className: "text-success" };
  }

  const isCreateValid = form.title && form.responsible && form.due_date;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Planos de Ação</h1>
          <p className="text-muted-foreground mt-1">Ações corretivas e preventivas — People Pulse</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Nova Ação</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Ação</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Dimensão relacionada</Label>
                <Select value={form.dimension_name} onValueChange={(v) => setForm({ ...form, dimension_name: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {FLEW_DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsável *</Label>
                <Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Prazo *</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!isCreateValid || createMutation.isPending} className="w-full">
                Criar Ação
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Ação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Dimensão relacionada</Label>
              <Select value={editForm.dimension_name} onValueChange={(v) => setEditForm({ ...editForm, dimension_name: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {FLEW_DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={editForm.responsible} onChange={(e) => setEditForm({ ...editForm, responsible: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
            </div>
            <Button onClick={() => editMutation.mutate()} disabled={!editForm.title || editMutation.isPending} className="w-full">
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O plano de ação será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Risk alerts suggestions */}
      {riskAlerts.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              Sugestões automáticas — Dimensões com risco elevado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {riskAlerts.map((alert: any) => {
                const risk = classifyRisk(Number(alert.score));
                return (
                  <div key={alert.id} className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-warning/20">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${getRiskBadgeClass(risk.level)}`}>
                        {Number(alert.score).toFixed(1)}
                      </Badge>
                      <span className="text-sm font-medium">{alert.dimension_name}</span>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                      setForm({ ...form, dimension_name: alert.dimension_name, title: `Ação para ${alert.dimension_name}` });
                      setOpen(true);
                    }}>
                      Criar Ação
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: summary.total, icon: Target, color: "bg-primary/10 text-primary" },
          { label: "Pendentes", value: summary.pending, icon: Clock, color: "bg-muted text-muted-foreground" },
          { label: "Em Andamento", value: summary.in_progress, icon: Loader2, color: "bg-accent/10 text-accent" },
          { label: "Concluídos", value: summary.completed, icon: CheckCircle2, color: "bg-success/10 text-success" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{item.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {summary.total > 0 && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${completionPct}%` }} />
          </div>
          <span className="font-medium">{completionPct}% concluído</span>
        </div>
      )}

      <div className="grid gap-4">
        {plans.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum plano de ação registrado</p>
            </CardContent>
          </Card>
        ) : plans.map((plan: any) => {
          const st = statusConfig[plan.status] || statusConfig.pending;
          const Icon = st.icon;
          const due = getDueStatus(plan.due_date);
          return (
            <Card key={plan.id} className={`border-l-4 ${st.border} hover:shadow-md transition-shadow`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{plan.title}</CardTitle>
                    {plan.dimension_name && <Badge variant="outline" className="mt-1.5">{plan.dimension_name}</Badge>}
                  </div>
                  <Badge variant={st.variant} className="gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${st.color}`} />
                    {st.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {plan.description && <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>}
                <div className="flex items-center justify-between">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {plan.responsible && <span>Responsável: {plan.responsible}</span>}
                    {plan.due_date && (
                      <span className={`flex items-center gap-1 ${due?.className || ""}`}>
                        {due && due.label === "Atrasado" && <AlertCircle className="h-3 w-3" />}
                        Prazo: {new Date(plan.due_date).toLocaleDateString("pt-BR")}
                        {due && <span className="font-medium">({due.label})</span>}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {canEdit && (
                      <>
                        {plan.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: plan.id, status: "in_progress" })}>Iniciar</Button>
                        )}
                        {plan.status === "in_progress" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: plan.id, status: "completed" })}>Concluir</Button>
                        )}
                        <Button size="sm" variant="ghost" className="px-2" onClick={() => openEditDialog(plan)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </>
                    )}
                    {canDelete && (
                      <Button size="sm" variant="ghost" className="px-2" onClick={() => setDeleteId(plan.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
