
-- Remove duplicatas mantendo a linha mais antiga por (campaign_id, employee_id)
DELETE FROM public.survey_invitations a
USING public.survey_invitations b
WHERE a.campaign_id = b.campaign_id
  AND a.employee_id = b.employee_id
  AND a.created_at > b.created_at;

-- Em caso de timestamps iguais, mantém o menor id
DELETE FROM public.survey_invitations a
USING public.survey_invitations b
WHERE a.campaign_id = b.campaign_id
  AND a.employee_id = b.employee_id
  AND a.created_at = b.created_at
  AND a.id > b.id;

ALTER TABLE public.survey_invitations
  ADD CONSTRAINT survey_invitations_campaign_employee_unique
  UNIQUE (campaign_id, employee_id);
