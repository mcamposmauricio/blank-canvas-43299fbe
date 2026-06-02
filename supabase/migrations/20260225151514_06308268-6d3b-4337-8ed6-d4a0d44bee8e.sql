CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;