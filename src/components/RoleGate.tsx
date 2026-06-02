import { useTenant } from "@/hooks/useTenant";
import type { ReactNode } from "react";

type AppRole = "admin_rh" | "gestor" | "diretoria" | "auditoria";

interface RoleGateProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  fallback?: ReactNode;
}

export function RoleGate({ children, allowedRoles, fallback = null }: RoleGateProps) {
  const { roles } = useTenant();
  const hasAccess = roles.some((r) => allowedRoles.includes(r as AppRole));
  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

export function useHasRole(allowedRoles: AppRole[]): boolean {
  const { roles } = useTenant();
  return roles.some((r) => allowedRoles.includes(r as AppRole));
}
