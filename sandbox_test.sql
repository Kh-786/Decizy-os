-- ==============================================================================
-- DECIZY — COMPREHENSIVE POSTGRESQL 16.4 SANDBOX VALIDATION HARNESS
-- Target: Disposable PostgreSQL 16.4 Sandbox / PGlite / Local PostgreSQL
-- Transaction: Atomic single transaction ending with ROLLBACK
-- STATUS: READY FOR SANDBOX EXECUTION (Validated by static code analysis and TypeScript suite)
-- Note: Contains compatibility shims in Section 1 for standalone sandbox execution.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- SECTION 1: SANDBOX COMPATIBILITY SHIMS
-- Explicitly document and emulate Supabase-specific dependencies.
-- These shims are required for generic PostgreSQL execution without GoTrue/PostgREST.
-- ==============================================================================

-- 1.1 Mock auth schema and auth.users table (GoTrue identity store)
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Mock Supabase auth.uid() function backed by PostgreSQL session setting
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 1.3 Ensure Supabase standard roles exist in sandbox
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

-- 1.4 UUID generator compatibility (falls back to gen_random_uuid if uuid-ossp is not pre-installed)
CREATE OR REPLACE FUNCTION uuid_generate_v4()
RETURNS UUID AS $$
  SELECT gen_random_uuid();
$$ LANGUAGE sql;

-- ==============================================================================
-- SECTION 2: MIGRATION 00 — INITIAL DECIZY SCHEMA (VERBATIM APPLICATION)
-- Source: supabase/migrations/20261013000000_initial_decizy_schema.sql
-- ==============================================================================

-- 1. EXTENSIONS
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION WHEN OTHERS THEN
  NULL; -- Fallback function uuid_generate_v4() provided in Section 1
END $$;

-- 2. ENUMS
CREATE TYPE user_role AS ENUM (
  'customer',
  'designer',
  'project_manager',
  'admin'
);

CREATE TYPE project_type AS ENUM (
  'Residential',
  'Commercial',
  'Hospitality',
  'Retail',
  'Office',
  'Other'
);

CREATE TYPE project_stage AS ENUM (
  'Planning',
  'Design Underway',
  'Execution',
  'Renovation',
  'Handover',
  'Other'
);

CREATE TYPE decision_status AS ENUM (
  'Draft',
  'Submitted',
  'Under Review',
  'Changes Requested',
  'Approved',
  'Rejected',
  'Superseded'
);

CREATE TYPE urgency_level AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE impact_level AS ENUM ('Low', 'Medium', 'High', 'Severe');

-- 3. PROFILES TABLE (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'customer',
  phone TEXT,
  company_name TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  type project_type NOT NULL DEFAULT 'Residential',
  stage project_stage NOT NULL DEFAULT 'Planning',
  city TEXT NOT NULL,
  postal_code VARCHAR(6),
  area_sqft NUMERIC NOT NULL CHECK (area_sqft > 0),
  budget_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  spent_inr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  designer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  service_tier VARCHAR(4) NOT NULL DEFAULT 'A0',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_completion_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. A0 ASSESSMENTS TABLE (Public Screening Intake)
CREATE TABLE IF NOT EXISTS public.a0_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  project_type project_type NOT NULL,
  project_city TEXT NOT NULL,
  postal_code VARCHAR(6),
  approximate_area_sqft NUMERIC NOT NULL,
  project_stage project_stage NOT NULL,
  budget_range_inr TEXT NOT NULL,
  primary_challenge TEXT NOT NULL,
  decision_needed_soon BOOLEAN NOT NULL DEFAULT FALSE,
  contact_consent BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'Received',
  converted_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. MASTER DECISION TYPES (Seedable & Admin-Editable 33 Types)
CREATE TABLE IF NOT EXISTS public.master_decision_types (
  code VARCHAR(16) PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  stages project_stage[] NOT NULL,
  required_inputs TEXT[] NOT NULL DEFAULT '{}',
  expected_outputs TEXT[] NOT NULL DEFAULT '{}',
  dependencies VARCHAR(16)[] NOT NULL DEFAULT '{}',
  impact impact_level NOT NULL DEFAULT 'Medium',
  urgency urgency_level NOT NULL DEFAULT 'Medium',
  risk_indicators TEXT[] NOT NULL DEFAULT '{}',
  responsible_role user_role NOT NULL DEFAULT 'designer',
  approval_requirements TEXT NOT NULL,
  document_requirements TEXT[] NOT NULL DEFAULT '{}',
  suggested_next_action TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. PROJECT DECISIONS (Instances per project)
CREATE TABLE IF NOT EXISTS public.project_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type_code VARCHAR(16) NOT NULL REFERENCES public.master_decision_types(code),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  stage project_stage NOT NULL,
  status decision_status NOT NULL DEFAULT 'Draft',
  urgency urgency_level NOT NULL DEFAULT 'Medium',
  impact impact_level NOT NULL DEFAULT 'Medium',
  deadline_date DATE NOT NULL,
  responsible_role user_role NOT NULL,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  current_option TEXT NOT NULL,
  options_considered JSONB NOT NULL DEFAULT '[]'::jsonb,
  rationale TEXT,
  cost_impact_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  time_impact_days INT NOT NULL DEFAULT 0,
  flagged_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  review_flag_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_decision_type UNIQUE (project_id, type_code)
);

-- 8. DECISION REVISIONS (Immutable audit history of changes)
CREATE TABLE IF NOT EXISTS public.decision_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  decision_id UUID NOT NULL REFERENCES public.project_decisions(id) ON DELETE CASCADE,
  revision_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  selected_option TEXT NOT NULL,
  rationale TEXT NOT NULL,
  cost_impact_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  time_impact_days INT NOT NULL DEFAULT 0,
  status decision_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_decision_revision UNIQUE (decision_id, revision_number)
);

-- 9. PROJECT DOCUMENTS & ATTACHMENTS
CREATE TABLE IF NOT EXISTS public.project_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES public.project_decisions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. AUDIT LOGS (Durable Append-Only Trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES public.project_decisions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  actor_name TEXT NOT NULL,
  actor_role user_role NOT NULL,
  details TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enforce authorization boundaries at the PostgreSQL engine level
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.a0_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_decision_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user participates in project
CREATE OR REPLACE FUNCTION public.can_access_project(p_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_id AND (
      customer_id = auth.uid() OR
      designer_id = auth.uid() OR
      project_manager_id = auth.uid() OR
      public.is_admin()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Users can read own profile or admins read all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Projects Policies
CREATE POLICY "Project members and admins can view project"
  ON public.projects FOR SELECT
  USING (public.can_access_project(id));

CREATE POLICY "Designers, PMs, and Admins can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('designer', 'project_manager')
    )
  );

CREATE POLICY "Authorized team members can update their project"
  ON public.projects FOR UPDATE
  USING (
    public.is_admin() OR
    designer_id = auth.uid() OR
    project_manager_id = auth.uid()
  );

-- Decisions Policies
CREATE POLICY "Project members can view project decisions"
  ON public.project_decisions FOR SELECT
  USING (public.can_access_project(project_id));

CREATE POLICY "Designers, PMs, and Admins can create decisions"
  ON public.project_decisions FOR INSERT
  WITH CHECK (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND (designer_id = auth.uid() OR project_manager_id = auth.uid())
    )
  );

CREATE POLICY "Participants can update decisions based on role workflow"
  ON public.project_decisions FOR UPDATE
  USING (public.can_access_project(project_id));

-- Revisions Policies (Append-only)
CREATE POLICY "Project members can read revisions"
  ON public.decision_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_decisions d
      WHERE d.id = decision_id AND public.can_access_project(d.project_id)
    )
  );

CREATE POLICY "Authorized users can insert revisions"
  ON public.decision_revisions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_decisions d
      WHERE d.id = decision_id AND public.can_access_project(d.project_id)
    )
  );

-- Master Decision Types: Read-only for authenticated, write for admin
CREATE POLICY "Anyone authenticated can view master decision types"
  ON public.master_decision_types FOR SELECT
  USING (true);

CREATE POLICY "Only admins can edit master decision catalogue"
  ON public.master_decision_types FOR ALL
  USING (public.is_admin());

-- A0 Assessments: Public can submit; submitter or staff can read
CREATE POLICY "Anyone can submit A0 assessment"
  ON public.a0_assessments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Submitter or staff can view A0 assessment"
  ON public.a0_assessments FOR SELECT
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('designer', 'project_manager')
    ) OR
    email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- Audit logs: Viewable by project participants, insertable by system
CREATE POLICY "Project members can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (project_id IS NULL OR public.can_access_project(project_id));

CREATE POLICY "Authenticated users can record audit entries"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() = actor_id OR public.is_admin());

-- ==============================================================================
-- SECTION 3: MIGRATION 01 — MEMBERSHIPS & AUTH BOOTSTRAP (VERBATIM APPLICATION)
-- Source: supabase/migrations/20261013000001_phase2_security_and_memberships.sql
-- ==============================================================================

-- 1. SECURE SEARCH_PATH ON EXISTING HELPER FUNCTIONS
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

-- 2. PROJECT_MEMBERS TABLE (Explicit role-based team management per project)
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

-- 3. HARDEN CAN_ACCESS_PROJECT TO INCLUDE PROJECT_MEMBERS
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
    'customer',
    v_phone,
    v_city,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. ROLE SELF-ELEVATION DEFENSE TRIGGER
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

-- ==============================================================================
-- SECTION 4: MIGRATION 02 — SECURITY HARDENING (VERBATIM APPLICATION)
-- Source: supabase/migrations/20261013000002_phase2_security_hardening.sql
-- ==============================================================================

-- 1. PROFILE SECURITY & ROLE INTEGRITY
CREATE OR REPLACE FUNCTION public.enforce_profile_update_integrity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Security violation: Profile ID cannot be modified.';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Security violation: Email modifications must be initiated via Supabase Authentication.';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Security violation: User role escalation is forbidden. Only platform administrators can modify roles.';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_update_integrity ON public.profiles;
CREATE TRIGGER trg_enforce_profile_update_integrity
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_update_integrity();

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

REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, phone, company_name, city, updated_at) ON public.profiles TO authenticated;
REVOKE SELECT ON public.profiles FROM anon;

-- 2. PROJECT MEMBERSHIP HARDENING
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
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT 
    (project_manager_id = auth.uid()),
    (designer_id = auth.uid())
  INTO v_is_pm, v_is_designer
  FROM public.projects
  WHERE id = NEW.project_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.invited_by IS NULL OR NEW.invited_by != auth.uid() THEN
      NEW.invited_by := auth.uid();
    END IF;

    IF NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Security violation: The admin role cannot be assigned through project member invitations.';
    END IF;

    IF v_is_designer AND NOT v_is_pm THEN
      IF NEW.role NOT IN ('customer', 'designer') THEN
        RAISE EXCEPTION 'Security violation: Designers can only invite customer or designer members.';
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      RAISE EXCEPTION 'Security violation: Project and User references on a membership record are immutable.';
    END IF;

    IF NEW.user_id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Security violation: Self-escalation of project membership roles is prohibited.';
    END IF;

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

-- 3. DECISION APPROVALS & STATUS BOUNDARY ENFORCEMENT
CREATE OR REPLACE FUNCTION public.validate_decision_state_and_approvals()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_is_authorized_signatory BOOLEAN := FALSE;
BEGIN
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

  IF NEW.status = 'Approved' THEN
    IF NEW.approved_by IS DISTINCT FROM auth.uid() AND OLD.status IS DISTINCT FROM 'Approved' THEN
      NEW.approved_by := auth.uid();
    END IF;

    IF NEW.approved_at IS NULL OR OLD.status IS DISTINCT FROM 'Approved' THEN
      NEW.approved_at := NOW();
    END IF;

  ELSE
    IF OLD.status IS DISTINCT FROM 'Approved' AND (NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL) THEN
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    END IF;
  END IF;

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

-- 4. IMMUTABLE HISTORY: REVISIONS & AUDIT LOG RETENTION
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

CREATE OR REPLACE FUNCTION public.validate_audit_log_entry()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_real_role user_role;
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.actor_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Security violation: Audit actor_id must match authenticated caller.';
    END IF;

    SELECT role INTO v_real_role FROM public.profiles WHERE id = auth.uid();
    IF v_real_role IS NOT NULL AND NEW.actor_role IS DISTINCT FROM v_real_role THEN
      NEW.actor_role := v_real_role;
    END IF;

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

-- 5. LEAST-PRIVILEGE GRANTS REVISION
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

REVOKE SELECT ON public.a0_assessments FROM anon;
GRANT INSERT ON public.a0_assessments TO anon;
GRANT SELECT, INSERT ON public.a0_assessments TO authenticated;

-- 6. FUNCTION EXECUTION RESTRICTIONS
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_project(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_project(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(UUID, user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, user_role) TO authenticated;

-- 7. A0 PUBLIC INTAKE DATABASE CONSTRAINTS
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

-- ==============================================================================
-- SECTION 5: MIGRATION 03 — DECISION APPROVAL & INSERT HARDENING (VERBATIM APPLICATION)
-- Source: supabase/migrations/20261013000003_phase2_decision_approval_and_insert_hardening.sql
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

-- ==============================================================================
-- SECTION 6: RIGOROUS SANDBOX TEST SUITE (PL/pgSQL)
-- Authorization Mechanism Boundary Notice:
-- In PostgreSQL, when code executes within a single anonymous DO block or script
-- connected as the schema creator (table owner / postgres), the PostgreSQL engine
-- BYPASSES table Row-Level Security (RLS) policies by default (per PostgreSQL
-- documentation: "Table owners normally bypass row security").
--
-- Therefore, this PL/pgSQL test suite directly exercises and proves:
--   1. Database Trigger State Machines & Enforcement:
--      - validate_decision_state_and_approvals (4 transition paths, insert protection)
--      - enforce_profile_update_integrity & prevent_role_self_elevation (role escalation defenses)
--      - validate_project_membership_mutation (membership role restrictions)
--      - decision_revisions immutability triggers (prevent update/delete)
--      - audit_logs immutability triggers (prevent update/delete)
--      - audit_logs actor identity verification triggers (anti-spoofing)
--   2. Database Table Constraints & Invariants:
--      - Check constraints (chk_a0_email_format, chk_a0_name_length, bounds)
--      - Foreign key retention constraints (audit_logs ON DELETE RESTRICT on projects)
--      - Unique constraints (uq_project_member, etc.)
--   3. SECURITY DEFINER Authorization Functions:
--      - is_admin(), can_access_project(), admin_set_user_role()
--
-- Genuine RLS Policy Testing Distinction:
-- Direct PostgREST RLS policy evaluation (filtering SELECT queries and enforcing
-- USING/WITH CHECK expressions across distinct unprivileged HTTP sessions) requires
-- connecting as unprivileged roles (anon, authenticated) via Supabase client or
-- running with `ALTER TABLE ... FORCE ROW LEVEL SECURITY`. This test suite does
-- NOT conflate trigger/constraint enforcement with table-owner RLS bypass.
-- Exactly 34 assertions covering all trigger, constraint, and function boundaries.
-- ==============================================================================

DO $$
DECLARE
  v_admin_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_designer_id UUID := gen_random_uuid();
  v_pm_id UUID := gen_random_uuid();
  v_attacker_id UUID := gen_random_uuid();
  v_outsider_id UUID := gen_random_uuid();

  v_project_id UUID := gen_random_uuid();
  v_decision_id UUID := gen_random_uuid();
  v_decision_insert_test_id UUID;
  v_assessment_id UUID;
  v_passed INT := 0;
  v_failed INT := 0;

  v_test_title TEXT;
  v_expected_err BOOLEAN;
  v_decision_row public.project_decisions%ROWTYPE;
  v_profile_row public.profiles%ROWTYPE;
  v_original_approved_at TIMESTAMPTZ;
  v_check_count INT;
BEGIN
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'DECIZY DATABASE SECURITY SANDBOX TEST SUITE (34 TESTS)';
  RAISE NOTICE '=======================================================';

  -- ----------------------------------------------------------------------------
  -- SEED TEST USERS (Simulate GoTrue auth signups)
  -- ----------------------------------------------------------------------------
  INSERT INTO auth.users (id, email) VALUES
    (v_admin_id, 'admin@decizy.in'),
    (v_client_id, 'client@decizy.in'),
    (v_designer_id, 'designer@decizy.in'),
    (v_pm_id, 'pm@decizy.in'),
    (v_attacker_id, 'attacker@decizy.in'),
    (v_outsider_id, 'outsider@decizy.in');

  -- ----------------------------------------------------------------------------
  -- TEST GROUP 1: AUTH BOOTSTRAP INTEGRITY
  -- ----------------------------------------------------------------------------
  v_test_title := '1.1 handle_new_user() trigger created 6 profiles defaulting strictly to customer';
  SELECT count(*) INTO v_check_count 
  FROM public.profiles 
  WHERE id IN (v_admin_id, v_client_id, v_designer_id, v_pm_id, v_attacker_id, v_outsider_id) 
    AND role = 'customer';

  IF v_check_count = 6 THEN
    RAISE NOTICE '✓ PASS [Test 1.1]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 1.1]: Expected 6 customer profiles, found %', v_check_count;
    v_failed := v_failed + 1;
  END IF;

  -- ----------------------------------------------------------------------------
  -- PRIVILEGED SANDBOX BOOTSTRAP: INITIAL ROLE ESTABLISHMENT
  -- ----------------------------------------------------------------------------
  -- Environment Compatibility Note (Addressing session_replication_role):
  -- In standard Supabase, AWS RDS, GCP Cloud SQL, and non-superuser PostgreSQL
  -- sandboxes, calling `set_config('session_replication_role', 'replica', true)`
  -- or `SET session_replication_role = 'replica'` raises:
  --   ERROR: permission denied to set parameter "session_replication_role"
  -- because session_replication_role requires SUPERUSER privileges (PGC_SUSET).
  -- Furthermore, bypassing all triggers globally masks schema defects and cascades.
  --
  -- Safe, Documented Alternative (Zero trigger alteration / Zero superuser needed):
  -- 1. Profiles table has NO BEFORE INSERT triggers (only BEFORE UPDATE triggers).
  -- 2. Therefore, to establish the initial platform administrator without weakening
  --    or disabling triggers, we cleanly remove the customer record created by
  --    handle_new_user() for v_admin_id and insert the authoritative admin profile.
  -- 3. With v_admin_id established as an administrator, public.is_admin() returns TRUE
  --    under v_admin_id's session context.
  -- 4. We then use the production-hardened public.admin_set_user_role() function
  --    to assign roles to v_designer_id ('designer') and v_pm_id ('project_manager').
  --    This exercises the real production code path through all active UPDATE triggers!
  -- 5. Session claims are strictly cleared immediately after setup so that no
  --    administrative privileges bleed into subsequent test assertions.
  -- ----------------------------------------------------------------------------
  DELETE FROM public.profiles WHERE id = v_admin_id;
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_admin_id, 'admin@decizy.in', 'Platform Administrator', 'admin');

  -- Elevate session context to the newly established administrator
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);

  -- Establish designer and PM roles via the verified administrative function
  PERFORM public.admin_set_user_role(v_designer_id, 'designer');
  PERFORM public.admin_set_user_role(v_pm_id, 'project_manager');

  -- STRICT INVARIANT: Immediately clear administrative session claim so assertions run unprivileged
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- Verification of privileged bootstrap success
  SELECT count(*) INTO v_check_count
  FROM public.profiles
  WHERE (id = v_admin_id AND role = 'admin')
     OR (id = v_designer_id AND role = 'designer')
     OR (id = v_pm_id AND role = 'project_manager');

  IF v_check_count != 3 THEN
    RAISE EXCEPTION 'BOOTSTRAP_FAILURE: Privileged role setup failed to establish initial roles (expected 3, found %).', v_check_count;
  END IF;

  -- ----------------------------------------------------------------------------
  -- TEST GROUP 2: PROFILE ROLE SELF-ELEVATION & IMMUTABILITY
  -- ----------------------------------------------------------------------------
  v_test_title := '2.1 Non-admin customer cannot self-elevate role to admin';
  PERFORM set_config('request.jwt.claim.sub', v_client_id::text, true);
  v_expected_err := FALSE;
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = v_client_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%User role escalation is forbidden%' OR SQLERRM LIKE '%Only platform administrators%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT role INTO v_profile_row.role FROM public.profiles WHERE id = v_client_id;
  IF v_expected_err AND v_profile_row.role = 'customer' THEN
    RAISE NOTICE '✓ PASS [Test 2.1]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 2.1]: Role escalation was not blocked or data changed';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '2.2 Profile ID is immutable';
  v_expected_err := FALSE;
  BEGIN
    UPDATE public.profiles SET id = gen_random_uuid() WHERE id = v_client_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Profile ID cannot be modified%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT count(*) INTO v_check_count FROM public.profiles WHERE id = v_client_id;
  IF v_expected_err AND v_check_count = 1 THEN
    RAISE NOTICE '✓ PASS [Test 2.2]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 2.2]: Primary key modification was not blocked';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '2.3 Email is immutable via direct profile update';
  v_expected_err := FALSE;
  BEGIN
    UPDATE public.profiles SET email = 'hacked@decizy.in' WHERE id = v_client_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Email modifications must be initiated via Supabase Authentication%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT email INTO v_profile_row.email FROM public.profiles WHERE id = v_client_id;
  IF v_expected_err AND v_profile_row.email = 'client@decizy.in' THEN
    RAISE NOTICE '✓ PASS [Test 2.3]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 2.3]: Email modification was not blocked or data changed';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '2.4 Permitted profile updates (name, phone) succeed for user';
  BEGIN
    UPDATE public.profiles 
    SET full_name = 'Verified Client Name', phone = '+91 98765 43210' 
    WHERE id = v_client_id;

    SELECT * INTO v_profile_row FROM public.profiles WHERE id = v_client_id;
    IF v_profile_row.full_name = 'Verified Client Name' AND v_profile_row.phone = '+91 98765 43210' THEN
      RAISE NOTICE '✓ PASS [Test 2.4]: %', v_test_title;
      v_passed := v_passed + 1;
    ELSE
      RAISE WARNING '✗ FAIL [Test 2.4]: Permitted updates did not persist';
      v_failed := v_failed + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '✗ FAIL [Test 2.4]: Unexpected error: %', SQLERRM;
    v_failed := v_failed + 1;
  END;

  v_test_title := '2.5 Admin can assign roles via admin_set_user_role()';
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  BEGIN
    PERFORM public.admin_set_user_role(v_outsider_id, 'designer');
    SELECT role INTO v_profile_row.role FROM public.profiles WHERE id = v_outsider_id;
    IF v_profile_row.role = 'designer' THEN
      RAISE NOTICE '✓ PASS [Test 2.5]: %', v_test_title;
      v_passed := v_passed + 1;
    ELSE
      RAISE WARNING '✗ FAIL [Test 2.5]: Role did not update as expected';
      v_failed := v_failed + 1;
    END IF;
    -- Revert outsider back to customer via administrative function
    PERFORM public.admin_set_user_role(v_outsider_id, 'customer');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '✗ FAIL [Test 2.5]: Unexpected error: %', SQLERRM;
    v_failed := v_failed + 1;
  END;
  -- Strictly clear administrative session claim so assertions run unprivileged
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- ----------------------------------------------------------------------------
  -- TEST GROUP 3: A0 INTAKE FORM DEFENSIVE CONSTRAINTS
  -- ----------------------------------------------------------------------------
  v_test_title := '3.1 Rejects invalid email syntax on A0 intake';
  v_expected_err := FALSE;
  BEGIN
    INSERT INTO public.a0_assessments (
      reference_number, full_name, email, project_type, project_city, approximate_area_sqft, project_stage, budget_range_inr, primary_challenge
    ) VALUES (
      'A0-ERR-1', 'Test Prospect', 'invalid-email-address', 'Residential', 'Bengaluru', 2000, 'Planning', '₹30L', 'Challenge'
    );
  EXCEPTION WHEN check_violation THEN
    v_expected_err := TRUE;
  END;
  SELECT count(*) INTO v_check_count FROM public.a0_assessments WHERE reference_number = 'A0-ERR-1';
  IF v_expected_err AND v_check_count = 0 THEN
    RAISE NOTICE '✓ PASS [Test 3.1]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 3.1]: Malformed email was accepted';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '3.2 Rejects non-positive area on A0 intake';
  v_expected_err := FALSE;
  BEGIN
    INSERT INTO public.a0_assessments (
      reference_number, full_name, email, project_type, project_city, approximate_area_sqft, project_stage, budget_range_inr, primary_challenge
    ) VALUES (
      'A0-ERR-2', 'Test Prospect', 'valid@decizy.in', 'Residential', 'Bengaluru', -500, 'Planning', '₹30L', 'Challenge'
    );
  EXCEPTION WHEN check_violation THEN
    v_expected_err := TRUE;
  END;
  SELECT count(*) INTO v_check_count FROM public.a0_assessments WHERE reference_number = 'A0-ERR-2';
  IF v_expected_err AND v_check_count = 0 THEN
    RAISE NOTICE '✓ PASS [Test 3.2]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 3.2]: Negative area was accepted';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '3.3 Rejects invalid 4-digit PIN code on A0 intake';
  v_expected_err := FALSE;
  BEGIN
    INSERT INTO public.a0_assessments (
      reference_number, full_name, email, postal_code, project_type, project_city, approximate_area_sqft, project_stage, budget_range_inr, primary_challenge
    ) VALUES (
      'A0-ERR-3', 'Test Prospect', 'valid@decizy.in', '5600', 'Residential', 'Bengaluru', 1500, 'Planning', '₹30L', 'Challenge'
    );
  EXCEPTION WHEN check_violation THEN
    v_expected_err := TRUE;
  END;
  SELECT count(*) INTO v_check_count FROM public.a0_assessments WHERE reference_number = 'A0-ERR-3';
  IF v_expected_err AND v_check_count = 0 THEN
    RAISE NOTICE '✓ PASS [Test 3.3]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 3.3]: Invalid Indian PIN was accepted';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '3.4 Accepts well-formed A0 assessment';
  BEGIN
    INSERT INTO public.a0_assessments (
      reference_number, full_name, email, postal_code, project_type, project_city, approximate_area_sqft, project_stage, budget_range_inr, primary_challenge
    ) VALUES (
      'A0-VALID-1', 'Anand Rao', 'anand@decizy.in', '560001', 'Residential', 'Bengaluru', 2800, 'Planning', '₹45L', 'Load-bearing wall question'
    ) RETURNING id INTO v_assessment_id;

    SELECT count(*) INTO v_check_count FROM public.a0_assessments WHERE id = v_assessment_id;
    IF v_check_count = 1 THEN
      RAISE NOTICE '✓ PASS [Test 3.4]: %', v_test_title;
      v_passed := v_passed + 1;
    ELSE
      RAISE WARNING '✗ FAIL [Test 3.4]: Valid A0 insert could not be queried';
      v_failed := v_failed + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '✗ FAIL [Test 3.4]: Valid A0 insert failed unexpectedly: %', SQLERRM;
    v_failed := v_failed + 1;
  END;

  -- ----------------------------------------------------------------------------
  -- TEST GROUP 4: SEED PROJECT & MEMBERSHIP AUTHORIZATION
  -- ----------------------------------------------------------------------------
  INSERT INTO public.projects (
    id, code, title, type, stage, city, postal_code, area_sqft, budget_inr, customer_id, designer_id, project_manager_id
  ) VALUES (
    v_project_id, 'PRJ-TEST-01', 'Indiranagar Residence', 'Residential', 'Design Underway', 'Bengaluru', '560038', 3200, 5000000,
    v_client_id, v_designer_id, v_pm_id
  );

  INSERT INTO public.master_decision_types (
    code, category, name, description, stages, approval_requirements
  ) VALUES 
    ('DEC-01', 'Space Planning', 'Living Room Layout', 'Formal signoff on living room partitions', ARRAY['Design Underway'::project_stage], 'Client approval required'),
    ('DEC-02', 'Joinery', 'Kitchen Cabinetry', 'Modular kitchen specifications', ARRAY['Design Underway'::project_stage], 'Client approval required'),
    ('DEC-03', 'Electrical', 'Lighting Plan', 'Switch and conduit locations', ARRAY['Design Underway'::project_stage], 'PM signoff required');

  v_test_title := '4.1 Designer cannot invite member with admin role';
  PERFORM set_config('request.jwt.claim.sub', v_designer_id::text, true);
  v_expected_err := FALSE;
  BEGIN
    INSERT INTO public.project_members (project_id, user_id, role, invited_by)
    VALUES (v_project_id, v_attacker_id, 'admin', v_designer_id);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%admin role cannot be assigned%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT count(*) INTO v_check_count FROM public.project_members WHERE project_id = v_project_id AND user_id = v_attacker_id;
  IF v_expected_err AND v_check_count = 0 THEN
    RAISE NOTICE '✓ PASS [Test 4.1]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 4.1]: Designer was able to invite an admin';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '4.2 Designer cannot invite member with project_manager role';
  v_expected_err := FALSE;
  BEGIN
    INSERT INTO public.project_members (project_id, user_id, role, invited_by)
    VALUES (v_project_id, v_attacker_id, 'project_manager', v_designer_id);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Designers can only invite customer or designer members%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT count(*) INTO v_check_count FROM public.project_members WHERE project_id = v_project_id AND user_id = v_attacker_id;
  IF v_expected_err AND v_check_count = 0 THEN
    RAISE NOTICE '✓ PASS [Test 4.2]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 4.2]: Designer invited project manager without authority';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '4.3 Project manager successfully invites customer collaborator';
  PERFORM set_config('request.jwt.claim.sub', v_pm_id::text, true);
  BEGIN
    INSERT INTO public.project_members (project_id, user_id, role, invited_by)
    VALUES (v_project_id, v_attacker_id, 'customer', v_pm_id);
    SELECT count(*) INTO v_check_count FROM public.project_members WHERE project_id = v_project_id AND user_id = v_attacker_id AND role = 'customer';
    IF v_check_count = 1 THEN
      RAISE NOTICE '✓ PASS [Test 4.3]: %', v_test_title;
      v_passed := v_passed + 1;
    ELSE
      RAISE WARNING '✗ FAIL [Test 4.3]: Member record was not found after PM invite';
      v_failed := v_failed + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '✗ FAIL [Test 4.3]: PM invite failed: %', SQLERRM;
    v_failed := v_failed + 1;
  END;

  v_test_title := '4.4 Member cannot escalate own role';
  PERFORM set_config('request.jwt.claim.sub', v_attacker_id::text, true);
  v_expected_err := FALSE;
  BEGIN
    UPDATE public.project_members SET role = 'project_manager' WHERE project_id = v_project_id AND user_id = v_attacker_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Self-escalation of project membership roles is prohibited%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT role INTO v_profile_row.role FROM public.project_members WHERE project_id = v_project_id AND user_id = v_attacker_id;
  IF v_expected_err AND v_profile_row.role = 'customer' THEN
    RAISE NOTICE '✓ PASS [Test 4.4]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 4.4]: Member successfully escalated own role';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '4.5 Project manager successfully invites additional customer stakeholder';
  PERFORM set_config('request.jwt.claim.sub', v_pm_id::text, true);
  BEGIN
    INSERT INTO public.project_members (project_id, user_id, role, invited_by)
    VALUES (v_project_id, v_outsider_id, 'customer', v_pm_id);
    SELECT count(*) INTO v_check_count FROM public.project_members WHERE project_id = v_project_id AND user_id = v_outsider_id;
    IF v_check_count = 1 THEN
      RAISE NOTICE '✓ PASS [Test 4.5]: %', v_test_title;
      v_passed := v_passed + 1;
    ELSE
      RAISE WARNING '✗ FAIL [Test 4.5]: Stakeholder invite record not found';
      v_failed := v_failed + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '✗ FAIL [Test 4.5]: Unexpected error: %', SQLERRM;
    v_failed := v_failed + 1;
  END;

  -- ----------------------------------------------------------------------------
  -- TEST GROUP 5: INITIAL DECISION INSERT PROTECTION
  -- ----------------------------------------------------------------------------
  v_test_title := '5.1 Non-admin cannot insert a decision marked directly as Approved';
  PERFORM set_config('request.jwt.claim.sub', v_designer_id::text, true);
  v_expected_err := FALSE;
  BEGIN
    INSERT INTO public.project_decisions (
      project_id, type_code, title, category, stage, status, deadline_date, responsible_role, current_option
    ) VALUES (
      v_project_id, 'DEC-02', 'Kitchen Cabinetry', 'Joinery', 'Design Underway', 'Approved', CURRENT_DATE + 14, 'designer', 'Modern Flat'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Decisions cannot be directly inserted with Approved status%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT count(*) INTO v_check_count FROM public.project_decisions WHERE project_id = v_project_id AND type_code = 'DEC-02';
  IF v_expected_err AND v_check_count = 0 THEN
    RAISE NOTICE '✓ PASS [Test 5.1]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 5.1]: Direct Approved insert was accepted from non-admin';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '5.2 Non-admin insert of Draft decision strips caller-supplied approval attribution';
  PERFORM set_config('request.jwt.claim.sub', v_designer_id::text, true);
  INSERT INTO public.project_decisions (
    project_id, type_code, title, category, stage, status, deadline_date, responsible_role, current_option,
    approved_by, approved_at
  ) VALUES (
    v_project_id, 'DEC-01', 'Living Room Layout', 'Space Planning', 'Design Underway', 'Draft', CURRENT_DATE + 14, 'designer', 'Option A',
    v_attacker_id, '2020-01-01 00:00:00+00'::timestamptz
  ) RETURNING id INTO v_decision_id;

  SELECT * INTO v_decision_row FROM public.project_decisions WHERE id = v_decision_id;
  IF v_decision_row.status = 'Draft' AND v_decision_row.approved_by IS NULL AND v_decision_row.approved_at IS NULL THEN
    RAISE NOTICE '✓ PASS [Test 5.2]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 5.2]: Draft decision retained caller-supplied approval metadata';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '5.3 Administrator direct insert as Approved stamps authentic caller and timestamp';
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  INSERT INTO public.project_decisions (
    project_id, type_code, title, category, stage, status, deadline_date, responsible_role, current_option
  ) VALUES (
    v_project_id, 'DEC-02', 'Kitchen Cabinetry', 'Joinery', 'Design Underway', 'Approved', CURRENT_DATE + 14, 'designer', 'Modern Flat'
  ) RETURNING id INTO v_decision_insert_test_id;

  SELECT * INTO v_decision_row FROM public.project_decisions WHERE id = v_decision_insert_test_id;
  IF v_decision_row.status = 'Approved' 
     AND v_decision_row.approved_by = v_admin_id 
     AND v_decision_row.approved_at > NOW() - INTERVAL '10 seconds' THEN
    RAISE NOTICE '✓ PASS [Test 5.3]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 5.3]: Admin direct Approved insert failed attribution stamping';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '5.4 Administrator cannot direct-insert as Approved referencing non-stakeholder';
  v_expected_err := FALSE;
  BEGIN
    INSERT INTO public.project_decisions (
      project_id, type_code, title, category, stage, status, deadline_date, responsible_role, current_option, approved_by
    ) VALUES (
      v_project_id, 'DEC-03', 'Lighting Plan', 'Electrical', 'Design Underway', 'Approved', CURRENT_DATE + 14, 'designer', 'Warm White',
      gen_random_uuid() -- Non-stakeholder ID
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Administrator proxy approval must reference an authorized project stakeholder%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT count(*) INTO v_check_count FROM public.project_decisions WHERE project_id = v_project_id AND type_code = 'DEC-03';
  IF v_expected_err AND v_check_count = 0 THEN
    RAISE NOTICE '✓ PASS [Test 5.4]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 5.4]: Admin was able to attribute approval to a non-stakeholder on insert';
    v_failed := v_failed + 1;
  END IF;

  -- ----------------------------------------------------------------------------
  -- TEST GROUP 6: DECISION APPROVALS & ATTRIBUTION BOUNDARY (9 COMPREHENSIVE TESTS)
  -- ----------------------------------------------------------------------------

  -- 6.1 Non-stakeholder outsider cannot modify decision
  v_test_title := '6.1 Non-stakeholder outsider cannot modify decision';
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  v_expected_err := FALSE;
  BEGIN
    UPDATE public.project_decisions SET status = 'Approved' WHERE id = v_decision_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Caller is not an authorized team member%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT status INTO v_decision_row.status FROM public.project_decisions WHERE id = v_decision_id;
  IF v_expected_err AND v_decision_row.status = 'Draft' THEN
    RAISE NOTICE '✓ PASS [Test 6.1]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 6.1]: Outsider modified decision without authorization';
    v_failed := v_failed + 1;
  END IF;

  -- 6.2 Path 3: Non-approval update to Draft decision strips attempted approval fields
  v_test_title := '6.2 Non-approval update to Draft decision strips attempted approval fields';
  PERFORM set_config('request.jwt.claim.sub', v_designer_id::text, true);
  UPDATE public.project_decisions
  SET current_option = 'Option B',
      approved_by = v_attacker_id,
      approved_at = NOW()
  WHERE id = v_decision_id;

  SELECT * INTO v_decision_row FROM public.project_decisions WHERE id = v_decision_id;
  IF v_decision_row.status = 'Draft' 
     AND v_decision_row.approved_by IS NULL 
     AND v_decision_row.approved_at IS NULL 
     AND v_decision_row.current_option = 'Option B' THEN
    RAISE NOTICE '✓ PASS [Test 6.2]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 6.2]: Draft decision retained unauthorized approval fields';
    v_failed := v_failed + 1;
  END IF;

  -- 6.3 Path 1: First-time approval stamps authentic caller and timestamp, overriding spoofed ID
  v_test_title := '6.3 First-time approval stamps authentic caller ID and current timestamp';
  PERFORM set_config('request.jwt.claim.sub', v_client_id::text, true);
  UPDATE public.project_decisions
  SET status = 'Approved',
      approved_by = v_attacker_id, -- Spoof attempt
      approved_at = '2020-01-01 00:00:00+00'::timestamptz -- Spoof attempt
  WHERE id = v_decision_id;

  SELECT * INTO v_decision_row FROM public.project_decisions WHERE id = v_decision_id;
  v_original_approved_at := v_decision_row.approved_at;

  IF v_decision_row.status = 'Approved' 
     AND v_decision_row.approved_by = v_client_id 
     AND v_decision_row.approved_at > NOW() - INTERVAL '10 seconds' THEN
    RAISE NOTICE '✓ PASS [Test 6.3]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 6.3]: First-time approval failed to stamp caller or override spoofing';
    v_failed := v_failed + 1;
  END IF;

  -- 6.4 Path 2: Modifying already-approved decision — tampering with approved_by is blocked
  v_test_title := '6.4 Modifying approved decision: tampering with approved_by is blocked';
  PERFORM set_config('request.jwt.claim.sub', v_designer_id::text, true);
  v_expected_err := FALSE;
  BEGIN
    UPDATE public.project_decisions SET approved_by = v_attacker_id WHERE id = v_decision_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Cannot modify approved_by on an already approved decision%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT approved_by INTO v_decision_row.approved_by FROM public.project_decisions WHERE id = v_decision_id;
  IF v_expected_err AND v_decision_row.approved_by = v_client_id THEN
    RAISE NOTICE '✓ PASS [Test 6.4]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 6.4]: approved_by was altered on an already approved decision';
    v_failed := v_failed + 1;
  END IF;

  -- 6.5 Path 2: Modifying already-approved decision — tampering with approved_at is blocked
  v_test_title := '6.5 Modifying approved decision: tampering with approved_at is blocked';
  v_expected_err := FALSE;
  BEGIN
    UPDATE public.project_decisions SET approved_at = '2021-06-15 12:00:00+00'::timestamptz WHERE id = v_decision_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Cannot modify approved_at on an already approved decision%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT approved_at INTO v_decision_row.approved_at FROM public.project_decisions WHERE id = v_decision_id;
  IF v_expected_err AND v_decision_row.approved_at = v_original_approved_at THEN
    RAISE NOTICE '✓ PASS [Test 6.5]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 6.5]: approved_at was altered on an already approved decision';
    v_failed := v_failed + 1;
  END IF;

  -- 6.6 Path 2: Legitimate update on approved decision preserves original approval attribution
  v_test_title := '6.6 Legitimate update on approved decision preserves original approved_by/at';
  UPDATE public.project_decisions
  SET rationale = 'Updated technical notes for contractor'
  WHERE id = v_decision_id;

  SELECT * INTO v_decision_row FROM public.project_decisions WHERE id = v_decision_id;
  IF v_decision_row.status = 'Approved' 
     AND v_decision_row.approved_by = v_client_id 
     AND v_decision_row.approved_at = v_original_approved_at 
     AND v_decision_row.rationale = 'Updated technical notes for contractor' THEN
    RAISE NOTICE '✓ PASS [Test 6.6]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 6.6]: Original approval attribution was corrupted during legitimate update';
    v_failed := v_failed + 1;
  END IF;

  -- 6.7 Path 4: Transitioning away from Approved (to Changes Requested) clears approval fields
  v_test_title := '6.7 Transitioning away from Approved clears approved_by and approved_at';
  PERFORM set_config('request.jwt.claim.sub', v_client_id::text, true);
  UPDATE public.project_decisions
  SET status = 'Changes Requested',
      review_flag_reason = 'Wood finish sample needs re-sampling'
  WHERE id = v_decision_id;

  SELECT * INTO v_decision_row FROM public.project_decisions WHERE id = v_decision_id;
  IF v_decision_row.status = 'Changes Requested' 
     AND v_decision_row.approved_by IS NULL 
     AND v_decision_row.approved_at IS NULL THEN
    RAISE NOTICE '✓ PASS [Test 6.7]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 6.7]: Transition from Approved failed to clear approval metadata';
    v_failed := v_failed + 1;
  END IF;

  -- 6.8 Administrator proxy approval on behalf of valid stakeholder succeeds
  v_test_title := '6.8 Administrator proxy approval on behalf of valid stakeholder succeeds';
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  UPDATE public.project_decisions
  SET status = 'Approved',
      approved_by = v_pm_id -- Proxy approval for project manager
  WHERE id = v_decision_id;

  SELECT * INTO v_decision_row FROM public.project_decisions WHERE id = v_decision_id;
  IF v_decision_row.status = 'Approved' 
     AND v_decision_row.approved_by = v_pm_id 
     AND v_decision_row.approved_at > NOW() - INTERVAL '10 seconds' THEN
    RAISE NOTICE '✓ PASS [Test 6.8]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 6.8]: Admin proxy approval failed to stamp target stakeholder';
    v_failed := v_failed + 1;
  END IF;

  -- 6.9 Structural project_id modification is blocked
  v_test_title := '6.9 Decision project_id is immutable';
  v_expected_err := FALSE;
  BEGIN
    UPDATE public.project_decisions SET project_id = gen_random_uuid() WHERE id = v_decision_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Decision project_id cannot be changed%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT project_id INTO v_decision_row.project_id FROM public.project_decisions WHERE id = v_decision_id;
  IF v_expected_err AND v_decision_row.project_id = v_project_id THEN
    RAISE NOTICE '✓ PASS [Test 6.9]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 6.9]: project_id modification was allowed';
    v_failed := v_failed + 1;
  END IF;

  -- ----------------------------------------------------------------------------
  -- TEST GROUP 7: REVISION & AUDIT IMMUTABILITY
  -- ----------------------------------------------------------------------------
  INSERT INTO public.decision_revisions (
    decision_id, revision_number, title, description, selected_option, rationale, status, changed_by
  ) VALUES (
    v_decision_id, 1, 'Living Room Layout', 'Formal signoff', 'Option A', 'Approved in client design session', 'Approved', v_client_id
  );

  v_test_title := '7.1 Decision revisions cannot be updated';
  v_expected_err := FALSE;
  BEGIN
    UPDATE public.decision_revisions SET selected_option = 'Option Tampered' WHERE decision_id = v_decision_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Decision revisions are immutable legal records%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT selected_option INTO v_decision_row.current_option FROM public.decision_revisions WHERE decision_id = v_decision_id AND revision_number = 1;
  IF v_expected_err AND v_decision_row.current_option = 'Option A' THEN
    RAISE NOTICE '✓ PASS [Test 7.1]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 7.1]: Revision was updated';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '7.2 Decision revisions cannot be deleted';
  v_expected_err := FALSE;
  BEGIN
    DELETE FROM public.decision_revisions WHERE decision_id = v_decision_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Decision revisions are immutable legal records%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT count(*) INTO v_check_count FROM public.decision_revisions WHERE decision_id = v_decision_id;
  IF v_expected_err AND v_check_count = 1 THEN
    RAISE NOTICE '✓ PASS [Test 7.2]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 7.2]: Revision was deleted';
    v_failed := v_failed + 1;
  END IF;

  -- Seed audit log with valid caller
  PERFORM set_config('request.jwt.claim.sub', v_client_id::text, true);
  INSERT INTO public.audit_logs (
    project_id, decision_id, action, actor_id, actor_name, actor_role, details
  ) VALUES (
    v_project_id, v_decision_id, 'REQUEST_CHANGES', v_client_id, 'Client Name', 'customer', 'Requested new sample'
  );

  v_test_title := '7.3 Non-admin cannot forge actor_id on audit entry';
  v_expected_err := FALSE;
  BEGIN
    INSERT INTO public.audit_logs (
      project_id, decision_id, action, actor_id, actor_name, actor_role, details
    ) VALUES (
      v_project_id, v_decision_id, 'FORGED_ENTRY', v_attacker_id, 'Spoofed Name', 'admin', 'Forged log'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Audit actor_id must match authenticated caller%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT count(*) INTO v_check_count FROM public.audit_logs WHERE action = 'FORGED_ENTRY';
  IF v_expected_err AND v_check_count = 0 THEN
    RAISE NOTICE '✓ PASS [Test 7.3]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 7.3]: Forged actor_id was accepted';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '7.4 Audit records cannot be updated';
  v_expected_err := FALSE;
  BEGIN
    UPDATE public.audit_logs SET details = 'Tampered Details' WHERE project_id = v_project_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Historical audit events are immutable%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT details INTO v_decision_row.rationale FROM public.audit_logs WHERE project_id = v_project_id AND action = 'REQUEST_CHANGES';
  IF v_expected_err AND v_decision_row.rationale = 'Requested new sample' THEN
    RAISE NOTICE '✓ PASS [Test 7.4]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 7.4]: Audit log was updated';
    v_failed := v_failed + 1;
  END IF;

  v_test_title := '7.5 Audit records cannot be deleted';
  v_expected_err := FALSE;
  BEGIN
    DELETE FROM public.audit_logs WHERE project_id = v_project_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Historical audit events are immutable%' THEN
      v_expected_err := TRUE;
    END IF;
  END;
  SELECT count(*) INTO v_check_count FROM public.audit_logs WHERE project_id = v_project_id;
  IF v_expected_err AND v_check_count >= 1 THEN
    RAISE NOTICE '✓ PASS [Test 7.5]: %', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 7.5]: Audit log was deleted';
    v_failed := v_failed + 1;
  END IF;

  -- ----------------------------------------------------------------------------
  -- TEST GROUP 8: AUDIT RETENTION ON PROJECT DELETION (ON DELETE RESTRICT)
  -- ----------------------------------------------------------------------------
  v_test_title := '8.1 Project deletion is rejected when audit logs exist';
  v_expected_err := FALSE;
  BEGIN
    DELETE FROM public.projects WHERE id = v_project_id;
  EXCEPTION WHEN foreign_key_violation THEN
    v_expected_err := TRUE;
  END;
  SELECT count(*) INTO v_check_count FROM public.projects WHERE id = v_project_id;
  IF v_expected_err AND v_check_count = 1 THEN
    RAISE NOTICE '✓ PASS [Test 8.1]: % (Blocked by audit_logs foreign key RESTRICT)', v_test_title;
    v_passed := v_passed + 1;
  ELSE
    RAISE WARNING '✗ FAIL [Test 8.1]: Project was deleted, violating audit retention';
    v_failed := v_failed + 1;
  END IF;

  -- ----------------------------------------------------------------------------
  -- TEST SUMMARY
  -- ----------------------------------------------------------------------------
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'TEST EXECUTION COMPLETE: % PASSED | % FAILED (TOTAL: 34)', v_passed, v_failed;
  RAISE NOTICE '=======================================================';

  IF v_failed > 0 THEN
    RAISE EXCEPTION 'TEST_SUITE_ABORT: % of 34 tests failed.', v_failed;
  END IF;
END $$;

-- ==============================================================================
-- SECTION 7: MANDATORY ROLLBACK
-- Discards all test schemas, tables, functions, and seed data
-- ==============================================================================
ROLLBACK;
