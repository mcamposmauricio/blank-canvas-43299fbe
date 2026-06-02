import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Lock, Mail, UserPlus, Users, Send, BarChart3, Shield, Layers, Palette } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";

const graphNodes = [
  { icon: Building2, label: "Estrutura", cx: 140, cy: 80, tx: 115, ty: 42, delay: 0 },
  { icon: Users, label: "Colaboradores", cx: 260, cy: 140, tx: 310, ty: 188, delay: 0.4 },
  { icon: Send, label: "Campanhas", cx: 220, cy: 280, tx: 255, ty: 320, delay: 0.8 },
  { icon: BarChart3, label: "Análises", cx: 100, cy: 240, tx: 48, ty: 278, delay: 1.2 },
];

const badges = [
  { icon: Shield, label: "LGPD Compliant" },
  { icon: Layers, label: "Multi-tenant" },
  { icon: Palette, label: "White Label" },
];

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName,
              company_name: companyName,
              company_slug: companyName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, ""),
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          // Send welcome email (fire-and-forget)
          supabase.functions.invoke("send-welcome-email", {
            body: {
              email,
              full_name: fullName,
              tenant_name: companyName,
              is_admin_created: false,
            },
          }).catch(console.error);
          navigate("/dashboard");
        } else {
          toast.success("Conta criada! Verifique seu email para confirmar. Cheque também a pasta de spam.");
        }
      }
    } catch (error: any) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("invalid login") || msg.includes("invalid_credentials")) {
        toast.error("Credenciais inválidas. Verifique seu email e senha.");
      } else if (msg.includes("email not confirmed")) {
        toast.error("Email não confirmado. Verifique sua caixa de entrada.");
      } else {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Organic Visual */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between p-12 xl:p-16 bg-sidebar text-sidebar-foreground">
        {/* Radial gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,hsl(var(--sidebar-primary)/0.15),transparent_60%),radial-gradient(ellipse_at_70%_80%,hsl(var(--accent)/0.1),transparent_50%)] pointer-events-none" />

        {/* Floating orbs */}
        <div className="orb-1 absolute top-[10%] left-[15%] w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,hsl(var(--sidebar-primary)/0.2),transparent_70%)] blur-[80px] pointer-events-none" />
        <div className="orb-2 absolute top-[50%] right-[10%] w-[250px] h-[250px] rounded-full bg-[radial-gradient(circle,hsl(var(--accent)/0.15),transparent_70%)] blur-[80px] pointer-events-none" />
        <div className="orb-3 absolute bottom-[15%] left-[30%] w-[200px] h-[200px] rounded-full bg-[radial-gradient(circle,hsl(var(--sidebar-primary)/0.12),transparent_70%)] blur-[60px] pointer-events-none" />

        {/* Typography - top */}
        <div className="relative z-10 space-y-3 animate-fade-up-in" style={{ animationDelay: "0.1s" }}>
          <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tighter leading-tight text-sidebar-foreground">
            Cuide do que realmente importa:
            <br />
            As pessoas.
          </h1>
          <p className="text-sidebar-foreground/60 text-base font-normal max-w-xs leading-relaxed">
            Avaliação psicossocial inteligente, automatizada e segura.
          </p>
        </div>

        {/* SVG Graph Illustration - center */}
        <div className="relative z-10 flex-1 flex items-center justify-center py-8">
          <svg viewBox="0 0 360 360" className="w-full max-w-[320px] xl:max-w-[360px]" fill="none">
            {/* Central circle */}
            <circle cx="180" cy="180" r="40" stroke="hsl(var(--sidebar-primary))" strokeWidth="1.5" opacity="0.3" />
            <circle
              cx="180"
              cy="180"
              r="70"
              stroke="hsl(var(--sidebar-primary))"
              strokeWidth="0.8"
              opacity="0.15"
              strokeDasharray="4 4"
            />
            <circle cx="180" cy="180" r="110" stroke="hsl(var(--sidebar-primary))" strokeWidth="0.5" opacity="0.08" />

            {/* Curved connections from center to nodes */}
            <path
              d={`M180,180 Q160,120 ${graphNodes[0].cx},${graphNodes[0].cy}`}
              stroke="hsl(var(--sidebar-primary))"
              strokeWidth="1.2"
              opacity="0.4"
              className="animate-dash-flow"
              style={{ animationDelay: "0.3s" }}
            />
            <path
              d={`M180,180 Q230,150 ${graphNodes[1].cx},${graphNodes[1].cy}`}
              stroke="hsl(var(--sidebar-primary))"
              strokeWidth="1.2"
              opacity="0.4"
              className="animate-dash-flow"
              style={{ animationDelay: "0.6s" }}
            />
            <path
              d={`M180,180 Q210,240 ${graphNodes[2].cx},${graphNodes[2].cy}`}
              stroke="hsl(var(--accent))"
              strokeWidth="1.2"
              opacity="0.4"
              className="animate-dash-flow"
              style={{ animationDelay: "0.9s" }}
            />
            <path
              d={`M180,180 Q130,220 ${graphNodes[3].cx},${graphNodes[3].cy}`}
              stroke="hsl(var(--accent))"
              strokeWidth="1.2"
              opacity="0.4"
              className="animate-dash-flow"
              style={{ animationDelay: "1.2s" }}
            />

            {/* Node circles with icons */}
            {graphNodes.map((node, i) => (
              <g
                key={i}
                className="animate-node-pulse"
                style={{ animationDelay: `${node.delay}s`, transformOrigin: `${node.cx}px ${node.cy}px` }}
              >
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r="28"
                  fill="hsl(var(--sidebar-primary)/0.08)"
                  stroke="hsl(var(--sidebar-primary))"
                  strokeWidth="1"
                  opacity="0.6"
                />
                <foreignObject x={node.cx - 12} y={node.cy - 12} width="24" height="24">
                  <node.icon className="h-6 w-6 text-sidebar-primary" />
                </foreignObject>
                <text
                  x={node.tx}
                  y={node.ty}
                  fill="hsl(var(--sidebar-foreground))"
                  fontSize="13"
                  fontWeight="600"
                  opacity="0.8"
                  letterSpacing="0.5"
                  textAnchor="middle"
                >
                  {node.label}
                </text>
              </g>
            ))}

            {/* Center dot */}
            <circle cx="180" cy="180" r="6" fill="hsl(var(--sidebar-primary))" opacity="0.5" />
            <circle cx="180" cy="180" r="3" fill="hsl(var(--sidebar-primary))" opacity="0.8" />
          </svg>
        </div>

        {/* Badges */}
        <div className="relative z-10 flex flex-wrap gap-2 animate-fade-up-in" style={{ animationDelay: "0.5s" }}>
          {badges.map((b) => (
            <span
              key={b.label}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground/70"
            >
              <b.icon className="h-3 w-3" />
              {b.label}
            </span>
          ))}
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-background">
        <div className="w-full max-w-sm space-y-6 animate-fade-in">
          {/* Mobile-only logo */}
          <div className="lg:hidden text-center space-y-2 mb-4">
          <div className="flex justify-center">
            <BrandLogo size="xl" />
          </div>
            <p className="text-xs text-muted-foreground">Bem-estar e Saúde Mental no Trabalho</p>
          </div>

          {/* Desktop logo above form */}
          <div className="hidden lg:flex justify-center">
            <BrandLogo size="xl" />
          </div>

          <div className="space-y-1 text-center lg:text-left">
            <h2 className="text-xl font-bold text-foreground">{isLogin ? "Bem-vindo de volta" : "Comece agora"}</h2>
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Acesse sua conta para continuar" : "Preencha os dados para criar sua conta"}
            </p>
          </div>

          <Card className="shadow-lg shadow-primary/5 border-border/50">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Nome da Empresa</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="companyName"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Nome da sua empresa"
                          required={!isLogin}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nome Completo</Label>
                      <div className="relative">
                        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="fullName"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Seu nome completo"
                          required={!isLogin}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                  {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar Conta"}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
                </button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-[11px] text-muted-foreground/60 max-w-sm mx-auto">
            Ao utilizar este sistema, você concorda com a Política de Privacidade e tratamento de dados conforme a LGPD.
          </p>
        </div>
      </div>
    </div>
  );
}
