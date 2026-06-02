import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Estrutura from "./pages/Estrutura";
import Colaboradores from "./pages/Colaboradores";
import Campanhas from "./pages/Campanhas";
import Analises from "./pages/Analises";
import Relatorios from "./pages/Relatorios";
import PlanoAcao from "./pages/PlanoAcao";
import Configuracoes from "./pages/Configuracoes";
import Governanca from "./pages/Governanca";
import Usuarios from "./pages/Usuarios";
import SurveyRuntime from "./pages/SurveyRuntime";
import TrocarSenha from "./pages/TrocarSenha";
import Atividades from "./pages/Atividades";
import NotFound from "./pages/NotFound";
import { ROUTE_ALLOWED_ROLES } from "@/hooks/usePermissions";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";

export const queryClient = new QueryClient();

const R = ROUTE_ALLOWED_ROLES;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/survey" element={<SurveyRuntime />} />
          <Route path="/trocar-senha" element={<ProtectedRoute><TrocarSenha /></ProtectedRoute>} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={R["/dashboard"] as any}><Dashboard /></ProtectedRoute>} />
            <Route path="/estrutura" element={<ProtectedRoute allowedRoles={R["/estrutura"] as any}><Estrutura /></ProtectedRoute>} />
            <Route path="/colaboradores" element={<ProtectedRoute allowedRoles={R["/colaboradores"] as any}><Colaboradores /></ProtectedRoute>} />
            <Route path="/campanhas" element={<ProtectedRoute allowedRoles={R["/campanhas"] as any}><Campanhas /></ProtectedRoute>} />
            <Route path="/analises" element={<ProtectedRoute allowedRoles={R["/analises"] as any}><Analises /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute allowedRoles={R["/relatorios"] as any}><Relatorios /></ProtectedRoute>} />
            <Route path="/plano-acao" element={<ProtectedRoute allowedRoles={R["/plano-acao"] as any}><PlanoAcao /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute allowedRoles={R["/configuracoes"] as any}><Configuracoes /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute allowedRoles={R["/usuarios"] as any}><Usuarios /></ProtectedRoute>} />
            <Route path="/governanca" element={<ProtectedRoute allowedRoles={R["/governanca"] as any}><Governanca /></ProtectedRoute>} />
            <Route path="/atividades" element={<SuperAdminRoute><Atividades /></SuperAdminRoute>} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
