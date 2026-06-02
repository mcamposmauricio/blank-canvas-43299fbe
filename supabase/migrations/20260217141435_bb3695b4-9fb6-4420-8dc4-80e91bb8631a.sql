
-- Fix: Recriar políticas INSERT como PERMISSIVE (padrão) ao invés de RESTRICTIVE

-- survey_responses
DROP POLICY "Insert responses anonymously" ON survey_responses;
CREATE POLICY "Insert responses anonymously"
  ON survey_responses FOR INSERT
  WITH CHECK (true);

-- survey_answers
DROP POLICY "Insert answers anonymously" ON survey_answers;
CREATE POLICY "Insert answers anonymously"
  ON survey_answers FOR INSERT
  WITH CHECK (true);

-- consent_records
DROP POLICY "Insert consent anonymously" ON consent_records;
CREATE POLICY "Insert consent anonymously"
  ON consent_records FOR INSERT
  WITH CHECK (true);
