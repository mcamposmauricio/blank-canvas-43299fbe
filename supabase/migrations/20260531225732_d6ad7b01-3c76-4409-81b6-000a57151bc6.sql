-- Tabela de histórico de exportações de plataforma
CREATE TABLE public.platform_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  file_path text,
  file_size_bytes bigint,
  status text NOT NULL DEFAULT 'pending',
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text
);

GRANT SELECT, INSERT, UPDATE ON public.platform_exports TO authenticated;
GRANT ALL ON public.platform_exports TO service_role;

ALTER TABLE public.platform_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read platform_exports"
ON public.platform_exports FOR SELECT TO authenticated
USING (auth.uid() = '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid);

CREATE POLICY "Super admin can insert platform_exports"
ON public.platform_exports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid);

CREATE POLICY "Super admin can update platform_exports"
ON public.platform_exports FOR UPDATE TO authenticated
USING (auth.uid() = '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid);

-- Bucket privado para os zips
INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-exports', 'platform-exports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Super admin read platform-exports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'platform-exports' AND auth.uid() = '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid);

CREATE POLICY "Super admin write platform-exports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'platform-exports' AND auth.uid() = '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid);

CREATE POLICY "Super admin delete platform-exports"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'platform-exports' AND auth.uid() = '302dc367-1b53-4a47-af5e-d54a6b877e59'::uuid);