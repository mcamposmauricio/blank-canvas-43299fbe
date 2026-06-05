
-- 1. Reinstalar trigger em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill: para cada auth.users sem profile, criar tenant + profile + user_role
DO $$
DECLARE
  u record;
  v_tenant_id uuid;
  v_slug text;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE p.user_id IS NULL
  LOOP
    v_tenant_id := (u.raw_user_meta_data->>'tenant_id')::uuid;

    IF v_tenant_id IS NULL THEN
      v_slug := COALESCE(u.raw_user_meta_data->>'company_slug', 'tenant-' || substr(u.id::text, 1, 8));
      -- Garante slug único
      WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) LOOP
        v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
      END LOOP;

      INSERT INTO public.tenants (name, slug)
      VALUES (
        COALESCE(u.raw_user_meta_data->>'company_name', 'Minha Empresa'),
        v_slug
      )
      RETURNING id INTO v_tenant_id;
    END IF;

    INSERT INTO public.profiles (user_id, tenant_id, email, full_name)
    VALUES (
      u.id,
      v_tenant_id,
      u.email,
      COALESCE(u.raw_user_meta_data->>'full_name', '')
    );

    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (u.id, v_tenant_id, 'admin_rh')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
