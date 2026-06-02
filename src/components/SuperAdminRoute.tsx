import { Navigate } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { isSuperAdmin } from "@/lib/superAdmin";

export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { profile } = useTenant();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile) return null;
  if (!isSuperAdmin(profile as any)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}