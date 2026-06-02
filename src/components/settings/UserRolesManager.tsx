import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Info, UserPlus, Loader2, Pencil, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ALL_ROLES: AppRole[] = ["admin_rh", "gestor", "diretoria", "auditoria"];

const ROLE_INFO: { role: AppRole; label: string; description: string }[] = [
  { role: "admin_rh", label: "Admin RH", description: "Acesso total: estrutura, colaboradores, campanhas, relatórios, planos de ação, configurações e governança" },
  { role: "gestor", label: "Gestor", description: "Dashboard, análises e planos de ação filtrados pelo seu departamento" },
  { role: "diretoria", label: "Diretoria", description: "Visão consolidada somente-leitura: dashboard, análises e relatórios" },
  { role: "auditoria", label: "Auditoria", description: "Somente-leitura em governança e relatórios" },
];

const ROLE_LABELS: Record<AppRole, string> = Object.fromEntries(
  ROLE_INFO.map((r) => [r.role, r.label])
) as Record<AppRole, string>;

export default function UserRolesManager() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Create form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole | "">("");

  // Edit dialog state
  const [editingUser, setEditingUser] = useState<{ user_id: string; full_name: string } | null>(null);
  const [editName, setEditName] = useState("");

  // Delete dialog state
  const [deletingUser, setDeletingUser] = useState<{ user_id: string; full_name: string | null } | null>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["user_roles_all", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["profiles", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["user_roles_all", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["user_roles", user?.id] });
  };

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-tenant-user", {
        body: { tenant_id: tenantId, email: newEmail, password: newPassword, full_name: newName, role: newRole },
      });
      if (error) {
        const context = await (error as any).context?.json?.().catch(() => null);
        throw new Error(context?.error || error.message);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      invalidate();
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("");
      toast.success("Usuário criado com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("tenant_id", tenantId!);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole, tenant_id: tenantId! });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Papel atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateName = useMutation({
    mutationFn: async ({ userId, fullName }: { userId: string; fullName: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("user_id", userId)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setEditingUser(null);
      toast.success("Nome atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-tenant-user", {
        body: { user_id: userId, tenant_id: tenantId },
      });
      if (error) {
        const context = await (error as any).context?.json?.().catch(() => null);
        throw new Error(context?.error || error.message);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      invalidate();
      setDeletingUser(null);
      toast.success("Usuário excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getCurrentRole = (userId: string): AppRole | undefined => {
    const entry = userRoles.find((r) => r.user_id === userId);
    return entry?.role as AppRole | undefined;
  };

  const handleChangeRole = (userId: string, newRole: AppRole) => {
    const currentRole = getCurrentRole(userId);
    if (userId === user?.id && currentRole === "admin_rh" && newRole !== "admin_rh") {
      const otherAdmins = userRoles.filter((r) => r.role === "admin_rh" && r.user_id !== user?.id);
      if (otherAdmins.length === 0) {
        toast.error("Você é o único Admin RH. Atribua este papel a outro usuário antes de alterar o seu.");
        return;
      }
    }
    changeRole.mutate({ userId, newRole });
  };

  const handleDeleteClick = (profile: { user_id: string; full_name: string | null }) => {
    if (profile.user_id === user?.id) {
      toast.error("Você não pode excluir seu próprio usuário.");
      return;
    }
    const currentRole = getCurrentRole(profile.user_id);
    if (currentRole === "admin_rh") {
      const otherAdmins = userRoles.filter((r) => r.role === "admin_rh" && r.user_id !== profile.user_id);
      if (otherAdmins.length === 0) {
        toast.error("Não é possível excluir o único Admin RH do tenant.");
        return;
      }
    }
    setDeletingUser(profile);
  };

  const canSubmit = newName.trim() && newEmail.trim() && newPassword.trim() && newRole;

  return (
    <div className="space-y-6">
      {/* Create user form */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-foreground">Criar novo usuário</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-name" className="text-xs">Nome completo</Label>
            <Input id="new-name" placeholder="Ex: João Silva" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-email" className="text-xs">Email</Label>
            <Input id="new-email" type="email" placeholder="usuario@empresa.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs">Senha</Label>
            <Input id="new-password" type="password" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Papel</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => (<SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3">
          <Button size="sm" onClick={() => createUser.mutate()} disabled={!canSubmit || createUser.isPending} className="gap-2">
            {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {createUser.isPending ? "Criando..." : "Criar Usuário"}
          </Button>
        </div>
      </div>

      {/* Role descriptions */}
      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Descrição dos papéis</span>
        </div>
        <div className="grid gap-2">
          {ROLE_INFO.map((r) => (
            <div key={r.role} className="flex gap-2 text-sm">
              <span className="font-medium text-foreground min-w-[90px]">{r.label}:</span>
              <span className="text-muted-foreground">{r.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Users table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead className="w-[100px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => {
            const currentRole = getCurrentRole(profile.user_id);
            const isSelf = profile.user_id === user?.id;
            return (
              <TableRow key={profile.user_id}>
                <TableCell className="font-medium">{profile.full_name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{profile.email || "—"}</TableCell>
                <TableCell>
                  <Select
                    value={currentRole || ""}
                    onValueChange={(v) => handleChangeRole(profile.user_id, v as AppRole)}
                    disabled={changeRole.isPending}
                  >
                    <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Selecione um papel" /></SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.map((r) => (<SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setEditingUser({ user_id: profile.user_id, full_name: profile.full_name || "" }); setEditName(profile.full_name || ""); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteClick(profile)}
                      disabled={isSelf}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Edit name dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nome</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Nome completo</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button
              onClick={() => editingUser && updateName.mutate({ userId: editingUser.user_id, fullName: editName })}
              disabled={!editName.trim() || updateName.isPending}
            >
              {updateName.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => { if (!open) setDeletingUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{deletingUser?.full_name || "este usuário"}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingUser && deleteUser.mutate(deletingUser.user_id)}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
