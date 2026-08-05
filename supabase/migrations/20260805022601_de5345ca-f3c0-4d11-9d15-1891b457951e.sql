-- 1) Secure RPC: load everything the anonymous survey runtime needs, scoped to one token
CREATE OR REPLACE FUNCTION public.get_survey_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_camp record;
  v_tenant record;
  v_dims jsonb;
  v_items jsonb;
BEGIN
  SELECT id, campaign_id, is_used FROM survey_invitations WHERE token = _token INTO v_inv;
  IF v_inv.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, tenant_id, template_id, name, description, status, starts_at, ends_at
  FROM survey_campaigns WHERE id = v_inv.campaign_id INTO v_camp;

  SELECT name, logo_url, primary_color, secondary_color
  FROM tenants WHERE id = v_camp.tenant_id INTO v_tenant;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'sort_order', d.sort_order) ORDER BY d.sort_order), '[]'::jsonb)
  FROM survey_dimensions d WHERE d.template_id = v_camp.template_id INTO v_dims;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id, 'dimension_id', i.dimension_id, 'text', i.text,
    'is_inverted', i.is_inverted, 'sort_order', i.sort_order, 'item_number', i.item_number
  ) ORDER BY i.sort_order), '[]'::jsonb)
  FROM survey_items i
  JOIN survey_dimensions d ON d.id = i.dimension_id
  WHERE d.template_id = v_camp.template_id INTO v_items;

  RETURN jsonb_build_object(
    'invitation', jsonb_build_object('id', v_inv.id, 'campaign_id', v_inv.campaign_id, 'is_used', v_inv.is_used),
    'campaign', to_jsonb(v_camp),
    'tenant', to_jsonb(v_tenant),
    'dimensions', v_dims,
    'items', v_items
  );
END;
$$;

-- 2) Secure RPC: consume the invitation tied to the presented token only
CREATE OR REPLACE FUNCTION public.mark_invitation_used(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE survey_invitations
  SET is_used = true, used_at = now()
  WHERE token = _token AND is_used = false
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_survey_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_invitation_used(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_survey_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invitation_used(text) TO anon, authenticated;

-- 3) Remove the wide-open public read/update policies
DROP POLICY IF EXISTS "Public access to invitations by token" ON public.survey_invitations;
DROP POLICY IF EXISTS "Anonymous can mark invitation as used" ON public.survey_invitations;
DROP POLICY IF EXISTS "Public read campaigns via invitation" ON public.survey_campaigns;
DROP POLICY IF EXISTS "Public read survey templates" ON public.survey_templates;
DROP POLICY IF EXISTS "Public read survey dimensions" ON public.survey_dimensions;
DROP POLICY IF EXISTS "Public read survey items" ON public.survey_items;
DROP POLICY IF EXISTS "Public read tenant branding" ON public.tenants;

REVOKE SELECT ON public.survey_invitations FROM anon;
REVOKE UPDATE ON public.survey_invitations FROM anon;
REVOKE SELECT ON public.survey_campaigns FROM anon;
REVOKE SELECT ON public.survey_templates FROM anon;
REVOKE SELECT ON public.survey_dimensions FROM anon;
REVOKE SELECT ON public.survey_items FROM anon;
REVOKE SELECT ON public.tenants FROM anon;

-- 4) Global templates must stay readable by authenticated users of any tenant
DROP POLICY IF EXISTS "Read global templates" ON public.survey_templates;
CREATE POLICY "Read global templates" ON public.survey_templates
FOR SELECT TO authenticated
USING (is_global = true OR tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Read dimensions of accessible templates" ON public.survey_dimensions;
CREATE POLICY "Read dimensions of accessible templates" ON public.survey_dimensions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM survey_templates st
  WHERE st.id = survey_dimensions.template_id
    AND (st.is_global = true OR st.tenant_id = get_user_tenant_id(auth.uid()))
));

DROP POLICY IF EXISTS "Read items of accessible templates" ON public.survey_items;
CREATE POLICY "Read items of accessible templates" ON public.survey_items
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM survey_dimensions sd
  JOIN survey_templates st ON st.id = sd.template_id
  WHERE sd.id = survey_items.dimension_id
    AND (st.is_global = true OR st.tenant_id = get_user_tenant_id(auth.uid()))
));

-- 5) Scope tenant-isolation policies to authenticated only
DROP POLICY IF EXISTS "Tenant isolation for action_plans" ON public.action_plans;
CREATE POLICY "Tenant isolation for action_plans" ON public.action_plans
FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for risk_alerts" ON public.risk_alerts;
CREATE POLICY "Tenant isolation for risk_alerts" ON public.risk_alerts
FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant read group_scores" ON public.group_scores;
CREATE POLICY "Tenant read group_scores" ON public.group_scores
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM survey_campaigns sc
  WHERE sc.id = group_scores.campaign_id
    AND sc.tenant_id = get_user_tenant_id(auth.uid())
));