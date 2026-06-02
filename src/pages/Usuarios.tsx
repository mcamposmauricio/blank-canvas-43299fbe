import UserRolesManager from "@/components/settings/UserRolesManager";

export default function Usuarios() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Gerenciamento de Usuários</h1>
        <p className="text-muted-foreground mt-1">Crie, edite e gerencie os usuários e seus papéis no sistema</p>
      </div>
      <UserRolesManager />
    </div>
  );
}
