CREATE OR REPLACE FUNCTION public.get_employee_metadata_by_token(_token text)
RETURNS TABLE(department_id uuid, org_unit_id uuid, job_role_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.department_id, d.org_unit_id, e.job_role_id
  FROM survey_invitations si
  JOIN employees e ON e.id = si.employee_id
  LEFT JOIN departments d ON d.id = e.department_id
  WHERE si.token = _token
  LIMIT 1
$$;