
-- Create risk_alerts table for automated risk monitoring
CREATE TABLE public.risk_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  campaign_id UUID NOT NULL REFERENCES public.survey_campaigns(id),
  dimension_id UUID REFERENCES public.survey_dimensions(id),
  dimension_name TEXT NOT NULL,
  score NUMERIC NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'elevated_risk',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Enable RLS
ALTER TABLE public.risk_alerts ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "Tenant isolation for risk_alerts"
  ON public.risk_alerts
  FOR ALL
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
