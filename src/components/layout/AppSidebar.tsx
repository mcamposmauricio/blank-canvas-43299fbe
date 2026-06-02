import { FLEW_DISCLAIMER } from "@/lib/flew";
import {
  LayoutDashboard,
  Building2,
  Users,
  ClipboardList,
  BarChart3,
  FileText,
  Settings,
  Shield,
  Target,
  Package,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useTenant } from "@/hooks/useTenant";
import { Separator } from "@/components/ui/separator";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { isSuperAdmin } from "@/lib/superAdmin";

type AppRole = "admin_rh" | "gestor" | "diretoria" | "auditoria";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  roles?: AppRole[];
}

const mainNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["admin_rh", "gestor", "diretoria"] },
  { title: "Estrutura", url: "/estrutura", icon: Building2, roles: ["admin_rh"] },
  { title: "Colaboradores", url: "/colaboradores", icon: Users, roles: ["admin_rh"] },
  { title: "Campanhas", url: "/campanhas", icon: ClipboardList, roles: ["admin_rh"] },
  { title: "Análises", url: "/analises", icon: BarChart3, roles: ["admin_rh", "gestor", "diretoria"] },
  { title: "Relatórios", url: "/relatorios", icon: FileText, roles: ["admin_rh", "diretoria", "auditoria"] },
  { title: "Plano de Ação", url: "/plano-acao", icon: Target, roles: ["admin_rh", "gestor"] },
];

const adminNav: NavItem[] = [
  { title: "Configurações", url: "/configuracoes", icon: Settings, roles: ["admin_rh"] },
  { title: "Usuários", url: "/usuarios", icon: Users, roles: ["admin_rh"] },
  { title: "Governança", url: "/governanca", icon: Shield, roles: ["admin_rh", "auditoria"] },
];

export function AppSidebar() {
  const { tenant, roles, profile } = useTenant();
  const superAdmin = isSuperAdmin(profile as any);

  const hasAccess = (item: NavItem) => {
    if (!item.roles) return true;
    if (roles.length === 0) return true;
    return roles.some((r) => item.roles!.includes(r as AppRole));
  };

  const filteredMain = mainNav.filter(hasAccess);
  const filteredAdmin = adminNav.filter(hasAccess);

  const tourKey = (url: string) => {
    const slug = url.replace("/", "");
    return slug ? `nav-${slug}` : undefined;
  };

  return (
    <Sidebar data-tour="sidebar">
      <SidebarHeader className="p-5 pb-4">
        {tenant?.logo_url ? (
          <div className="flex items-center gap-3">
            <img src={tenant.logo_url} alt="Logo" className="h-10 w-10 rounded-xl object-contain bg-white" />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-sidebar-foreground tracking-tight">
                {tenant?.name}
              </span>
              <span className="text-[11px] text-sidebar-foreground/60 font-medium tracking-wide">
                Psicossocial
              </span>
            </div>
          </div>
        ) : (
          <BrandLogo size="md" className="w-full justify-start" />
        )}
      </SidebarHeader>

      <Separator className="bg-sidebar-border/50 mx-4" />

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] font-semibold text-sidebar-foreground/40 px-4">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMain.map((item) => (
                <SidebarMenuItem key={item.title} data-tour={tourKey(item.url)}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent/60 transition-all duration-200 rounded-lg mx-2 px-3 py-2"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
                    >
                      <item.icon className="mr-3 h-[18px] w-[18px]" />
                      <span className="text-[13px]">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] font-semibold text-sidebar-foreground/40 px-4">
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAdmin.map((item) => (
                  <SidebarMenuItem key={item.title} data-tour={tourKey(item.url)}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent/60 transition-all duration-200 rounded-lg mx-2 px-3 py-2"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
                      >
                        <item.icon className="mr-3 h-[18px] w-[18px]" />
                        <span className="text-[13px]">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {superAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] font-semibold text-sidebar-foreground/40 px-4">
              Plataforma
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/atividades"
                      className="hover:bg-sidebar-accent/60 transition-all duration-200 rounded-lg mx-2 px-3 py-2"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-sidebar-primary"
                    >
                      <Package className="mr-3 h-[18px] w-[18px]" />
                      <span className="text-[13px]">Atividades</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 pt-2">
        <Separator className="bg-sidebar-border/50 mb-3" />
        <p className="text-[9px] text-sidebar-foreground/35 italic leading-relaxed">
          {FLEW_DISCLAIMER}
        </p>
        <div className="text-[10px] text-sidebar-foreground/35 tracking-wide mt-1">
          PPI v1.0 • © 2026
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
