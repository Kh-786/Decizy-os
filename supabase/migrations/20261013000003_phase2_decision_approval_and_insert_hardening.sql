-- ==============================================================================
-- DECIZY — PHASE 2 DECISION APPROVAL AND INSERT HARDENING
-- Migration: 20261013000003_phase2_decision_approval_and_insert_hardening.sql
-- Decision-Intelligence Platform for Interior Design & Architecture
-- Target: Supabase PostgreSQL (Additive, Non-destructive, Strict Least Privilege)
-- Depends on:
--   20261013000000_initial_decizy_schema.sql
--   20261013000001_phase2_security_and_memberships.sql
--   20261013000002_phase2_security_hardening.sql
-- ==============================================================================
-- RATIONALE & SECURITY FINDINGS ADDRESSED:
-- 1. Initial Insert Protection:
--    Migration 02 bound trg_validate_decision_state_and_approvals only BEFORE UPDATE.
--    Callers with INSERT privileges could insert a decision directly marked 'Approved'
--    or supply forged approved_by/approved_at values. This migration binds the trigger
--    to BEFORE INSERT OR UPDATE and forbids non-admin insertion of 'Approved' decisions.
-- 2. Administrator Approval Attribution:
--    Clarifies administrator approval attribution. Prohibits admins from silently
--    attributing approvals to non-stakeholders. If an admin approves on behalf of a
--    stakeholder (proxy approval), the target user must be a verified project member.
--    Default administrator approvals strictly stamp the caller's auth.uid() and NOW().
-- 3. Historical Attribution Immutability:
--    Ensures that when any stakeholder or administrator updates fields (e.g. notes,
--    descriptions, options) on an already-approved decision, the original approved_by
--    and approved_at timestamps are strictly immutable and cannot be tampered with.
-- 4. Clean Demotion Attribution Clearing:
--    Fixes the state-transition bug where transitioning away from 'Approved' (e.g. to
--    'Changes Requested' or 'Draft') previously failed to clear approved_by/approved_at.
-- ==============================================================================

-- 1. HARDENED DECISION VALIDATION FUNCTION (INSERT + UPDATE)
CREATE OR REPLACE FUNCTION public.validate_decision_state_and_approvals()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_is_authorized_signatory BOOLEAN := FALSE;
BEGIN
  -- ----------------------------------------------------------------------------
  -- BRANCH A: PLATFORM ADMINISTRATORS
  -- ----------------------------------------------------------------------------
  IF public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.status = 'Approved' THEN
        -- If admin specifies an approved_by other than themselves, it MUST be a verified project stakeholder
        IF NEW.approved_by IS NOT NULL AND NEW.approved_by != auth.uid() THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = NEW.project_id AND (
              p.customer_id = NEW.approved_by OR
              p.project_manager_id = NEW.approved_by OR
              p.designer_id = NEW.approved_by
            )
          ) AND NOT EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = NEW.project_id AND pm.user_id = NEW.approved_by
          ) THEN
            RAISE EXCEPTION 'Security violation: Administrator proxy approval must reference an authorized project stakeholder.';
          END IF;
        ELSE
          NEW.approved_by := auth.uid();
        END IF;
        NEW.approved_at := NOW();
      ELSE
        -- Non-approved inserts must not carry approval metadata
        NEW.approved_by := NULL;
        NEW.approved_at := NULL;
      END IF;
      NEW.created_at := NOW();
      NEW.updated_at := NOW();
      RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
      -- Prevent primary/foreign key modification
      IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
        RAISE EXCEPTION 'Security violation: Decision project_id cannot be changed.';
      END IF;
      IF NEW.type_code IS DISTINCT FROM OLD.type_code THEN
        RAISE EXCEPTION 'Security violation: Decision type_code cannot be changed.';
      END IF;

      IF NEW.status = 'Approved' THEN
        IF OLD.status IS DISTINCT FROM 'Approved' THEN
          -- First-time approval by admin
          IF NEW.approved_by IS NOT NULL AND NEW.approved_by != auth.uid() THEN
            IF NOT EXISTS (
              SELECT 1 FROM public.projects p
              WHERE p.id = NEW.project_id AND (
                p.customer_id = NEW.approved_by OR
                p.project_manager_id = NEW.approved_by OR
                p.designer_id = NEW.approved_by
              )
            ) AND NOT EXISTS (
              SELECT 1 FROM public.project_members pm
              WHERE pm.project_id = NEW.project_id AND pm.user_id = NEW.approved_by
            ) THEN
              RAISE EXCEPTION 'Security violation: Administrator proxy approval must reference an authorized project stakeholder.';
            END IF;
          ELSE
            NEW.approved_by := auth.uid();
          END IF;
          NEW.approved_at := NOW();
        ELSE
          -- Modifying an already-approved decision: historical attribution is strictly locked
          IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
            RAISE EXCEPTION 'Security violation: Cannot modify approved_by on an already approved decision.';
          END IF;
          IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
            RAISE EXCEPTION 'Security violation: Cannot modify approved_at on an already approved decision.';
          END IF;
          NEW.approved_by := OLD.approved_by;
          NEW.approved_at := OLD.approved_at;
        END IF;
      ELSE
        -- Any transition away from Approved (or non-approved update) clears approval attribution
        NEW.approved_by := NULL;
        NEW.approved_at := NULL;
      END IF;

      NEW.updated_at := NOW();
      RETURN NEW;
    END IF;
  END IF;

  -- ----------------------------------------------------------------------------
  -- BRANCH B: STANDARD PROJECT STAKEHOLDERS (Customer, Designer, Project Manager)
  -- ----------------------------------------------------------------------------
  -- Verify caller is an authorized stakeholder of the referenced project
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

  -- B.1 INSERT RULES
  IF TG_OP = 'INSERT' THEN
    -- Non-admins cannot insert decisions directly as 'Approved'
    IF NEW.status = 'Approved' THEN
      RAISE EXCEPTION 'Security violation: Decisions cannot be directly inserted with Approved status. A formal review and signoff transition is required.';
    END IF;

    -- Strip any caller-supplied approval attribution on initial insert
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.created_at := NOW();
    NEW.updated_at := NOW();
    RETURN NEW;

  -- B.2 UPDATE RULES
  ELSIF TG_OP = 'UPDATE' THEN
    -- Prevent structural key modification
    IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      RAISE EXCEPTION 'Security violation: Decision project_id cannot be changed.';
    END IF;
    IF NEW.type_code IS DISTINCT FROM OLD.type_code THEN
      RAISE EXCEPTION 'Security violation: Decision type_code cannot be changed.';
    END IF;

    IF NEW.status = 'Approved' THEN
      IF OLD.status IS DISTINCT FROM 'Approved' THEN
        -- Path 1: First-time approval
        -- Authenticated caller ID and current timestamp are stamped authoritatively
        NEW.approved_by := auth.uid();
        NEW.approved_at := NOW();
      ELSE
        -- Path 2: Modifying an already-approved decision
        -- Prevent tampering with historical signer or signoff timestamp
        IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
          RAISE EXCEPTION 'Security violation: Cannot modify approved_by on an already approved decision.';
        END IF;
        IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
          RAISE EXCEPTION 'Security violation: Cannot modify approved_at on an already approved decision.';
        END IF;
        NEW.approved_by := OLD.approved_by;
        NEW.approved_at := OLD.approved_at;
      END IF;
    ELSE
      -- Path 3 & 4: Status is NOT 'Approved'
      -- When transitioning away from Approved, or updating a Draft/Review decision:
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. REBIND TRIGGER TO BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_validate_decision_state_and_approvals ON public.project_decisions;
CREATE TRIGGER trg_validate_decision_state_and_approvals
  BEFORE INSERT OR UPDATE ON public.project_decisions
  FOR EACH ROW EXECUTE FUNCTION public.validate_decision_state_and_approvals();
