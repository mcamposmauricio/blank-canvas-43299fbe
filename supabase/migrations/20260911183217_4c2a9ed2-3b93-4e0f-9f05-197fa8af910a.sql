CREATE TABLE public.system_settings (
  id text PRIMARY KEY,
  is_locked boolean NOT NULL DEFAULT false,
  lock_message text NOT NULL DEFAULT 'Encontramos um erro. Contato o suporte.',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT ALL ON public.system_settings TO service_role;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System availability is publicly readable"
ON public.system_settings
FOR SELECT
TO anon, authenticated
USING (id = 'global');

CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.system_settings (id, is_locked, lock_message)
VALUES ('global', true, 'Encontramos um erro. Contato o suporte.');