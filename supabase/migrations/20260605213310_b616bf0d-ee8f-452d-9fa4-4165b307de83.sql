
-- a) GRANTs faltantes
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_units   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_roles   TO authenticated;
GRANT ALL ON public.org_units   TO service_role;
GRANT ALL ON public.departments TO service_role;
GRANT ALL ON public.job_roles   TO service_role;

-- b) Função idempotente de semente
CREATE OR REPLACE FUNCTION public.seed_default_org_structure(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_id uuid;
  v_dept_exists boolean;
BEGIN
  -- Org unit "Matriz"
  SELECT id INTO v_unit_id
  FROM public.org_units
  WHERE tenant_id = _tenant_id AND lower(name) = 'matriz'
  LIMIT 1;

  IF v_unit_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.org_units WHERE tenant_id = _tenant_id) THEN
    INSERT INTO public.org_units (tenant_id, name)
    VALUES (_tenant_id, 'Matriz')
    RETURNING id INTO v_unit_id;
  END IF;

  -- Department "Geral"
  IF v_unit_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.departments
      WHERE tenant_id = _tenant_id AND org_unit_id = v_unit_id AND lower(name) = 'geral'
    ) INTO v_dept_exists;

    IF NOT v_dept_exists AND NOT EXISTS (SELECT 1 FROM public.departments WHERE tenant_id = _tenant_id) THEN
      INSERT INTO public.departments (tenant_id, org_unit_id, name)
      VALUES (_tenant_id, v_unit_id, 'Geral');
    END IF;
  END IF;

  -- Job role "Colaborador"
  IF NOT EXISTS (SELECT 1 FROM public.job_roles WHERE tenant_id = _tenant_id) THEN
    INSERT INTO public.job_roles (tenant_id, name)
    VALUES (_tenant_id, 'Colaborador');
  END IF;
END;
$$;

-- Trigger em tenants
CREATE OR REPLACE FUNCTION public.handle_new_tenant_seed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_org_structure(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_org_structure ON public.tenants;
CREATE TRIGGER trg_seed_default_org_structure
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant_seed();

-- c) Backfill para tenants existentes
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_org_structure(t.id);
  END LOOP;
END $$;
