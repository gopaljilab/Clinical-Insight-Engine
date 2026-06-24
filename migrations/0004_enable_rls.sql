-- Enable Row-Level Security on the assessments table
ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Policy: SELECT - users can only view records they own, created, or are admin
DO $$ BEGIN
  CREATE POLICY "assessments_select_policy" ON "assessments"
    FOR SELECT
    USING (
      current_setting('app.current_user_id', true)::uuid = owner_id
      OR
      current_setting('app.current_user_email', true)::text = created_by
      OR
      current_setting('app.current_user_patient_name', true)::text = patient_name
      OR
      current_setting('app.current_user_role', true)::text = 'ADMIN'
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Policy: INSERT - users can only create records within their scope
DO $$ BEGIN
  CREATE POLICY "assessments_insert_policy" ON "assessments"
    FOR INSERT
    WITH CHECK (
      created_by = current_setting('app.current_user_email', true)::text
      OR
      owner_id = current_setting('app.current_user_id', true)::uuid
      OR
      current_setting('app.current_user_role', true)::text = 'ADMIN'
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Policy: UPDATE - users can only update records they own
DO $$ BEGIN
  CREATE POLICY "assessments_update_policy" ON "assessments"
    FOR UPDATE
    USING (
      current_setting('app.current_user_id', true)::uuid = owner_id
      OR
      current_setting('app.current_user_email', true)::text = created_by
      OR
      current_setting('app.current_user_role', true)::text = 'ADMIN'
    )
    WITH CHECK (
      current_setting('app.current_user_id', true)::uuid = owner_id
      OR
      current_setting('app.current_user_email', true)::text = created_by
      OR
      current_setting('app.current_user_role', true)::text = 'ADMIN'
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Policy: DELETE - users can only delete records they own
DO $$ BEGIN
  CREATE POLICY "assessments_delete_policy" ON "assessments"
    FOR DELETE
    USING (
      current_setting('app.current_user_id', true)::uuid = owner_id
      OR
      current_setting('app.current_user_email', true)::text = created_by
      OR
      current_setting('app.current_user_role', true)::text = 'ADMIN'
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
