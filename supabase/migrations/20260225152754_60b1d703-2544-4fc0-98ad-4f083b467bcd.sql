
-- 1) Restrict public read policies to anon only

-- survey_campaigns
DROP POLICY IF EXISTS "Public read campaigns via invitation" ON public.survey_campaigns;
CREATE POLICY "Public read campaigns via invitation"
  ON public.survey_campaigns
  FOR SELECT
  TO anon
  USING (true);

-- survey_templates
DROP POLICY IF EXISTS "Public read survey templates" ON public.survey_templates;
CREATE POLICY "Public read survey templates"
  ON public.survey_templates
  FOR SELECT
  TO anon
  USING (true);

-- survey_dimensions
DROP POLICY IF EXISTS "Public read survey dimensions" ON public.survey_dimensions;
CREATE POLICY "Public read survey dimensions"
  ON public.survey_dimensions
  FOR SELECT
  TO anon
  USING (true);

-- survey_items
DROP POLICY IF EXISTS "Public read survey items" ON public.survey_items;
CREATE POLICY "Public read survey items"
  ON public.survey_items
  FOR SELECT
  TO anon
  USING (true);

-- tenants (branding)
DROP POLICY IF EXISTS "Public read tenant branding" ON public.tenants;
CREATE POLICY "Public read tenant branding"
  ON public.tenants
  FOR SELECT
  TO anon
  USING (true);
