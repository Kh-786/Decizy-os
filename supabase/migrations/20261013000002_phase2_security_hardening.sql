-- ==============================================================================
-- DECIZY — PHASE 2 SECURITY HARDENING MIGRATION
-- Migration: 20261013000002_phase2_security_hardening.sql
-- Decision-Intelligence Platform for Interior Design & Architecture
-- Target: Supabase PostgreSQL (Additive, Non-destructive, Strict Least Privilege)
-- Depends on: 20261013000000_initial_decizy_schema.sql, 20261013000001_phase2_security_and_memberships.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROFILE SECURITY & ROLE INTEGRITY
-- ------------------------------------------------------------------------------

-- Ensure immutable ID and prevent unauthorized role modification on public.profiles
CREATE OR REPLACE FUNCTION public.enforce_profile_update_integrity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  -- Prevent immutable primary key tampering
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Security violation: Profile ID cannot be modified.';
  END IF;

  -- Prevent email tampering directly in profile (must go through Supabase auth flow)
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Security violation: Email modifications must be initiated via Supabase Authentication.';
  END IF;

  -- Prevent role escalation unless initiated by a verified platform admin
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Security violation: User role escalation is forbidden. Only platform administrators can modify roles.';
    END IF;
  END IF;

  -- Ensure updated_at is always current
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_update_integrity ON public.profiles;
CREATE TRIGGER trg_enforce_profile_update_integrity
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_update_integrity();

-- Trusted administrative function for role assignment (safe admin path)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  target_user_id UUID,
  new_role user_role
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Security violation: Only administrators can assign roles.';
  END IF;

  UPDATE public.profiles
  SET role = new_role,
      updated_at = NOW()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user profile not found.';
  END IF;
END;
$$;

-- Revoke broad UPDATE on public.profiles and grant column-level least privilege
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, phone, company_name, city, updated_at) ON public.profiles TO authenticated;

-- Revoke anonymous read on profiles to prevent prospect/client directory scraping
REVOKE SELECT ON public.profiles FROM anon;

-- ------------------------------------------------------------------------------
-- 2. PROJECT MEMBERSHIP HARDENING
-- ------------------------------------------------------------------------------

-- Trigger to validate project membership additions and modifications
CREATE OR REPLACE FUNCTION public.validate_project_membership_mutation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_caller_role user_role;
  v_is_pm BOOLEAN := FALSE;
  v_is_designer BOOLEAN := FALSE;
BEGIN
  -- Always allow administrative bypass
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Check caller's relationship to the target project
  SELECT 
    (project_manager_id = auth.uid()),
    (designer_id = auth.uid())
  INTO v_is_pm, v_is_designer
  FROM public.projects
  WHERE id = NEW.project_id;

  IF TG_OP = 'INSERT' THEN
    -- Ensure inviter ID is stamped with authenticated user
    IF NEW.invited_by IS NULL OR NEW.invited_by != auth.uid() THEN
      NEW.invited_by := auth.uid();
    END IF;

    -- Prohibit non-admins from assigning 'admin' role within project memberships
    IF NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Security violation: The admin role cannot be assigned through project member invitations.';
    END IF;

    -- Designers can only invite customer or designer members, not project managers
    IF v_is_designer AND NOT v_is_pm THEN
      IF NEW.role NOT IN ('customer', 'designer') THEN
        RAISE EXCEPTION 'Security violation: Designers can only invite customer or designer members.';
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Prevent members from changing the target user_id or project_id
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      RAISE EXCEPTION 'Security violation: Project and User references on a membership record are immutable.';
    END IF;

    -- Prevent members from elevating their own membership role
    IF NEW.user_id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Security violation: Self-escalation of project membership roles is prohibited.';
    END IF;

    -- Prohibit non-admins from promoting to 'admin'
    IF NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Security violation: Cannot promote member to admin.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_project_membership_mutation ON public.project_members;
CREATE TRIGGER trg_validate_project_membership_mutation
  BEFORE INSERT OR UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_membership_mutation();

-- Dedicated UPDATE policy for project_members
DROP POLICY IF EXISTS "Project managers and admins can update project members" ON public.project_members;
CREATE POLICY "Project managers and admins can update project members"
  ON public.project_members FOR UPDATE
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND project_manager_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND project_manager_id = auth.uid()
    )
  );

-- Refined DELETE policy: PMs/admins can remove members, or a user can leave the project
DROP POLICY IF EXISTS "Admins and PMs can remove project members" ON public.project_members;
CREATE POLICY "Admins, PMs can remove members or users can leave project"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (
    public.is_admin() OR
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND project_manager_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 3. DECISION APPROVALS & STATUS BOUNDARY ENFORCEMENT
-- ------------------------------------------------------------------------------

-- Enforces valid status transitions and authorized signoffs at database engine boundary
CREATE OR REPLACE FUNCTION public.validate_decision_state_and_approvals()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_is_authorized_signatory BOOLEAN := FALSE;
BEGIN
  -- Admin bypass
  IF public.is_admin() THEN
    IF NEW.status = 'Approved' THEN
      IF NEW.approved_by IS NULL THEN
        NEW.approved_by := auth.uid();
      END IF;
      IF NEW.approved_at IS NULL THEN
        NEW.approved_at := NOW();
      END IF;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  -- Check if caller is an authorized project stakeholder
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = NEW.project_id AND (
      p.customer_id = auth.uid() OR
      p.project_manager_id = auth.uid() OR
      p.designer_id = auth.uid()
    )
  ) OR EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = NEW.project_id 
      AND pm.user_id = auth.uid() 
      AND pm.role IN ('customer', 'project_manager', 'designer')
  ) INTO v_is_authorized_signatory;

  IF NOT v_is_authorized_signatory THEN
    RAISE EXCEPTION 'Security violation: Caller is not an authorized team member of this project.';
  END IF;

  -- Rule 3.1: Enforce Approval Requirements
  IF NEW.status = 'Approved' THEN
    -- Only customer (client signoff), project manager, designer or admin can sign off
    -- Must stamp approved_by with caller ID to prevent forgery
    IF NEW.approved_by IS DISTINCT FROM auth.uid() AND OLD.status IS DISTINCT FROM 'Approved' THEN
      NEW.approved_by := auth.uid();
    END IF;

    -- Must stamp approval timestamp
    IF NEW.approved_at IS NULL OR OLD.status IS DISTINCT FROM 'Approved' THEN
      NEW.approved_at := NOW();
    END IF;

  ELSE
    -- If status is NOT Approved, do not allow arbitrary setting of approved_by/approved_at
    IF OLD.status IS DISTINCT FROM 'Approved' AND (NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL) THEN
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    END IF;
  END IF;

  -- Rule 3.2: Prevent tampering with project_id and type_code
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'Security violation: Decision project_id cannot be changed.';
  END IF;
  IF NEW.type_code IS DISTINCT FROM OLD.type_code THEN
    RAISE EXCEPTION 'Security violation: Decision type_code cannot be changed.';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_decision_state_and_approvals ON public.project_decisions;
CREATE TRIGGER trg_validate_decision_state_and_approvals
  BEFORE UPDATE ON public.project_decisions
  FOR EACH ROW EXECUTE FUNCTION public.validate_decision_state_and_approvals();

-- ------------------------------------------------------------------------------
-- 4. IMMUTABLE HISTORY: REVISIONS & AUDIT LOG RETENTION
-- ------------------------------------------------------------------------------

-- Enforce strict append-only immutability on decision revisions
CREATE OR REPLACE FUNCTION public.prevent_revision_tampering()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Compliance violation: Decision revisions are immutable legal records and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_revision_tampering ON public.decision_revisions;
CREATE TRIGGER trg_prevent_revision_tampering
  BEFORE UPDATE OR DELETE ON public.decision_revisions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_revision_tampering();

-- Enforce actor verification on audit logs to prevent actor spoofing
CREATE OR REPLACE FUNCTION public.validate_audit_log_entry()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_real_role user_role;
BEGIN
  -- Non-admins cannot forge actor_id
  IF NOT public.is_admin() THEN
    IF NEW.actor_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Security violation: Audit actor_id must match authenticated caller.';
    END IF;

    -- Verify actor_role matches profile
    SELECT role INTO v_real_role FROM public.profiles WHERE id = auth.uid();
    IF v_real_role IS NOT NULL AND NEW.actor_role IS DISTINCT FROM v_real_role THEN
      NEW.actor_role := v_real_role;
    END IF;

    -- Verify access to referenced project if present
    IF NEW.project_id IS NOT NULL AND NOT public.can_access_project(NEW.project_id) THEN
      RAISE EXCEPTION 'Security violation: Cannot record audit log for an inaccessible project.';
    END IF;
  END IF;

  NEW.timestamp := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_audit_log_entry ON public.audit_logs;
CREATE TRIGGER trg_validate_audit_log_entry
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.validate_audit_log_entry();

-- Protect audit logs from project deletion cascading (Retention enforcement)
-- Replace ON DELETE CASCADE with ON DELETE RESTRICT on audit_logs.project_id
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'audit_logs'
      AND kcu.column_name = 'project_id'
  ) LOOP
    EXECUTE 'ALTER TABLE public.audit_logs DROP CONSTRAINT ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;

-- ------------------------------------------------------------------------------
-- 5. LEAST-PRIVILEGE GRANTS REVISION
-- ------------------------------------------------------------------------------

-- Remove excessive GRANT ALL privileges across business tables
REVOKE ALL ON public.projects FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.projects TO authenticated;

REVOKE ALL ON public.project_members FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;

REVOKE ALL ON public.project_decisions FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.project_decisions TO authenticated;

REVOKE ALL ON public.decision_revisions FROM authenticated;
GRANT SELECT, INSERT ON public.decision_revisions TO authenticated;

REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

-- A0 Assessments: public can only submit (INSERT), cannot read existing entries
REVOKE SELECT ON public.a0_assessments FROM anon;
GRANT INSERT ON public.a0_assessments TO anon;
GRANT SELECT, INSERT ON public.a0_assessments TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. FUNCTION EXECUTION RESTRICTIONS
-- ------------------------------------------------------------------------------

-- Restrict sensitive helper functions to authenticated role only
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_project(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_project(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(UUID, user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, user_role) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. A0 PUBLIC INTAKE DATABASE CONSTRAINTS
-- ------------------------------------------------------------------------------

-- Add defensive check constraints to a0_assessments to reject malformed bot submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_a0_email_format'
  ) THEN
    ALTER TABLE public.a0_assessments
      ADD CONSTRAINT chk_a0_email_format
      CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_a0_name_length'
  ) THEN
    ALTER TABLE public.a0_assessments
      ADD CONSTRAINT chk_a0_name_length
      CHECK (char_length(full_name) BETWEEN 2 AND 150);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_a0_area_bounds'
  ) THEN
    ALTER TABLE public.a0_assessments
      ADD CONSTRAINT chk_a0_area_bounds
      CHECK (approximate_area_sqft > 0 AND approximate_area_sqft <= 1000000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_a0_postal_code'
  ) THEN
    ALTER TABLE public.a0_assessments
      ADD CONSTRAINT chk_a0_postal_code
      CHECK (postal_code IS NULL OR postal_code ~ '^[1-9][0-9]{5}$');
  END IF;
END $$;
