import { z } from 'zod';
import { DECIZY_STORAGE_SCHEMA_VERSION } from './types';

/**
 * Validation schemas for storage envelopes and exports/imports
 */

export const storedProjectSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  type: z.enum(['Residential', 'Commercial', 'Hospitality', 'Retail', 'Office', 'Other']),
  stage: z.enum(['Planning', 'Design Underway', 'Execution', 'Renovation', 'Handover', 'Other']),
  city: z.string(),
  postalCode: z.string().optional(),
  areaSqFt: z.number().nonnegative(),
  budgetINR: z.number().nonnegative(),
  spentINR: z.number().nonnegative(),
  customerName: z.string(),
  customerId: z.string(),
  designerName: z.string(),
  designerId: z.string(),
  projectManagerName: z.string(),
  projectManagerId: z.string(),
  serviceTier: z.enum(['A0', 'A1', 'B1', 'C1']),
  startDate: z.string(),
  targetCompletionDate: z.string(),
  activeDecisionsCount: z.number().nonnegative(),
  pendingApprovalsCount: z.number().nonnegative(),
  criticalRisksCount: z.number().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const storedRevisionSchema = z.object({
  id: z.string(),
  decisionId: z.string(),
  revisionNumber: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  selectedOption: z.string(),
  rationale: z.string(),
  costImpactINR: z.number(),
  timeImpactDays: z.number(),
  status: z.enum(['Draft', 'Submitted', 'Under Review', 'Changes Requested', 'Approved', 'Rejected', 'Superseded']),
  changedBy: z.string(),
  changedByName: z.string(),
  changedByRole: z.enum(['customer', 'designer', 'project_manager', 'admin']),
  createdAt: z.string(),
  comments: z.string().optional(),
});

export const storedDecisionSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  typeCode: z.string().min(1),
  title: z.string().min(1),
  category: z.string(),
  stage: z.enum(['Planning', 'Design Underway', 'Execution', 'Renovation', 'Handover', 'Other']),
  status: z.enum(['Draft', 'Submitted', 'Under Review', 'Changes Requested', 'Approved', 'Rejected', 'Superseded']),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']),
  impact: z.enum(['Low', 'Medium', 'High', 'Severe']),
  deadlineDate: z.string(),
  responsibleRole: z.enum(['customer', 'designer', 'project_manager', 'admin']),
  assigneeName: z.string(),
  assigneeId: z.string(),
  currentOption: z.string(),
  optionsConsidered: z.array(z.any()),
  rationale: z.string().optional(),
  costImpactINR: z.number(),
  timeImpactDays: z.number(),
  dependencies: z.array(z.string()),
  dependents: z.array(z.string()),
  flaggedForReview: z.boolean().optional(),
  reviewFlagReason: z.string().optional(),
  revisions: z.array(storedRevisionSchema),
  approvedAt: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedByName: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const storedAssessmentSchema = z.object({
  id: z.string().min(1),
  referenceNumber: z.string().min(1),
  fullName: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  projectType: z.enum(['Residential', 'Commercial', 'Hospitality', 'Retail', 'Office', 'Other']),
  projectCity: z.string(),
  postalCode: z.string().optional(),
  approximateAreaSqFt: z.number().nonnegative(),
  projectStage: z.enum(['Planning', 'Design Underway', 'Execution', 'Renovation', 'Handover', 'Other']),
  budgetRangeINR: z.string(),
  primaryChallenge: z.string(),
  decisionNeededSoon: z.boolean(),
  contactConsent: z.boolean(),
  status: z.enum(['Received', 'Reviewed', 'Converted_To_Project', 'Archived']),
  submittedAt: z.string(),
  riskSummaryScore: z.enum(['Low', 'Moderate', 'High']).optional(),
  recommendedFirstDecisions: z.array(z.string()).optional(),
});

export const storedAuditLogSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().optional(),
  decisionId: z.string().optional(),
  action: z.string(),
  actorId: z.string(),
  actorName: z.string(),
  actorRole: z.enum(['customer', 'designer', 'project_manager', 'admin']),
  details: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const demoStorePayloadSchema = z.object({
  version: z.number().int().min(1).max(DECIZY_STORAGE_SCHEMA_VERSION),
  lastSavedAt: z.string(),
  projects: z.array(storedProjectSchema),
  decisions: z.array(storedDecisionSchema),
  assessments: z.array(storedAssessmentSchema),
  auditLogs: z.array(storedAuditLogSchema),
});

export type ValidatedDemoStorePayload = z.infer<typeof demoStorePayloadSchema>;
