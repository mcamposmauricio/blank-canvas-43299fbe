ALTER TABLE public.consent_records
  ADD CONSTRAINT consent_records_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES public.survey_campaigns(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_consent_records_campaign_id
  ON public.consent_records(campaign_id);