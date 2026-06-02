import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions, getDefaultRoute } from "@/hooks/usePermissions";
import { useTenant } from "@/hooks/useTenant";

type AppRole = "admin_rh" | "gestor" | "diretoria" | "auditoria";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { roles, mustChangePassword } = useTenant();
  const { hasRouteAccess } = usePermissions();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Force password change on first login
  if (mustChangePassword && location.pathname !== "/trocar-senha") {
    return <Navigate to="/trocar-senha" replace />;
  }

  // If allowedRoles specified, check access
  if (allowedRoles && allowedRoles.length > 0 && roles.length > 0) {
    const hasAccess = roles.some((r) => allowedRoles.includes(r as AppRole));
    if (!hasAccess) {
      return <Navigate to={getDefaultRoute(roles)} replace />;
    }
  }

  return <>{children}</>;
}
