import { SupabaseClient } from '@supabase/supabase-js';
import {
  Project,
  ProjectDecision,
  DecisionRevision,
  A0Assessment,
  AuditLogEntry,
  UserProfile,
  UserRole,
} from '../../types';
import { getSupabaseClient } from '../supabase';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: UserRole;
  joinedAt: string;
  email?: string;
  fullName?: string;
}

/**
 * Data mappers between TypeScript camelCase and PostgreSQL snake_case
 */
export const mapDbToProject = (row: any): Project => ({
  id: row.id,
  code: row.code,
  title: row.title,
  description: row.description || '',
  type: row.type,
  stage: row.stage,
  city: row.city,
  postalCode: row.postal_code || undefined,
  areaSqFt: Number(row.area_sqft),
  budgetINR: Number(row.budget_inr),
  spentINR: Number(row.spent_inr),
  customerName: row.customer_name || 'Project Owner',
  customerId: row.customer_id,
  designerName: row.designer_name || 'Lead Designer',
  designerId: row.designer_id || '',
  projectManagerName: row.project_manager_name || 'Project Manager',
  projectManagerId: row.project_manager_id || '',
  serviceTier: row.service_tier || 'A0',
  startDate: row.start_date,
  targetCompletionDate: row.target_completion_date || '',
  activeDecisionsCount: Number(row.active_decisions_count || 0),
  pendingApprovalsCount: Number(row.pending_approvals_count || 0),
  criticalRisksCount: Number(row.critical_risks_count || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapProjectToDb = (p: Project): any => ({
  id: p.id,
  code: p.code,
  title: p.title,
  description: p.description,
  type: p.type,
  stage: p.stage,
  city: p.city,
  postal_code: p.postalCode,
  area_sqft: p.areaSqFt,
  budget_inr: p.budgetINR,
  spent_inr: p.spentINR,
  customer_id: p.customerId,
  designer_id: p.designerId || null,
  project_manager_id: p.projectManagerId || null,
  service_tier: p.serviceTier,
  start_date: p.startDate,
  target_completion_date: p.targetCompletionDate || null,
});

export const mapDbToDecision = (row: any, revisions: DecisionRevision[] = []): ProjectDecision => ({
  id: row.id,
  projectId: row.project_id,
  typeCode: row.type_code,
  title: row.title,
  category: row.category,
  stage: row.stage,
  status: row.status,
  urgency: row.urgency,
  impact: row.impact,
  deadlineDate: row.deadline_date,
  responsibleRole: row.responsible_role,
  assigneeName: row.assignee_name || 'Team Assignee',
  assigneeId: row.assignee_id || '',
  currentOption: row.current_option,
  optionsConsidered: Array.isArray(row.options_considered) ? row.options_considered : [],
  rationale: row.rationale || undefined,
  costImpactINR: Number(row.cost_impact_inr || 0),
  timeImpactDays: Number(row.time_impact_days || 0),
  dependencies: Array.isArray(row.dependencies) ? row.dependencies : [],
  dependents: Array.isArray(row.dependents) ? row.dependents : [],
  flaggedForReview: Boolean(row.flagged_for_review),
  reviewFlagReason: row.review_flag_reason || undefined,
  revisions,
  approvedAt: row.approved_at || undefined,
  approvedBy: row.approved_by || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapDecisionToDb = (d: ProjectDecision): any => ({
  id: d.id,
  project_id: d.projectId,
  type_code: d.typeCode,
  title: d.title,
  category: d.category,
  stage: d.stage,
  status: d.status,
  urgency: d.urgency,
  impact: d.impact,
  deadline_date: d.deadlineDate,
  responsible_role: d.responsibleRole,
  assignee_id: d.assigneeId || null,
  current_option: d.currentOption,
  options_considered: d.optionsConsidered,
  rationale: d.rationale || null,
  cost_impact_inr: d.costImpactINR,
  time_impact_days: d.timeImpactDays,
  flagged_for_review: d.flaggedForReview || false,
  review_flag_reason: d.reviewFlagReason || null,
  approved_at: d.approvedAt || null,
  approved_by: d.approvedBy || null,
});

export const mapDbToAssessment = (row: any): A0Assessment => ({
  id: row.id,
  referenceNumber: row.reference_number,
  fullName: row.full_name,
  email: row.email,
  phone: row.phone || undefined,
  projectType: row.project_type,
  projectCity: row.project_city,
  postalCode: row.postal_code || undefined,
  approximateAreaSqFt: Number(row.approximate_area_sqft),
  projectStage: row.project_stage,
  budgetRangeINR: row.budget_range_inr,
  primaryChallenge: row.primary_challenge,
  decisionNeededSoon: Boolean(row.decision_needed_soon),
  contactConsent: Boolean(row.contact_consent),
  status: row.status,
  submittedAt: row.submitted_at,
});

export const mapAssessmentToDb = (a: A0Assessment): any => ({
  id: a.id,
  reference_number: a.referenceNumber,
  full_name: a.fullName,
  email: a.email,
  phone: a.phone || null,
  project_type: a.projectType,
  project_city: a.projectCity,
  postal_code: a.postalCode || null,
  approximate_area_sqft: a.approximateAreaSqFt,
  project_stage: a.projectStage,
  budget_range_inr: a.budgetRangeINR,
  primary_challenge: a.primaryChallenge,
  decision_needed_soon: a.decisionNeededSoon,
  contact_consent: a.contactConsent,
  status: a.status,
  submitted_at: a.submittedAt,
});

/**
 * Supabase Repositories Suite
 */
export class SupabaseRepositories {
  constructor(private client: SupabaseClient | null = getSupabaseClient()) {}

  private getClient(): SupabaseClient {
    const c = this.client || getSupabaseClient();
    if (!c) {
      throw new Error('Supabase client is not configured or offline.');
    }
    return c;
  }

  // --- Project Repository ---
  async getProjects(): Promise<Project[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to load projects: ${error.message}`);
    return (data || []).map(mapDbToProject);
  }

  async getProjectById(id: string): Promise<Project | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return mapDbToProject(data);
  }

  async createProject(project: Project): Promise<Project> {
    const client = this.getClient();
    const payload = mapProjectToDb(project);
    const { data, error } = await client
      .from('projects')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Database project creation failed: ${error.message}`);
    return mapDbToProject(data);
  }

  async updateProject(project: Project): Promise<Project> {
    const client = this.getClient();
    const payload = mapProjectToDb(project);
    payload.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('projects')
      .update(payload)
      .eq('id', project.id)
      .select()
      .single();

    if (error) throw new Error(`Database project update failed: ${error.message}`);
    return mapDbToProject(data);
  }

  // --- Decision Repository ---
  async getDecisions(projectId?: string): Promise<ProjectDecision[]> {
    const client = this.getClient();
    let query = client.from('project_decisions').select('*');
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: decisionsData, error: decError } = await query;
    if (decError) throw new Error(`Failed to load decisions: ${decError.message}`);

    // Load revisions for these decisions
    const decisionIds = (decisionsData || []).map((d: any) => d.id);
    let revisionsMap = new Map<string, DecisionRevision[]>();

    if (decisionIds.length > 0) {
      const { data: revData } = await client
        .from('decision_revisions')
        .select('*')
        .in('decision_id', decisionIds)
        .order('revision_number', { ascending: false });

      (revData || []).forEach((r: any) => {
        const rev: DecisionRevision = {
          id: r.id,
          decisionId: r.decision_id,
          revisionNumber: Number(r.revision_number),
          title: r.title,
          description: r.description,
          selectedOption: r.selected_option,
          rationale: r.rationale,
          costImpactINR: Number(r.cost_impact_inr),
          timeImpactDays: Number(r.time_impact_days),
          status: r.status,
          changedBy: r.changed_by,
          changedByName: r.changed_by_name || 'Team Member',
          changedByRole: r.changed_by_role || 'designer',
          createdAt: r.created_at,
          comments: r.comments || undefined,
        };
        const list = revisionsMap.get(r.decision_id) || [];
        list.push(rev);
        revisionsMap.set(r.decision_id, list);
      });
    }

    return (decisionsData || []).map((d: any) =>
      mapDbToDecision(d, revisionsMap.get(d.id) || [])
    );
  }

  async saveDecision(decision: ProjectDecision): Promise<ProjectDecision> {
    const client = this.getClient();
    const payload = mapDecisionToDb(decision);
    payload.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('project_decisions')
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to save decision: ${error.message}`);
    return mapDbToDecision(data, decision.revisions);
  }

  async addRevision(revision: DecisionRevision): Promise<DecisionRevision> {
    const client = this.getClient();
    const payload = {
      id: revision.id,
      decision_id: revision.decisionId,
      revision_number: revision.revisionNumber,
      title: revision.title,
      description: revision.description,
      selected_option: revision.selectedOption,
      rationale: revision.rationale,
      cost_impact_inr: revision.costImpactINR,
      time_impact_days: revision.timeImpactDays,
      status: revision.status,
      changed_by: revision.changedBy,
      comments: revision.comments || null,
      created_at: revision.createdAt,
    };

    const { error } = await client.from('decision_revisions').insert(payload);
    if (error) throw new Error(`Failed to record decision revision: ${error.message}`);
    return revision;
  }

  // --- A0 Assessment Repository ---
  async getAssessments(): Promise<A0Assessment[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('a0_assessments')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) throw new Error(`Failed to load A0 assessments: ${error.message}`);
    return (data || []).map(mapDbToAssessment);
  }

  async createAssessment(assessment: A0Assessment): Promise<A0Assessment> {
    const client = this.getClient();
    const payload = mapAssessmentToDb(assessment);
    const { data, error } = await client
      .from('a0_assessments')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to submit A0 assessment to database: ${error.message}`);
    return mapDbToAssessment(data);
  }

  // --- Audit Repository ---
  async getAuditLogs(projectId?: string): Promise<AuditLogEntry[]> {
    const client = this.getClient();
    let query = client.from('audit_logs').select('*').order('timestamp', { ascending: false });
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load audit trail: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      projectId: row.project_id || undefined,
      decisionId: row.decision_id || undefined,
      action: row.action,
      actorId: row.actor_id,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      details: row.details,
      timestamp: row.timestamp,
      metadata: row.metadata || undefined,
    }));
  }

  async appendAuditLog(entry: AuditLogEntry): Promise<AuditLogEntry> {
    const client = this.getClient();
    const payload = {
      id: entry.id,
      project_id: entry.projectId || null,
      decision_id: entry.decisionId || null,
      action: entry.action,
      actor_id: entry.actorId,
      actor_name: entry.actorName,
      actor_role: entry.actorRole,
      details: entry.details,
      metadata: entry.metadata || {},
      timestamp: entry.timestamp,
    };

    const { error } = await client.from('audit_logs').insert(payload);
    if (error) throw new Error(`Failed to append durable audit event: ${error.message}`);
    return entry;
  }

  // --- Project Members Repository ---
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('project_members')
      .select('*, profiles:user_id(email, full_name)')
      .eq('project_id', projectId);

    if (error) throw new Error(`Failed to load project members: ${error.message}`);

    return (data || []).map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      role: row.role,
      joinedAt: row.joined_at,
      email: row.profiles?.email,
      fullName: row.profiles?.full_name,
    }));
  }
}

export const supabaseRepositories = new SupabaseRepositories();
