-- ==============================================================================
-- DECIZY — SUPABASE POSTGRESQL SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- Master Migration: 20261013000000_initial_decizy_schema.sql
-- Decision-Intelligence Platform for Interior Design & Architecture
-- Target Market: India (INR, Indian PIN Codes, Metric/Sq.Ft)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
