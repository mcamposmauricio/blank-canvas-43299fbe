import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Trash2, UserCheck, UserX, Search, Users, Upload, FileSpreadsheet, AlertCircle, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";


type CsvRow = { full_name: string; email: string; department: string; job_role: string };

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(/[,;\t]/).map((h) => h.trim().replace(/"/g, ""));
  const nameIdx = header.findIndex((h) => ["nome", "name", "full_name", "nome completo"].includes(h));
  const emailIdx = header.findIndex((h) => ["email", "e-mail"].includes(h));
  if (nameIdx === -1 || emailIdx === -1) return [];
  const deptIdx = header.findIndex((h) => ["departamento", "department", "area", "área"].includes(h));
  const roleIdx = header.findIndex((h) => ["cargo", "role", "job_role", "função", "funcao"].includes(h));

  return lines.slice(1).map((line) => {
    const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    return {
      full_name: cols[nameIdx] || "",
      email: cols[emailIdx] || "",
      department: deptIdx >= 0 ? cols[deptIdx] || "" : "",
      job_role: roleIdx >= 0 ? cols[roleIdx] || "" : "",
    };
  }).filter((r) => r.full_name && r.email);
}

export default function Colaboradores() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<any>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", department_id: "", job_role_id: "" });
  const [editForm, setEditForm] = useState({ full_name: "", email: "", department_id: "", job_role_id: "" });
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments(name), job_roles(name)")
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: jobRoles = [] } = useQuery({
    queryKey: ["job_roles", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("job_roles").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").insert({
        full_name: form.full_name,
        email: form.email,
        department_id: form.department_id || null,
        job_role_id: form.job_role_id || null,
        tenant_id: tenantId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      setForm({ full_name: "", email: "", department_id: "", job_role_id: "" });
      toast.success("Colaborador cadastrado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").update({
        full_name: editForm.full_name,
        email: editForm.email,
        department_id: editForm.department_id === "__none__" ? null : editForm.department_id || null,
        job_role_id: editForm.job_role_id === "__none__" ? null : editForm.job_role_id || null,
      }).eq("id", editEmp.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setEditOpen(false);
      setEditEmp(null);
      toast.success("Colaborador atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("employees").update({ is_active: !is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); toast.success("Colaborador removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      if (!rows.length) {
        toast.error("Nenhum dado válido encontrado. Verifique se o CSV contém colunas 'nome' e 'email'.");
        return;
      }
      setCsvRows(rows);
      setCsvOpen(true);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCsvImport = async () => {
    if (!csvRows.length || !tenantId) return;
    setCsvImporting(true);
    try {
      const deptMap = new Map(departments.map((d: any) => [d.name.toLowerCase(), d.id]));
      const roleMap = new Map(jobRoles.map((r: any) => [r.name.toLowerCase(), r.id]));

      const rows = csvRows.map((r) => ({
        full_name: r.full_name,
        email: r.email,
        department_id: deptMap.get(r.department.toLowerCase()) || null,
        job_role_id: roleMap.get(r.job_role.toLowerCase()) || null,
        tenant_id: tenantId,
      }));

      const { error } = await supabase.from("employees").insert(rows);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setCsvOpen(false);
      setCsvRows([]);
      toast.success(`${rows.length} colaboradores importados`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCsvImporting(false);
    }
  };

  const openEdit = (emp: any) => {
    setEditEmp(emp);
    setEditForm({
      full_name: emp.full_name,
      email: emp.email,
      department_id: emp.department_id || "__none__",
      job_role_id: emp.job_role_id || "__none__",
    });
    setEditOpen(true);
  };

  const filtered = employees.filter((e: any) =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Colaboradores</h1>
          <p className="text-muted-foreground mt-1">
            Gestão de colaboradores elegíveis para avaliação
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvFile} />
          <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />Importar CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Novo Colaborador</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Colaborador</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Select value={form.job_role_id} onValueChange={(v) => setForm({ ...form, job_role_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {jobRoles.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => createMutation.mutate()} disabled={!form.full_name || !form.email || createMutation.isPending} className="w-full">
                  Cadastrar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Colaborador</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
                <Label>Departamento</Label>
                <Select value={editForm.department_id} onValueChange={(v) => setEditForm({ ...editForm, department_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem departamento —</SelectItem>
                    {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select value={editForm.job_role_id} onValueChange={(v) => setEditForm({ ...editForm, job_role_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem cargo —</SelectItem>
                    {jobRoles.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            <Button onClick={() => editMutation.mutate()} disabled={!editForm.full_name || !editForm.email || editMutation.isPending} className="w-full">
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O colaborador será removido permanentemente do sistema.
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

      {/* CSV Import Preview Dialog */}
      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importar Colaboradores ({csvRows.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden">
            {csvRows.some((r) => !r.full_name || !r.email) && (
              <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4" />
                Algumas linhas foram ignoradas por falta de nome ou email.
              </div>
            )}
            <div className="overflow-auto max-h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Cargo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvRows.slice(0, 50).map((row, i) => {
                    const deptMatch = departments.some((d: any) => d.name.toLowerCase() === row.department.toLowerCase());
                    const roleMatch = jobRoles.some((r: any) => r.name.toLowerCase() === row.job_role.toLowerCase());
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.email}</TableCell>
                        <TableCell>
                          {row.department ? (
                            <Badge variant={deptMatch ? "default" : "secondary"} className="text-[10px]">
                              {row.department}{!deptMatch && " ⚠"}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {row.job_role ? (
                            <Badge variant={roleMatch ? "default" : "secondary"} className="text-[10px]">
                              {row.job_role}{!roleMatch && " ⚠"}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {csvRows.length > 50 && (
              <p className="text-xs text-muted-foreground text-center">Mostrando 50 de {csvRows.length} linhas</p>
            )}
            <p className="text-xs text-muted-foreground">
              ⚠ indica que o departamento/cargo não foi encontrado na base e será ignorado.
            </p>
            <Button onClick={handleCsvImport} disabled={csvImporting} className="w-full gap-2">
              {csvImporting ? <><Loader2 className="h-4 w-4 animate-spin" />Importando...</> : <>Confirmar Importação ({csvRows.length})</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          Mostrando {filtered.length} de {employees.length}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum colaborador encontrado</p>
                  </TableCell>
                </TableRow>
              ) : filtered.map((emp: any) => (
                <TableRow key={emp.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(emp.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{emp.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                  <TableCell>{emp.departments?.name || "—"}</TableCell>
                  <TableCell>{emp.job_roles?.name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={emp.is_active ? "default" : "secondary"} className="gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${emp.is_active ? "bg-success" : "bg-muted-foreground"}`} />
                      {emp.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(emp)}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={emp.is_active ? "Desativar" : "Ativar"} onClick={() => toggleMutation.mutate({ id: emp.id, is_active: emp.is_active })}>
                        {emp.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Excluir" onClick={() => setDeleteId(emp.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
