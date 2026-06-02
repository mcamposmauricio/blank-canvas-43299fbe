
-- Patch handle_new_user: skip if a profile already exists for this user
-- (allows restoring real data before auth users without duplicate inserts).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id UUID;
BEGIN
  -- Restore-safe: if a profile already exists, do nothing.
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

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

-- Storage policies for the 3 restored buckets.
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
CREATE POLICY "logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos authenticated write" ON storage.objects;
CREATE POLICY "logos authenticated write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos authenticated update" ON storage.objects;
CREATE POLICY "logos authenticated update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos authenticated delete" ON storage.objects;
CREATE POLICY "logos authenticated delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "reports tenant read" ON storage.objects;
CREATE POLICY "reports tenant read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reports'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text);

DROP POLICY IF EXISTS "reports tenant write" ON storage.objects;
CREATE POLICY "reports tenant write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reports'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text);

DROP POLICY IF EXISTS "reports tenant update" ON storage.objects;
CREATE POLICY "reports tenant update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'reports'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text);

DROP POLICY IF EXISTS "reports tenant delete" ON storage.objects;
CREATE POLICY "reports tenant delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reports'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text);

DROP POLICY IF EXISTS "platform-exports super admin all" ON storage.objects;
CREATE POLICY "platform-exports super admin all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'platform-exports'
  AND auth.uid() = ANY (ARRAY[
    '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid,
    '58b6321c-018b-4aa6-bf92-2aa373ed39a4'::uuid
  ]))
WITH CHECK (bucket_id = 'platform-exports'
  AND auth.uid() = ANY (ARRAY[
    '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid,
    '58b6321c-018b-4aa6-bf92-2aa373ed39a4'::uuid
  ]));
