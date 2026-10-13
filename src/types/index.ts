/**
 * Decizy Core Domain Types
 * Decision-Intelligence Platform for Interior Design & Architecture
 */

export type UserRole = 
  | 'customer'          // Project Owner / Client
  | 'designer'          // Interior Designer / Architect
  | 'project_manager'   // Project Manager (Execution & Timeline)
  | 'admin';            // Decizy Administrator

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  companyName?: string;
  city?: string;
  created_at: string;
}

export type ProjectType = 
  | 'Residential' 
  | 'Commercial' 
  | 'Hospitality' 
  | 'Retail' 
  | 'Office' 
  | 'Other';

export type ProjectStage = 
  | 'Planning' 
  | 'Design Underway' 
  | 'Execution' 
  | 'Renovation' 
  | 'Handover'
  | 'Other';

export type DecisionStatus = 
  | 'Draft' 
  | 'Submitted' 
  | 'Under Review' 
  | 'Changes Requested' 
  | 'Approved' 
  | 'Rejected' 
  | 'Superseded';

export type UrgencyLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type ImpactLevel = 'Low' | 'Medium' | 'High' | 'Severe';

export interface DecisionCategory {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface MasterDecisionType {
  code: string; // e.g., 'DEC-01', 'DEC-12'
  category: string; // e.g., 'Space Planning', 'Civil & Structural', 'MEP'
  name: string;
  description: string;
  stages: ProjectStage[];
  requiredInputs: string[];
  expectedOutputs: string[];
  dependencies: string[]; // Codes of prerequisite decisions
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  riskIndicators: string[];
  responsibleRole: UserRole;
  approvalRequirements: string;
  documentRequirements: string[];
  suggestedNextAction: string;
  version: number;
}

export interface DecisionRevision {
  id: string;
  decisionId: string;
  revisionNumber: number;
  title: string;
  description: string;
  selectedOption: string;
  rationale: string;
  costImpactINR: number;
  timeImpactDays: number;
  status: DecisionStatus;
  changedBy: string; // User ID
  changedByName: string;
  changedByRole: UserRole;
  createdAt: string;
  comments?: string;
}

export interface ProjectDecision {
  id: string;
  projectId: string;
  typeCode: string; // Reference to MasterDecisionType code
  title: string;
  category: string;
  stage: ProjectStage;
  status: DecisionStatus;
  urgency: UrgencyLevel;
  impact: ImpactLevel;
  deadlineDate: string; // YYYY-MM-DD
  responsibleRole: UserRole;
  assigneeName: string;
  assigneeId: string;
  currentOption: string;
  optionsConsidered: {
    id: string;
    title: string;
    description: string;
    estimatedCostINR: number;
    pros: string[];
    cons: string[];
    isRecommended?: boolean;
  }[];
  rationale?: string;
  costImpactINR: number;
  timeImpactDays: number;
  dependencies: string[]; // Decision IDs or Codes in this project
  dependents: string[];   // Decision IDs waiting on this one
  flaggedForReview?: boolean; // Set true if an upstream approved decision changed
  reviewFlagReason?: string;
  revisions: DecisionRevision[];
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  decisionId?: string;
  name: string;
  type: 'Drawing' | 'BOQ' | 'Specification' | 'Approval Signoff' | 'Site Photo' | 'Invoice';
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
  version: number;
}

export interface Project {
  id: string;
  code: string; // e.g. PRJ-BLR-001
  title: string;
  description: string;
  type: ProjectType;
  stage: ProjectStage;
  city: string;
  postalCode?: string;
  areaSqFt: number;
  budgetINR: number;
  spentINR: number;
  customerName: string;
  customerId: string;
  designerName: string;
  designerId: string;
  projectManagerName: string;
  projectManagerId: string;
  serviceTier: 'A0' | 'A1' | 'B1' | 'C1';
  startDate: string;
  targetCompletionDate: string;
  activeDecisionsCount: number;
  pendingApprovalsCount: number;
  criticalRisksCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface A0Assessment {
  id: string;
  referenceNumber: string; // e.g., DCZ-A0-2026-8941
  fullName: string;
  email: string;
  phone?: string;
  projectType: ProjectType;
  projectCity: string;
  postalCode?: string;
  approximateAreaSqFt: number;
  projectStage: ProjectStage;
  budgetRangeINR: string;
  primaryChallenge: string;
  decisionNeededSoon: boolean;
  contactConsent: boolean;
  status: 'Received' | 'Reviewed' | 'Converted_To_Project' | 'Archived';
  submittedAt: string;
  ipAddressRedacted?: string;
  riskSummaryScore?: 'Low' | 'Moderate' | 'High';
  recommendedFirstDecisions?: string[];
}

export interface AuditLogEntry {
  id: string;
  projectId?: string;
  decisionId?: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  details: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ServiceTierConfig {
  id: 'A0' | 'A1' | 'B1' | 'C1';
  name: string;
  badge: string;
  subtitle: string;
  basePriceINR: number;
  isFree: boolean;
  billingType: 'one-time' | 'monthly' | 'project';
  features: string[];
  selldoneProductId?: string;
}

export interface SelldoneOrderPayload {
  orderId: string;
  shopId: string; // 2906
  customerEmail: string;
  customerName: string;
  serviceCode: 'A0' | 'A1' | 'B1' | 'C1';
  amountINR: number;
  currency: 'INR';
  paymentStatus: 'PAID' | 'PENDING' | 'REFUNDED' | 'FAILED';
  gatewayTransactionId?: string;
  createdAt: string;
}
