-- Atualiza RLS policies de platform_exports para incluir segundo super admin
DROP POLICY IF EXISTS "Super admin can read platform_exports" ON public.platform_exports;
DROP POLICY IF EXISTS "Super admin can insert platform_exports" ON public.platform_exports;
DROP POLICY IF EXISTS "Super admin can update platform_exports" ON public.platform_exports;

CREATE POLICY "Super admin can read platform_exports"
  ON public.platform_exports FOR SELECT TO authenticated
  USING (auth.uid() IN (
    '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid,
    '58b6321c-018b-4aa6-bf92-2aa373ed39a4'::uuid
  ));

CREATE POLICY "Super admin can insert platform_exports"
  ON public.platform_exports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (
    '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid,
    '58b6321c-018b-4aa6-bf92-2aa373ed39a4'::uuid
  ));

CREATE POLICY "Super admin can update platform_exports"
  ON public.platform_exports FOR UPDATE TO authenticated
  USING (auth.uid() IN (
    '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid,
    '58b6321c-018b-4aa6-bf92-2aa373ed39a4'::uuid
  ));

-- Atualiza storage policies do bucket platform-exports
DROP POLICY IF EXISTS "Super admin read platform-exports" ON storage.objects;
DROP POLICY IF EXISTS "Super admin write platform-exports" ON storage.objects;
DROP POLICY IF EXISTS "Super admin delete platform-exports" ON storage.objects;

CREATE POLICY "Super admin read platform-exports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'platform-exports' AND auth.uid() IN (
    '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid,
    '58b6321c-018b-4aa6-bf92-2aa373ed39a4'::uuid
  ));

CREATE POLICY "Super admin write platform-exports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'platform-exports' AND auth.uid() IN (
    '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid,
    '58b6321c-018b-4aa6-bf92-2aa373ed39a4'::uuid
  ));

CREATE POLICY "Super admin delete platform-exports"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'platform-exports' AND auth.uid() IN (
    '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid,
    '58b6321c-018b-4aa6-bf92-2aa373ed39a4'::uuid
  ));