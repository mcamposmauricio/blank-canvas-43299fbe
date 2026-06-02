import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, Send, Clock, XCircle } from "lucide-react";
import { FLEW_DISCLAIMER } from "@/lib/flew";

type SurveyItem = {
  id: string;
  text: string;
  is_inverted: boolean;
  sort_order: number;
  dimension_id: string;
  dimension_name: string;
};

type TenantBranding = {
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

const likertLabels = ["Nunca / Quase nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"];

export default function SurveyRuntime() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [step, setStep] = useState<"consent" | "survey" | "done" | "error" | "expired" | "closed" | "loading">("loading");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [items, setItems] = useState<SurveyItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [currentDimension, setCurrentDimension] = useState(0);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  // Employee data for group tracking
  const [employeeData, setEmployeeData] = useState<{ department_id: string | null; org_unit_id: string | null; job_role_id: string | null } | null>(null);

  useEffect(() => {
    if (!token) { setStep("error"); return; }
    loadSurvey();
  }, [token]);

  async function loadSurvey() {
    try {
      const { data: inv, error: invErr } = await supabase
        .from("survey_invitations")
        .select("*, survey_campaigns(*, survey_templates(*))")
        .eq("token", token!)
        .single();
      if (invErr || !inv) { setStep("error"); return; }
      if (inv.is_used) { setStep("done"); return; }

      const camp = inv.survey_campaigns;

      // Validate campaign status
      if (camp.status !== "active") {
        setStep(camp.status === "closed" || camp.status === "archived" ? "closed" : "expired");
        return;
      }

      // Validate campaign period
      const now = new Date();
      if (camp.starts_at && new Date(camp.starts_at) > now) {
        setStep("expired");
        return;
      }
      if (camp.ends_at && new Date(camp.ends_at) < now) {
        setStep("closed");
        return;
      }

      setInvitation(inv);
      setCampaign(camp);

      // Collect employee group data via SECURITY DEFINER RPC (bypasses RLS for anon)
      const { data: empMeta } = await supabase.rpc('get_employee_metadata_by_token', { _token: token! });
      if (empMeta && empMeta.length > 0) {
        setEmployeeData({
          department_id: empMeta[0].department_id ?? null,
          org_unit_id: empMeta[0].org_unit_id ?? null,
          job_role_id: empMeta[0].job_role_id ?? null,
        });
      }

      // Fetch tenant branding via campaign tenant_id
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, logo_url, primary_color, secondary_color")
        .eq("id", camp.tenant_id)
        .single();
      if (tenant) setBranding(tenant);

      const { data: dims } = await supabase
        .from("survey_dimensions")
        .select("id, name, sort_order")
        .eq("template_id", camp.template_id)
        .order("sort_order");
      if (!dims?.length) { setStep("error"); return; }
      const { data: surveyItems } = await supabase
        .from("survey_items")
        .select("*")
        .in("dimension_id", dims.map((d) => d.id))
        .order("sort_order");
      const enriched = (surveyItems || []).map((item) => ({
        ...item,
        dimension_name: dims.find((d) => d.id === item.dimension_id)?.name || "",
      }));
      setItems(enriched);
      setStep("consent");
    } catch {
      setStep("error");
    }
  }

  const dimensions = [...new Map(items.map((i) => [i.dimension_id, { id: i.dimension_id, name: i.dimension_name }])).values()];
  const currentDimItems = items.filter((i) => i.dimension_id === dimensions[currentDimension]?.id);
  const answeredCount = Object.keys(answers).length;
  const totalItems = items.length;
  const progressPct = totalItems > 0 ? (answeredCount / totalItems) * 100 : 0;
  const completionPct = totalItems > 0 ? answeredCount / totalItems : 0;

  // Dynamic branding style
  const brandStyle = branding?.primary_color
    ? { "--brand-primary": branding.primary_color } as React.CSSProperties
    : {};

  async function handleSubmit() {
    if (completionPct < 0.9) {
      toast.error("Responda pelo menos 90% das perguntas");
      return;
    }
    setSubmitting(true);
    try {
      // LGPD compliance: register consent via edge function to capture IP/user-agent
      const consentText = "Aceito participar desta avaliação de forma anônima conforme a LGPD. Compreendo que este instrumento avalia fatores organizacionais e não constitui diagnóstico clínico individual.";
      const consentRes = await supabase.functions.invoke("capture-consent", {
        body: {
          campaign_id: campaign.id,
          consent_text: consentText,
          consent_version: 1,
        },
      });
      if (consentRes.error) throw new Error(consentRes.error.message || "Erro ao registrar consentimento");

      // Generate ID client-side to avoid INSERT...RETURNING SELECT policy conflict
      const responseId = crypto.randomUUID();
      const { error: respErr } = await supabase
        .from("survey_responses")
        .insert({
          id: responseId,
          campaign_id: campaign.id,
          is_complete: true,
          completed_at: new Date().toISOString(),
          department_id: employeeData?.department_id ?? null,
          org_unit_id: employeeData?.org_unit_id ?? null,
          job_role_id: employeeData?.job_role_id ?? null,
        });
      if (respErr) throw respErr;

      const answerRows = Object.entries(answers).map(([item_id, value]) => ({
        response_id: responseId,
        item_id,
        value,
      }));
      const { error: ansErr } = await supabase.from("survey_answers").insert(answerRows);
      if (ansErr) throw ansErr;

      await supabase.from("survey_invitations").update({ is_used: true, used_at: new Date().toISOString() }).eq("id", invitation.id);

      setStep("done");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const BrandingHeader = () => {
    if (!branding) return null;
    return (
      <div className="flex items-center gap-3 mb-4">
        {branding.logo_url && (
          <img src={branding.logo_url} alt={branding.name} className="h-10 max-w-[160px] object-contain" />
        )}
        <span className="text-sm font-medium text-muted-foreground">{branding.name}</span>
      </div>
    );
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary animate-pulse" />
          <p className="text-muted-foreground text-sm">Carregando avaliação...</p>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Link inválido</h2>
            <p className="text-muted-foreground text-sm">Este link de avaliação é inválido ou já foi utilizado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "closed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <BrandingHeader />
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Avaliação encerrada</h2>
            <p className="text-muted-foreground text-sm">O período de coleta desta avaliação já foi encerrado. Não é mais possível enviar respostas.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <BrandingHeader />
            <div className="h-16 w-16 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto">
              <Clock className="h-8 w-8 text-warning" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Avaliação indisponível</h2>
            <p className="text-muted-foreground text-sm">Esta avaliação ainda não está aberta para respostas ou o período de coleta expirou.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-xl animate-scale-in">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <BrandingHeader />
            <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Obrigado!</h2>
            <p className="text-muted-foreground text-sm">Sua avaliação foi registrada de forma anônima. Suas respostas contribuirão para a melhoria do ambiente de trabalho.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "consent") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4" style={brandStyle}>
        <Card className="max-w-lg w-full shadow-xl animate-fade-in">
          <CardHeader>
            <BrandingHeader />
            <CardTitle className="text-xl">Avaliação de Riscos Psicossociais</CardTitle>
            <CardDescription>{campaign?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaign?.invite_message && (
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                <p className="text-sm text-foreground">{campaign.invite_message}</p>
              </div>
            )}
            <div className="prose prose-sm text-muted-foreground">
              <h3 className="text-foreground text-base font-semibold">Termo de Consentimento (LGPD)</h3>
              <p>
                Esta avaliação é totalmente anônima. Suas respostas não serão vinculadas à sua identidade.
                Os dados serão utilizados exclusivamente para fins de análise organizacional agregada.
              </p>
              <ul className="space-y-1">
                <li>⏱ Tempo estimado: 10–15 minutos</li>
                <li>🔒 Garantia de anonimato total</li>
                <li>📊 Resultados apresentados apenas de forma agregada</li>
              </ul>
            </div>
            <div className="bg-warning/10 border border-warning/20 rounded-xl p-3">
              <p className="text-xs text-warning font-medium italic">{FLEW_DISCLAIMER}</p>
            </div>
            <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-xl">
              <Checkbox id="consent" checked={consentAccepted} onCheckedChange={(c) => setConsentAccepted(c === true)} />
              <Label htmlFor="consent" className="text-sm">
                Li e aceito os termos acima, concordando em participar desta avaliação de forma anônima.
              </Label>
            </div>
            <Button className="w-full h-11" disabled={!consentAccepted} onClick={() => setStep("survey")}>
              Iniciar Avaliação
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4" style={brandStyle}>
      <div className="max-w-2xl mx-auto space-y-6">
        {branding && (
          <div className="flex items-center gap-3">
            {branding.logo_url && (
              <img src={branding.logo_url} alt={branding.name} className="h-8 max-w-[120px] object-contain" />
            )}
            <span className="text-xs text-muted-foreground">{branding.name}</span>
          </div>
        )}

        {/* Dimension progress dots — mobile-friendly */}
        <div className="flex gap-1.5 items-center flex-wrap">
          {dimensions.map((dim, idx) => (
            <button
              key={dim.id}
              onClick={() => setCurrentDimension(idx)}
              title={dim.name}
              className={`h-2.5 rounded-full transition-all duration-200 ${
                idx === currentDimension
                  ? "bg-primary w-8"
                  : idx < currentDimension
                  ? "bg-success w-2.5"
                  : "bg-muted w-2.5"
              }`}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            {currentDimension + 1}/{dimensions.length} — {dimensions[currentDimension]?.name}
          </span>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{answeredCount}/{totalItems} perguntas</span>
            <span className="font-medium">{Math.round(progressPct)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">{dimensions[currentDimension]?.name}</CardTitle>
            <CardDescription>
              Avalie cada item conforme a frequência com que você vivencia a situação descrita
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentDimItems.map((item, idx) => {
              const answered = answers[item.id] !== undefined;
              return (
                <div key={item.id} className={`space-y-3 pb-5 border-b border-border/50 last:border-0 last:pb-0 ${!answered ? "opacity-80" : ""}`}>
                  <p className="text-sm font-medium text-foreground">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold mr-2 ${answered ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {idx + 1}
                    </span>
                    {item.text}
                  </p>
                  {/* Likert — stacked on mobile, inline on desktop */}
                  <RadioGroup
                    value={answers[item.id]?.toString()}
                    onValueChange={(v) => setAnswers({ ...answers, [item.id]: parseInt(v) })}
                    className="grid grid-cols-5 gap-1 sm:flex sm:gap-3"
                  >
                    {[1, 2, 3, 4, 5].map((val) => (
                      <div key={val} className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all cursor-pointer ${answers[item.id] === val ? "border-primary bg-primary/5" : "border-border/40 hover:border-primary/40"}`}>
                        <RadioGroupItem value={val.toString()} id={`${item.id}-${val}`} className="sr-only" />
                        <Label htmlFor={`${item.id}-${val}`} className="cursor-pointer text-center w-full">
                          <span className={`block text-base font-semibold ${answers[item.id] === val ? "text-primary" : "text-muted-foreground"}`}>{val}</span>
                          <span className="block text-[9px] sm:text-[10px] text-muted-foreground leading-tight mt-0.5">{likertLabels[val - 1]}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            disabled={currentDimension === 0}
            onClick={() => setCurrentDimension((p) => p - 1)}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />Anterior
          </Button>
          {currentDimension < dimensions.length - 1 ? (
            <Button onClick={() => setCurrentDimension((p) => p + 1)} className="gap-1.5">
              Próxima<ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              {completionPct < 0.9 && (
                <span className="text-xs text-warning">{totalItems - answeredCount} pergunta(s) sem resposta</span>
              )}
              <Button onClick={handleSubmit} disabled={submitting || completionPct < 0.9} className="gap-1.5">
                <Send className="h-4 w-4" />{submitting ? "Enviando..." : "Enviar Avaliação"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
