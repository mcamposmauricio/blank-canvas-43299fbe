import { useTenant } from "./useTenant";

type AppRole = "admin_rh" | "gestor" | "diretoria" | "auditoria";

const ROUTE_ROLES: Record<string, AppRole[]> = {
  "/dashboard": ["admin_rh", "gestor", "diretoria"],
  "/estrutura": ["admin_rh"],
  "/colaboradores": ["admin_rh"],
  "/campanhas": ["admin_rh"],
  "/analises": ["admin_rh", "gestor", "diretoria"],
  "/relatorios": ["admin_rh", "diretoria", "auditoria"],
  "/plano-acao": ["admin_rh", "gestor"],
  "/configuracoes": ["admin_rh"],
  "/usuarios": ["admin_rh"],
  "/governanca": ["admin_rh", "auditoria"],
};

export const ROUTE_ALLOWED_ROLES = ROUTE_ROLES;

/** First route a given role set is allowed to access */
export function getDefaultRoute(roles: string[]): string {
  const order = ["/dashboard", "/analises", "/relatorios", "/plano-acao", "/governanca"];
  for (const route of order) {
    const allowed = ROUTE_ROLES[route];
    if (!allowed || roles.some((r) => allowed.includes(r as AppRole))) return route;
  }
  return "/dashboard";
}

export function usePermissions() {
  const { roles, profile } = useTenant();

  const isGestor = roles.includes("gestor");
  const isReadOnly = roles.some((r) => r === "diretoria" || r === "auditoria") && !roles.includes("admin_rh");

  const canCreate = !isReadOnly;
  const canEdit = !isReadOnly;
  const canDelete = !isReadOnly;

  const departmentFilter: string | null = isGestor ? (profile as any)?.department_id ?? null : null;

  function hasRouteAccess(path: string): boolean {
    const allowed = ROUTE_ROLES[path];
    if (!allowed) return true;
    if (roles.length === 0) return true; // no roles assigned yet = allow (graceful)
    return roles.some((r) => allowed.includes(r as AppRole));
  }

  return { canCreate, canEdit, canDelete, isReadOnly, isGestor, departmentFilter, hasRouteAccess, roles };
}
