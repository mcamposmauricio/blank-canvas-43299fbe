
-- =============================================
-- PHASE 2: Organizational Structure
-- =============================================

-- Org Units (unidades organizacionais)
CREATE TABLE public.org_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.org_units(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;

-- Departments (áreas/departamentos)
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  org_unit_id UUID REFERENCES public.org_units(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Job Roles (cargos/funções)
CREATE TABLE public.job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;

-- Employees (colaboradores elegíveis — PII separado)
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  job_role_id UUID REFERENCES public.job_roles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHASE 3: Surveys & Campaigns
-- =============================================

-- Survey Templates
CREATE TABLE public.survey_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.survey_templates ENABLE ROW LEVEL SECURITY;

-- Survey Dimensions (dimensões psicossociais)
CREATE TABLE public.survey_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.survey_templates(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.survey_dimensions ENABLE ROW LEVEL SECURITY;

-- Survey Items (perguntas)
CREATE TABLE public.survey_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id UUID REFERENCES public.survey_dimensions(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  is_inverted BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.survey_items ENABLE ROW LEVEL SECURITY;

-- Campaign Status enum
CREATE TYPE public.campaign_status AS ENUM ('draft', 'active', 'closed', 'archived');

-- Survey Campaigns
CREATE TABLE public.survey_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.survey_templates(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status campaign_status NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  invite_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.survey_campaigns ENABLE ROW LEVEL SECURITY;

-- Survey Invitations (tokens únicos para acesso anônimo)
CREATE TABLE public.survey_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.survey_campaigns(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.survey_invitations ENABLE ROW LEVEL SECURITY;

-- Survey Responses (anônimas — sem vínculo com employee)
CREATE TABLE public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.survey_campaigns(id) ON DELETE CASCADE NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  org_unit_id UUID REFERENCES public.org_units(id) ON DELETE SET NULL,
  job_role_id UUID REFERENCES public.job_roles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- Survey Answers (respostas individuais)
CREATE TABLE public.survey_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES public.survey_responses(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.survey_items(id) ON DELETE CASCADE NOT NULL,
  value INTEGER NOT NULL CHECK (value >= 1 AND value <= 5)
);
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHASE 4: Scoring
-- =============================================

-- Response Scores (score por resposta por dimensão)
CREATE TABLE public.response_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES public.survey_responses(id) ON DELETE CASCADE NOT NULL,
  dimension_id UUID REFERENCES public.survey_dimensions(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  items_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(response_id, dimension_id)
);
ALTER TABLE public.response_scores ENABLE ROW LEVEL SECURITY;

-- Campaign Scores (aggregated scores per campaign per dimension)
CREATE TABLE public.campaign_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.survey_campaigns(id) ON DELETE CASCADE NOT NULL,
  dimension_id UUID REFERENCES public.survey_dimensions(id) ON DELETE CASCADE NOT NULL,
  avg_score NUMERIC(5,2) NOT NULL,
  min_score NUMERIC(5,2),
  max_score NUMERIC(5,2),
  std_dev NUMERIC(5,2),
  responses_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(campaign_id, dimension_id)
);
ALTER TABLE public.campaign_scores ENABLE ROW LEVEL SECURITY;

-- Group Scores (aggregated by org group)
CREATE TABLE public.group_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.survey_campaigns(id) ON DELETE CASCADE NOT NULL,
  dimension_id UUID REFERENCES public.survey_dimensions(id) ON DELETE CASCADE NOT NULL,
  group_type TEXT NOT NULL, -- 'department', 'org_unit', 'job_role'
  group_id UUID NOT NULL,
  avg_score NUMERIC(5,2) NOT NULL,
  responses_count INTEGER NOT NULL DEFAULT 0,
  is_suppressed BOOLEAN NOT NULL DEFAULT false -- true if N < min_group_size
);
ALTER TABLE public.group_scores ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHASE 6: Reports & Action Plans
-- =============================================

-- Action Plan Status enum
CREATE TYPE public.action_status AS ENUM ('pending', 'in_progress', 'completed');

-- Action Plans
CREATE TABLE public.action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.survey_campaigns(id) ON DELETE SET NULL,
  dimension_name TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status action_status NOT NULL DEFAULT 'pending',
  responsible TEXT,
  due_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.survey_campaigns(id) ON DELETE CASCADE NOT NULL,
  report_type TEXT NOT NULL, -- 'technical', 'executive'
  file_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHASE 7: Governance
-- =============================================

-- Audit Log
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Consent Records
CREATE TABLE public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.survey_campaigns(id) ON DELETE CASCADE NOT NULL,
  consent_text TEXT NOT NULL,
  consent_version INTEGER NOT NULL DEFAULT 1,
  ip_address TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies for ALL new tables
-- =============================================

-- Org Units
CREATE POLICY "Tenant isolation for org_units" ON public.org_units
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Departments
CREATE POLICY "Tenant isolation for departments" ON public.departments
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Job Roles
CREATE POLICY "Tenant isolation for job_roles" ON public.job_roles
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Employees
CREATE POLICY "Tenant isolation for employees" ON public.employees
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Survey Templates
CREATE POLICY "Tenant isolation for survey_templates" ON public.survey_templates
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Survey Dimensions (via template tenant)
CREATE POLICY "Access survey_dimensions via template" ON public.survey_dimensions
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.survey_templates st 
  WHERE st.id = template_id AND st.tenant_id = public.get_user_tenant_id(auth.uid())
));

-- Survey Items (via dimension -> template tenant)
CREATE POLICY "Access survey_items via template" ON public.survey_items
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.survey_dimensions sd
  JOIN public.survey_templates st ON st.id = sd.template_id
  WHERE sd.id = dimension_id AND st.tenant_id = public.get_user_tenant_id(auth.uid())
));

-- Survey Campaigns
CREATE POLICY "Tenant isolation for survey_campaigns" ON public.survey_campaigns
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Survey Invitations (via campaign tenant) — admin only for management
CREATE POLICY "Access invitations via campaign" ON public.survey_invitations
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.survey_campaigns sc
  WHERE sc.id = campaign_id AND sc.tenant_id = public.get_user_tenant_id(auth.uid())
));

-- Allow anonymous access to invitations by token for survey runtime
CREATE POLICY "Public access to invitations by token" ON public.survey_invitations
FOR SELECT TO anon
USING (true);

-- Survey Responses — anonymous insert allowed, tenant read via campaign
CREATE POLICY "Insert responses anonymously" ON public.survey_responses
FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "Tenant read responses" ON public.survey_responses
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.survey_campaigns sc
  WHERE sc.id = campaign_id AND sc.tenant_id = public.get_user_tenant_id(auth.uid())
));

-- Survey Answers — anonymous insert, tenant read
CREATE POLICY "Insert answers anonymously" ON public.survey_answers
FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "Tenant read answers" ON public.survey_answers
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.survey_responses sr
  JOIN public.survey_campaigns sc ON sc.id = sr.campaign_id
  WHERE sr.id = response_id AND sc.tenant_id = public.get_user_tenant_id(auth.uid())
));

-- Response Scores
CREATE POLICY "Tenant read response_scores" ON public.response_scores
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.survey_responses sr
  JOIN public.survey_campaigns sc ON sc.id = sr.campaign_id
  WHERE sr.id = response_id AND sc.tenant_id = public.get_user_tenant_id(auth.uid())
));

-- Campaign Scores
CREATE POLICY "Tenant read campaign_scores" ON public.campaign_scores
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.survey_campaigns sc
  WHERE sc.id = campaign_id AND sc.tenant_id = public.get_user_tenant_id(auth.uid())
));

-- Group Scores
CREATE POLICY "Tenant read group_scores" ON public.group_scores
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.survey_campaigns sc
  WHERE sc.id = campaign_id AND sc.tenant_id = public.get_user_tenant_id(auth.uid())
));

-- Action Plans
CREATE POLICY "Tenant isolation for action_plans" ON public.action_plans
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Reports
CREATE POLICY "Tenant isolation for reports" ON public.reports
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Audit Logs
CREATE POLICY "Tenant isolation for audit_logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Insert audit_logs" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Consent Records — anonymous insert, tenant read
CREATE POLICY "Insert consent anonymously" ON public.consent_records
FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "Tenant read consent_records" ON public.consent_records
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.survey_campaigns sc
  WHERE sc.id = campaign_id AND sc.tenant_id = public.get_user_tenant_id(auth.uid())
));

-- Updated_at triggers for new tables
CREATE TRIGGER update_org_units_updated_at BEFORE UPDATE ON public.org_units
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_survey_templates_updated_at BEFORE UPDATE ON public.survey_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_survey_campaigns_updated_at BEFORE UPDATE ON public.survey_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_action_plans_updated_at BEFORE UPDATE ON public.action_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
