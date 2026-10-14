-- ==============================================================================
-- DECIZY — PHASE 2 ADDITIVE MIGRATION: SECURITY, MEMBERSHIPS & AUTH BOOTSTRAP
-- Migration: 20261013000001_phase2_security_and_memberships.sql
-- Decision-Intelligence Platform for Interior Design & Architecture
-- Target: Supabase PostgreSQL (Additive, Non-destructive)
-- ==============================================================================

-- 1. SECURE SEARCH PATH FOR EXISTING FUNCTIONS
-- Prevent search_path injection attacks (CWE-426)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 2. PROJECT MEMBERS TABLE (Team Collaboration & Access Control)
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'customer',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);

-- 3. HARDENED ACCESS RESOLUTION FUNCTION
-- Resolves project access through direct assignment, project_members table, or administrator role
CREATE OR REPLACE FUNCTION public.can_access_project(p_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  -- Admin bypass
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;

  -- Direct ownership / leadership check
  IF EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_id AND (
      customer_id = auth.uid() OR
      designer_id = auth.uid() OR
      project_manager_id = auth.uid()
    )
  ) THEN
    RETURN TRUE;
  END IF;

  -- Project members table membership check
  RETURN EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id AND user_id = auth.uid()
  );
END;
$$;

-- 4. PROFILE BOOTSTRAP TRIGGER ON AUTH SIGNUP
-- Automatically generates a public.profiles record when a user signs up via Supabase Auth.
-- CRITICAL SECURITY RULE: Role is ALWAYS forced to 'customer'.
-- Anonymous or registering users CANNOT grant themselves 'admin', 'designer', or 'project_manager' via metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_city TEXT;
BEGIN
  -- Extract optional user metadata provided during registration
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_city := COALESCE(NEW.raw_user_meta_data->>'city', 'India');

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    phone,
    city,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    'customer', -- STRICT DEFAULT: Role elevation must occur through trusted admin operation
    v_phone,
    v_city,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. ROLE SELF-ELEVATION DEFENSE TRIGGER
-- Prevents users from updating their own 'role' column in public.profiles.
-- Only an existing admin can change user roles.
CREATE OR REPLACE FUNCTION public.prevent_role_self_elevation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can change user roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_elevation ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_elevation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_elevation();

-- 6. IMMUTABLE APPEND-ONLY AUDIT LOG PROTECTION
-- Blocks any UPDATE or DELETE statement on public.audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_tampering()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit trail violation: Historical audit events are immutable and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_tampering ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_tampering
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_tampering();

-- 7. ENABLE ROW LEVEL SECURITY ON PROJECT_MEMBERS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project participants can view project team members"
  ON public.project_members FOR SELECT
  USING (public.can_access_project(project_id));

CREATE POLICY "Admins, PMs and Designers can invite or add members"
  ON public.project_members FOR INSERT
  WITH CHECK (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND (
        designer_id = auth.uid() OR
        project_manager_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins and PMs can remove project members"
  ON public.project_members FOR DELETE
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND project_manager_id = auth.uid()
    )
  );

-- 8. GRANT PROPER TABLE PRIVILEGES FOR AUTHENTICATED USERS
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.projects TO authenticated;
GRANT ALL ON public.project_members TO authenticated;
GRANT ALL ON public.project_decisions TO authenticated;
GRANT ALL ON public.decision_revisions TO authenticated;
GRANT SELECT, INSERT ON public.a0_assessments TO anon, authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.master_decision_types TO anon, authenticated;
