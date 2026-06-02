-- Funções SECURITY DEFINER para introspecção do schema usadas pela exportação completa
-- Restritas: só podem ser chamadas pelo service_role (edge function)

CREATE OR REPLACE FUNCTION public.export_list_public_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT c.relname::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.relname;
$$;

CREATE OR REPLACE FUNCTION public.export_dump_schema()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'enums', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', t.typname,
        'values', (SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
                   FROM pg_enum e WHERE e.enumtypid = t.oid)
      ) ORDER BY t.typname), '[]'::jsonb)
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype = 'e'
    ),
    'tables', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', c.relname,
        'columns', (
          SELECT jsonb_agg(jsonb_build_object(
            'name', a.attname,
            'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
            'not_null', a.attnotnull,
            'default', pg_get_expr(d.adbin, d.adrelid)
          ) ORDER BY a.attnum)
          FROM pg_attribute a
          LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        ),
        'rls_enabled', c.relrowsecurity
      ) ORDER BY c.relname), '[]'::jsonb)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    ),
    'policies', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'table', tablename,
        'policy', policyname,
        'cmd', cmd,
        'roles', roles,
        'qual', qual,
        'with_check', with_check,
        'permissive', permissive
      )), '[]'::jsonb)
      FROM pg_policies WHERE schemaname = 'public'
    ),
    'functions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', p.proname,
        'definition', pg_get_functiondef(p.oid)
      )), '[]'::jsonb)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
    ),
    'triggers', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', t.tgname,
        'table', c.relname,
        'definition', pg_get_triggerdef(t.oid)
      )), '[]'::jsonb)
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
    )
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.export_list_public_tables() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.export_dump_schema() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_list_public_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.export_dump_schema() TO service_role;