-- Restore MarQ HR schema from introspection
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE TYPE public.action_status AS ENUM ('pending','in_progress','completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin_rh','gestor','diretoria','auditoria'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.campaign_status AS ENUM ('draft','active','closed','archived','scheduled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE public.action_plans (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "campaign_id" uuid,
  "dimension_name" text,
  "department_id" uuid,
  "title" text NOT NULL,
  "description" text,
  "status" action_status DEFAULT 'pending'::action_status NOT NULL,
  "responsible" text,
  "due_date" date,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plans TO authenticated;
GRANT ALL ON public.action_plans TO service_role;
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.audit_logs (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "details" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.campaign_scores (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL,
  "dimension_id" uuid NOT NULL,
  "avg_score" numeric(5,2) NOT NULL,
  "min_score" numeric(5,2),
  "max_score" numeric(5,2),
  "std_dev" numeric(5,2),
  "responses_count" integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_scores TO authenticated;
GRANT ALL ON public.campaign_scores TO service_role;
ALTER TABLE public.campaign_scores ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.consent_records (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL,
  "consent_text" text NOT NULL,
  "consent_version" integer DEFAULT 1 NOT NULL,
  "ip_address" text,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_agent" text,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.departments (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "org_unit_id" uuid NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.employees (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "department_id" uuid,
  "job_role_id" uuid,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.group_scores (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL,
  "dimension_id" uuid NOT NULL,
  "group_type" text NOT NULL,
  "group_id" uuid NOT NULL,
  "avg_score" numeric(5,2) NOT NULL,
  "responses_count" integer DEFAULT 0 NOT NULL,
  "is_suppressed" boolean DEFAULT false NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_scores TO authenticated;
GRANT ALL ON public.group_scores TO service_role;
ALTER TABLE public.group_scores ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.job_roles (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_roles TO authenticated;
GRANT ALL ON public.job_roles TO service_role;
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.org_units (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "parent_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_units TO authenticated;
GRANT ALL ON public.org_units TO service_role;
ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.platform_exports (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL,
  "file_path" text,
  "file_size_bytes" bigint,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "error" text,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_exports TO authenticated;
GRANT ALL ON public.platform_exports TO service_role;
ALTER TABLE public.platform_exports ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.profiles (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "full_name" text,
  "email" text,
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "department_id" uuid,
  "must_change_password" boolean DEFAULT false NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.reports (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "report_type" text NOT NULL,
  "file_url" text,
  "version" integer DEFAULT 1 NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "generated_by" uuid,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.response_scores (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "response_id" uuid NOT NULL,
  "dimension_id" uuid NOT NULL,
  "score" numeric(5,2) NOT NULL,
  "items_count" integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.response_scores TO authenticated;
GRANT ALL ON public.response_scores TO service_role;
ALTER TABLE public.response_scores ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.risk_alerts (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "dimension_id" uuid,
  "dimension_name" text NOT NULL,
  "score" numeric NOT NULL,
  "alert_type" text DEFAULT 'elevated_risk'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_alerts TO authenticated;
GRANT ALL ON public.risk_alerts TO service_role;
ALTER TABLE public.risk_alerts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.survey_answers (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "response_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "value" integer NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_answers TO authenticated;
GRANT ALL ON public.survey_answers TO service_role;
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.survey_campaigns (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "template_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" campaign_status DEFAULT 'draft'::campaign_status NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "invite_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_campaigns TO authenticated;
GRANT ALL ON public.survey_campaigns TO service_role;
ALTER TABLE public.survey_campaigns ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.survey_dimensions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_dimensions TO authenticated;
GRANT ALL ON public.survey_dimensions TO service_role;
ALTER TABLE public.survey_dimensions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.survey_invitations (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "token" text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
  "is_used" boolean DEFAULT false NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_invitations TO authenticated;
GRANT ALL ON public.survey_invitations TO service_role;
ALTER TABLE public.survey_invitations ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.survey_items (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "dimension_id" uuid NOT NULL,
  "text" text NOT NULL,
  "is_inverted" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_items TO authenticated;
GRANT ALL ON public.survey_items TO service_role;
ALTER TABLE public.survey_items ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.survey_responses (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL,
  "department_id" uuid,
  "org_unit_id" uuid,
  "job_role_id" uuid,
  "completed_at" timestamp with time zone,
  "is_complete" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.survey_templates (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "version" integer DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_global" boolean DEFAULT false NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_templates TO authenticated;
GRANT ALL ON public.survey_templates TO service_role;
ALTER TABLE public.survey_templates ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.tenants (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo_url" text,
  "primary_color" text DEFAULT '#1e3a5f'::text,
  "secondary_color" text DEFAULT '#64748b'::text,
  "min_group_size" integer DEFAULT 7 NOT NULL,
  "data_retention_days" integer DEFAULT 1825,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.user_roles (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "role" app_role NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ADD FOREIGN KEY ("tenant_id") REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD FOREIGN KEY ("department_id") REFERENCES public.departments(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD FOREIGN KEY ("tenant_id") REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.org_units ADD FOREIGN KEY ("tenant_id") REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.departments ADD FOREIGN KEY ("tenant_id") REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.departments ADD FOREIGN KEY ("org_unit_id") REFERENCES public.org_units(id) ON DELETE CASCADE;
ALTER TABLE public.job_roles ADD FOREIGN KEY ("tenant_id") REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.employees ADD FOREIGN KEY ("tenant_id") REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.employees ADD FOREIGN KEY ("department_id") REFERENCES public.departments(id) ON DELETE CASCADE;
ALTER TABLE public.employees ADD FOREIGN KEY ("job_role_id") REFERENCES public.job_roles(id) ON DELETE CASCADE;
ALTER TABLE public.survey_templates ADD FOREIGN KEY ("tenant_id") REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.survey_dimensions ADD FOREIGN KEY ("template_id") REFERENCES public.survey_templates(id) ON DELETE CASCADE;
ALTER TABLE public.survey_items ADD FOREIGN KEY ("dimension_id") REFERENCES public.survey_dimensions(id) ON DELETE CASCADE;
ALTER TABLE public.survey_campaigns ADD FOREIGN KEY ("tenant_id") REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.survey_campaigns ADD FOREIGN KEY ("template_id") REFERENCES public.survey_templates(id) ON DELETE CASCADE;
ALTER TABLE public.survey_invitations ADD FOREIGN KEY ("campaign_id") REFERENCES public.survey_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.survey_invitations ADD FOREIGN KEY ("employee_id") REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.survey_responses ADD FOREIGN KEY ("campaign_id") REFERENCES public.survey_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.survey_answers ADD FOREIGN KEY ("response_id") REFERENCES public.survey_responses(id) ON DELETE CASCADE;
ALTER TABLE public.survey_answers ADD FOREIGN KEY ("item_id") REFERENCES public.survey_items(id) ON DELETE CASCADE;
ALTER TABLE public.response_scores ADD FOREIGN KEY ("response_id") REFERENCES public.survey_responses(id) ON DELETE CASCADE;
ALTER TABLE public.response_scores ADD FOREIGN KEY ("dimension_id") REFERENCES public.survey_dimensions(id) ON DELETE CASCADE;
ALTER TABLE public.campaign_scores ADD FOREIGN KEY ("campaign_id") REFERENCES public.survey_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.campaign_scores ADD FOREIGN KEY ("dimension_id") REFERENCES public.survey_dimensions(id) ON DELETE CASCADE;
ALTER TABLE public.group_scores ADD FOREIGN KEY ("campaign_id") REFERENCES public.survey_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.group_scores ADD FOREIGN KEY ("dimension_id") REFERENCES public.survey_dimensions(id) ON DELETE CASCADE;
ALTER TABLE public.risk_alerts ADD FOREIGN KEY ("tenant_id") REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.risk_alerts ADD FOREIGN KEY ("campaign_id") REFERENCES public.survey_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.risk_alerts ADD FOREIGN KEY ("dimension_id") REFERENCES public.survey_dimensions(id) ON DELETE CASCADE;
ALTER TABLE public.action_plans ADD FOREIGN KEY ("tenant_id") REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.action_plans ADD FOREIGN KEY ("campaign_id") REFERENCES public.survey_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.action_plans ADD FOREIGN KEY ("department_id") REFERENCES public.departments(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD FOREIGN KEY ("tenant_id") REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD FOREIGN KEY ("campaign_id") REFERENCES public.survey_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD FOREIGN KEY ("tenant_id") REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_department_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT department_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$function$;
CREATE OR REPLACE FUNCTION public.get_employee_metadata_by_token(_token text)
 RETURNS TABLE(department_id uuid, org_unit_id uuid, job_role_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.department_id, d.org_unit_id, e.job_role_id
  FROM survey_invitations si
  JOIN employees e ON e.id = si.employee_id
  LEFT JOIN departments d ON d.id = e.department_id
  WHERE si.token = _token
  LIMIT 1
$function$;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tenant_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$function$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id UUID;
BEGIN
  _tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;

  IF _tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa'),
      COALESCE(NEW.raw_user_meta_data->>'company_slug', 'tenant-' || substr(NEW.id::text, 1, 8))
    )
    RETURNING id INTO _tenant_id;
  END IF;

  INSERT INTO public.profiles (user_id, tenant_id, email, full_name)
  VALUES (NEW.id, _tenant_id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, _tenant_id, 'admin_rh');

  RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;
CREATE OR REPLACE FUNCTION public.export_dump_schema()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'enums', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', t.typname,
        'values', (SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
                   FROM pg_enum e WHERE e.enumtypid = t.oid)
      ) ORDER BY t.typname), '[]'::jsonb)
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype = 'e'
    ),
    'tables', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', c.relname,
        'columns', (
          SELECT jsonb_agg(jsonb_build_object(
            'name', a.attname,
            'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
            'not_null', a.attnotnull,
            'default', pg_get_expr(d.adbin, d.adrelid)
          ) ORDER BY a.attnum)
          FROM pg_attribute a
          LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        ),
        'rls_enabled', c.relrowsecurity
      ) ORDER BY c.relname), '[]'::jsonb)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    ),
    'policies', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'table', tablename,
        'policy', policyname,
        'cmd', cmd,
        'roles', roles,
        'qual', qual,
        'with_check', with_check,
        'permissive', permissive
      )), '[]'::jsonb)
      FROM pg_policies WHERE schemaname = 'public'
    ),
    'functions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', p.proname,
        'definition', pg_get_functiondef(p.oid)
      )), '[]'::jsonb)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
    ),
    'triggers', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', t.tgname,
        'table', c.relname,
        'definition', pg_get_triggerdef(t.oid)
      )), '[]'::jsonb)
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
    )
  ) INTO result;
  RETURN result;
END;
$function$;
CREATE OR REPLACE FUNCTION public.export_list_public_tables()
 RETURNS TABLE(table_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT c.relname::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.relname;
$function$;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_org_units_updated_at BEFORE UPDATE ON public.org_units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_survey_templates_updated_at BEFORE UPDATE ON public.survey_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_survey_campaigns_updated_at BEFORE UPDATE ON public.survey_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_action_plans_updated_at BEFORE UPDATE ON public.action_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE POLICY "Users can view their own tenant" ON public.tenants AS PERMISSIVE FOR SELECT TO authenticated USING ((id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Admin RH can update their tenant" ON public.tenants AS PERMISSIVE FOR UPDATE TO authenticated USING (((id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'admin_rh'::app_role)));
CREATE POLICY "Users can view profiles in their tenant" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can update their own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert their own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view roles in their tenant" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Admin RH can manage roles in their tenant" ON public.user_roles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'admin_rh'::app_role)));
CREATE POLICY "Admin RH can delete roles in their tenant" ON public.user_roles AS PERMISSIVE FOR DELETE TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'admin_rh'::app_role)));
CREATE POLICY "Tenant isolation for org_units" ON public.org_units AS PERMISSIVE FOR ALL TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid()))) WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Tenant isolation for departments" ON public.departments AS PERMISSIVE FOR ALL TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid()))) WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Tenant isolation for job_roles" ON public.job_roles AS PERMISSIVE FOR ALL TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid()))) WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Tenant isolation for employees" ON public.employees AS PERMISSIVE FOR ALL TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid()))) WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Tenant isolation for survey_templates" ON public.survey_templates AS PERMISSIVE FOR ALL TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid()))) WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Access survey_dimensions via template" ON public.survey_dimensions AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM survey_templates st
  WHERE ((st.id = survey_dimensions.template_id) AND (st.tenant_id = get_user_tenant_id(auth.uid()))))));
CREATE POLICY "Access survey_items via template" ON public.survey_items AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM (survey_dimensions sd
     JOIN survey_templates st ON ((st.id = sd.template_id)))
  WHERE ((sd.id = survey_items.dimension_id) AND (st.tenant_id = get_user_tenant_id(auth.uid()))))));
CREATE POLICY "Tenant isolation for survey_campaigns" ON public.survey_campaigns AS PERMISSIVE FOR ALL TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid()))) WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Access invitations via campaign" ON public.survey_invitations AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM survey_campaigns sc
  WHERE ((sc.id = survey_invitations.campaign_id) AND (sc.tenant_id = get_user_tenant_id(auth.uid()))))));
CREATE POLICY "Tenant read responses" ON public.survey_responses AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM survey_campaigns sc
  WHERE ((sc.id = survey_responses.campaign_id) AND (sc.tenant_id = get_user_tenant_id(auth.uid()))))));
CREATE POLICY "Tenant isolation for reports" ON public.reports AS PERMISSIVE FOR ALL TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid()))) WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Tenant read answers" ON public.survey_answers AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (survey_responses sr
     JOIN survey_campaigns sc ON ((sc.id = sr.campaign_id)))
  WHERE ((sr.id = survey_answers.response_id) AND (sc.tenant_id = get_user_tenant_id(auth.uid()))))));
CREATE POLICY "Tenant read response_scores" ON public.response_scores AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (survey_responses sr
     JOIN survey_campaigns sc ON ((sc.id = sr.campaign_id)))
  WHERE ((sr.id = response_scores.response_id) AND (sc.tenant_id = get_user_tenant_id(auth.uid()))))));
CREATE POLICY "Tenant read campaign_scores" ON public.campaign_scores AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM survey_campaigns sc
  WHERE ((sc.id = campaign_scores.campaign_id) AND (sc.tenant_id = get_user_tenant_id(auth.uid()))))));
CREATE POLICY "Tenant isolation for audit_logs" ON public.audit_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Insert audit_logs" ON public.audit_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Tenant read consent_records" ON public.consent_records AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM survey_campaigns sc
  WHERE ((sc.id = consent_records.campaign_id) AND (sc.tenant_id = get_user_tenant_id(auth.uid()))))));
CREATE POLICY "Anonymous can mark invitation as used" ON public.survey_invitations AS PERMISSIVE FOR UPDATE TO public USING (true) WITH CHECK ((is_used = true));
CREATE POLICY "Tenant isolation for risk_alerts" ON public.risk_alerts AS PERMISSIVE FOR ALL TO public USING ((tenant_id = get_user_tenant_id(auth.uid()))) WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Public read tenant branding" ON public.tenants AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "Tenant isolation for action_plans" ON public.action_plans AS PERMISSIVE FOR ALL TO public USING (((tenant_id = get_user_tenant_id(auth.uid())) AND ((NOT has_role(auth.uid(), 'gestor'::app_role)) OR (department_id = get_user_department_id(auth.uid()))))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) AND ((NOT has_role(auth.uid(), 'gestor'::app_role)) OR (department_id = get_user_department_id(auth.uid())))));
CREATE POLICY "Tenant read group_scores" ON public.group_scores AS PERMISSIVE FOR SELECT TO public USING (((EXISTS ( SELECT 1
   FROM survey_campaigns sc
  WHERE ((sc.id = group_scores.campaign_id) AND (sc.tenant_id = get_user_tenant_id(auth.uid()))))) AND ((NOT has_role(auth.uid(), 'gestor'::app_role)) OR ((group_type = 'department'::text) AND (group_id = get_user_department_id(auth.uid()))))));
CREATE POLICY "Admin RH can update profiles in tenant" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'admin_rh'::app_role))) WITH CHECK (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'admin_rh'::app_role)));
CREATE POLICY "Admin RH can delete profiles in tenant" ON public.profiles AS PERMISSIVE FOR DELETE TO authenticated USING (((tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'admin_rh'::app_role)));
CREATE POLICY "Insert consent anonymously" ON public.consent_records AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Insert responses anonymously" ON public.survey_responses AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Insert answers anonymously" ON public.survey_answers AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public access to invitations by token" ON public.survey_invitations AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read campaigns via invitation" ON public.survey_campaigns AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read survey templates" ON public.survey_templates AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read survey dimensions" ON public.survey_dimensions AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read survey items" ON public.survey_items AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Super admin can read platform_exports" ON public.platform_exports AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = ANY (ARRAY['302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid, '58b6321c-018b-4aa6-bf92-2aa373ed39a4'::uuid])));
CREATE POLICY "Super admin can insert platform_exports" ON public.platform_exports AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = ANY (ARRAY['302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid, '58b6321c-018b-4aa6-bf92-2aa373ed39a4'::uuid])));
CREATE POLICY "Super admin can update platform_exports" ON public.platform_exports AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = ANY (ARRAY['302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid, '58b6321c-018b-4aa6-bf92-2aa373ed39a4'::uuid])));
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT, UPDATE ON public.survey_invitations TO anon;
GRANT SELECT ON public.survey_campaigns TO anon;
GRANT SELECT ON public.survey_templates TO anon;
GRANT SELECT ON public.survey_dimensions TO anon;
GRANT SELECT ON public.survey_items TO anon;
GRANT INSERT ON public.consent_records TO anon;
GRANT INSERT ON public.survey_responses TO anon;
GRANT INSERT ON public.survey_answers TO anon;