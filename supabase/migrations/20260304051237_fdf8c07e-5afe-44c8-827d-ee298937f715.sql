
-- 1. Fix RLS: Recreate INSERT policies as PERMISSIVE for survey tables
DROP POLICY IF EXISTS "Insert consent anonymously" ON public.consent_records;
CREATE POLICY "Insert consent anonymously" ON public.consent_records
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Insert responses anonymously" ON public.survey_responses;
CREATE POLICY "Insert responses anonymously" ON public.survey_responses
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Insert answers anonymously" ON public.survey_answers;
CREATE POLICY "Insert answers anonymously" ON public.survey_answers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 2. Add user_agent column to consent_records
ALTER TABLE public.consent_records ADD COLUMN IF NOT EXISTS user_agent text;

-- 3. Clean up duplicate org_units (keep oldest)
DELETE FROM public.org_units a USING public.org_units b
WHERE a.tenant_id = b.tenant_id AND a.name = b.name AND a.created_at > b.created_at;

-- 4. Clean up duplicate departments
DELETE FROM public.departments a USING public.departments b
WHERE a.tenant_id = b.tenant_id AND a.name = b.name AND a.org_unit_id = b.org_unit_id AND a.created_at > b.created_at;

-- 5. Clean up duplicate job_roles
DELETE FROM public.job_roles a USING public.job_roles b
WHERE a.tenant_id = b.tenant_id AND a.name = b.name AND a.created_at > b.created_at;

-- 6. Add UNIQUE constraints
ALTER TABLE public.org_units ADD CONSTRAINT unique_org_unit_name_per_tenant UNIQUE (tenant_id, name);
ALTER TABLE public.departments ADD CONSTRAINT unique_dept_name_per_unit UNIQUE (tenant_id, name, org_unit_id);
ALTER TABLE public.job_roles ADD CONSTRAINT unique_job_role_name_per_tenant UNIQUE (tenant_id, name);
