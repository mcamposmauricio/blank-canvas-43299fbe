import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut, User, ChevronDown, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/App";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/estrutura": "Estrutura Organizacional",
  "/colaboradores": "Colaboradores",
  "/campanhas": "Campanhas",
  "/analises": "Análises",
  "/relatorios": "Relatórios",
  "/plano-acao": "Plano de Ação",
  "/configuracoes": "Configurações",
  "/governanca": "Governança",
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenant, profile, roles, tenantId } = useTenant();

  const { data: orgUnitsCount } = useQuery({
    queryKey: ["org_units_count", tenantId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("org_units")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!tenantId,
  });

  const isTenantEmpty = orgUnitsCount !== undefined && orgUnitsCount === 0;
  const { startTour } = useOnboardingTour(!!profile && !!tenant, isTenantEmpty);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate("/auth");
  };

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const currentPage = pageTitles[location.pathname] || "";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border/60 glass sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-6" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground leading-tight">
                  {currentPage}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline leading-tight">
                  {tenant?.name || "Carregando..."}
                </span>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 h-10 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground hidden md:inline">
                    {profile?.full_name || "Usuário"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile?.full_name || "Usuário"}</p>
                    <p className="text-xs text-muted-foreground">{profile?.email || ""}</p>
                    {roles.length > 0 && (
                      <p className="text-xs text-accent capitalize">{roles[0]}</p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={startTour}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Refazer Tour
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 p-4 lg:p-8 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
