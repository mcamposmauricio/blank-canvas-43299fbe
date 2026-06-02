
-- Add department_id to profiles for gestor filtering
ALTER TABLE public.profiles
  ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- Helper function to get user's department_id
CREATE OR REPLACE FUNCTION public.get_user_department_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Update action_plans RLS: gestor can only see/manage plans for their department
-- First drop the existing policy
DROP POLICY IF EXISTS "Tenant isolation for action_plans" ON public.action_plans;

-- Recreate: admin_rh/diretoria/auditoria see all in tenant; gestor sees only their department
CREATE POLICY "Tenant isolation for action_plans"
ON public.action_plans
FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    NOT has_role(auth.uid(), 'gestor'::app_role)
    OR department_id = get_user_department_id(auth.uid())
  )
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    NOT has_role(auth.uid(), 'gestor'::app_role)
    OR department_id = get_user_department_id(auth.uid())
  )
);

-- Update group_scores RLS: gestor can only see scores for their department
DROP POLICY IF EXISTS "Tenant read group_scores" ON public.group_scores;

CREATE POLICY "Tenant read group_scores"
ON public.group_scores
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM survey_campaigns sc
    WHERE sc.id = group_scores.campaign_id
      AND sc.tenant_id = get_user_tenant_id(auth.uid())
  )
  AND (
    NOT has_role(auth.uid(), 'gestor'::app_role)
    OR (group_type = 'department' AND group_id = get_user_department_id(auth.uid()))
  )
);
