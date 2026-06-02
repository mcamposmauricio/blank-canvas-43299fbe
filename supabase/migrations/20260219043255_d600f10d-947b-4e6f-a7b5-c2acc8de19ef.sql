
-- Fase 1: Unique constraint em survey_invitations para evitar convites duplicados
ALTER TABLE public.survey_invitations
  ADD CONSTRAINT survey_invitations_campaign_employee_unique
  UNIQUE (campaign_id, employee_id);
