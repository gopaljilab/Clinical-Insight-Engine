ALTER TABLE assessments ADD COLUMN IF NOT EXISTS prediction_method text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS model_version text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS fallback_used boolean;
