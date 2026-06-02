
-- survey_campaigns: permitir leitura publica (necessario para validar status)
CREATE POLICY "Public read campaigns via invitation"
  ON survey_campaigns FOR SELECT
  USING (true);

-- survey_templates: permitir leitura publica (necessario para join aninhado)
CREATE POLICY "Public read survey templates"
  ON survey_templates FOR SELECT
  USING (true);

-- tenants: permitir leitura publica limitada (branding)
CREATE POLICY "Public read tenant branding"
  ON tenants FOR SELECT
  USING (true);

-- survey_dimensions: permitir leitura publica
CREATE POLICY "Public read survey dimensions"
  ON survey_dimensions FOR SELECT
  USING (true);

-- survey_items: permitir leitura publica
CREATE POLICY "Public read survey items"
  ON survey_items FOR SELECT
  USING (true);
