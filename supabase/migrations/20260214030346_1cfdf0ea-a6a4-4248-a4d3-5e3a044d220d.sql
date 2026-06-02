
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_survey_responses_campaign ON survey_responses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_response ON survey_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_campaign_scores_campaign ON campaign_scores(campaign_id);
CREATE INDEX IF NOT EXISTS idx_group_scores_campaign ON group_scores(campaign_id, group_type);
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_survey_invitations_token ON survey_invitations(token);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;

-- RLS for logos bucket (public read, admin_rh upload)
CREATE POLICY "Logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "Admin RH can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated' AND has_role(auth.uid(), 'admin_rh'));

CREATE POLICY "Admin RH can update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'logos' AND auth.role() = 'authenticated' AND has_role(auth.uid(), 'admin_rh'));

CREATE POLICY "Admin RH can delete logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'logos' AND auth.role() = 'authenticated' AND has_role(auth.uid(), 'admin_rh'));

-- RLS for reports bucket (tenant read via authenticated, service role writes)
CREATE POLICY "Authenticated users can read reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'reports' AND auth.role() = 'authenticated');

-- Anonymous UPDATE policy for survey_invitations (mark as used)
CREATE POLICY "Anonymous can mark invitation as used"
ON survey_invitations FOR UPDATE
USING (true)
WITH CHECK (is_used = true);
