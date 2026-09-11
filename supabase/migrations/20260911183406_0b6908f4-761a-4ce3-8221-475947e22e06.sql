DROP POLICY "Insert consent anonymously" ON public.consent_records;
CREATE POLICY "Insert consent only while system is available"
ON public.consent_records
FOR INSERT
TO anon, authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.system_settings
  WHERE id = 'global' AND is_locked = false
));

DROP POLICY "Insert answers anonymously" ON public.survey_answers;
CREATE POLICY "Insert answers only while system is available"
ON public.survey_answers
FOR INSERT
TO anon, authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.system_settings
  WHERE id = 'global' AND is_locked = false
));

DROP POLICY "Insert responses anonymously" ON public.survey_responses;
CREATE POLICY "Insert responses only while system is available"
ON public.survey_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.system_settings
  WHERE id = 'global' AND is_locked = false
));

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
    AND EXISTS (
      SELECT 1 FROM system_settings
      WHERE id = 'global' AND is_locked = false
    )
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_survey_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inv record;
  v_camp record;
  v_tenant record;
  v_dims jsonb;
  v_items jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM system_settings
    WHERE id = 'global' AND is_locked = true
  ) THEN
    RETURN NULL;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.mark_invitation_used(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM system_settings
    WHERE id = 'global' AND is_locked = true
  ) THEN
    RETURN false;
  END IF;

  UPDATE survey_invitations
  SET is_used = true, used_at = now()
  WHERE token = _token AND is_used = false
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$function$;