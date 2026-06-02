-- Fix: Add authenticated role to public SELECT policies for survey access

-- survey_invitations
DROP POLICY "Public access to invitations by token" ON public.survey_invitations;
CREATE POLICY "Public access to invitations by token" ON public.survey_invitations
  FOR SELECT TO anon, authenticated USING (true);

-- survey_campaigns
DROP POLICY "Public read campaigns via invitation" ON public.survey_campaigns;
CREATE POLICY "Public read campaigns via invitation" ON public.survey_campaigns
  FOR SELECT TO anon, authenticated USING (true);

-- survey_templates
DROP POLICY "Public read survey templates" ON public.survey_templates;
CREATE POLICY "Public read survey templates" ON public.survey_templates
  FOR SELECT TO anon, authenticated USING (true);

-- survey_dimensions
DROP POLICY "Public read survey dimensions" ON public.survey_dimensions;
CREATE POLICY "Public read survey dimensions" ON public.survey_dimensions
  FOR SELECT TO anon, authenticated USING (true);

-- survey_items
DROP POLICY "Public read survey items" ON public.survey_items;
CREATE POLICY "Public read survey items" ON public.survey_items
  FOR SELECT TO anon, authenticated USING (true);