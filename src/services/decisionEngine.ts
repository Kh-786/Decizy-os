import { ProjectDecision, DecisionRevision, DecisionStatus, UserRole, MasterDecisionType } from '../types';
import { MASTER_DECISION_TYPES } from '../data/masterDecisions';

export interface DecisionEngineResult {
  updatedDecision: ProjectDecision;
  flaggedDependents: { id: string; title: string; reason: string }[];
  auditEntry: {
    action: string;
    actorRole: UserRole;
    actorName: string;
    details: string;
    timestamp: string;
  };
}

/**
 * Decizy Decision Engine
 * Handles dependency resolution, material revision impact, approval workflows, and risk tracking.
 */
export class DecisionEngine {
  private masterTypesMap: Map<string, MasterDecisionType>;

  constructor() {
    this.masterTypesMap = new Map();
    MASTER_DECISION_TYPES.forEach((item) => {
      this.masterTypesMap.set(item.code, item);
    });
  }

  /**
   * Find all decisions in the project that depend on the given decision (directly or indirectly)
   */
  public findDownstreamDependents(
    decisionCodeOrId: string,
    allDecisions: ProjectDecision[]
  ): ProjectDecision[] {
    const dependents: ProjectDecision[] = [];
    const queue = [decisionCodeOrId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      allDecisions.forEach((dec) => {
        // A decision depends on current if current is in dec.dependencies or matches its typeCode
        const dependsOnCurrent =
          dec.dependencies.includes(current) ||
          dec.dependencies.some((dep) => {
            const master = this.masterTypesMap.get(dep);
            return master && (dep === current || master.code === current);
          });

        if (dependsOnCurrent && !visited.has(dec.id)) {
          dependents.push(dec);
          queue.push(dec.id);
          queue.push(dec.typeCode);
        }
      });
    }

    return dependents;
  }

  /**
   * Submit a decision for review
   */
  public submitDecision(
    decision: ProjectDecision,
    actor: { id: string; name: string; role: UserRole }
  ): DecisionEngineResult {
    const now = new Date().toISOString();
    const updated: ProjectDecision = {
      ...decision,
      status: 'Under Review',
      updatedAt: now,
    };

    return {
      updatedDecision: updated,
      flaggedDependents: [],
      auditEntry: {
        action: 'SUBMIT_FOR_REVIEW',
        actorRole: actor.role,
        actorName: actor.name,
        details: `Decision "${decision.title}" (${decision.typeCode}) submitted for review by ${actor.name} (${actor.role}).`,
        timestamp: now,
      },
    };
  }

  /**
   * Approve a decision
   */
  public approveDecision(
    decision: ProjectDecision,
    actor: { id: string; name: string; role: UserRole },
    selectedOption: string,
    comments?: string
  ): DecisionEngineResult {
    const now = new Date().toISOString();
    const revisionNumber = decision.revisions.length + 1;

    const newRevision: DecisionRevision = {
      id: `rev-${decision.id}-${revisionNumber}`,
      decisionId: decision.id,
      revisionNumber,
      title: decision.title,
      description: decision.rationale || 'Option approved',
      selectedOption,
      rationale: comments || 'Formally approved and signed off.',
      costImpactINR: decision.costImpactINR,
      timeImpactDays: decision.timeImpactDays,
      status: 'Approved',
      changedBy: actor.id,
      changedByName: actor.name,
      changedByRole: actor.role,
      createdAt: now,
      comments,
    };

    const updated: ProjectDecision = {
      ...decision,
      status: 'Approved',
      currentOption: selectedOption,
      flaggedForReview: false,
      reviewFlagReason: undefined,
      approvedAt: now,
      approvedBy: actor.id,
      approvedByName: actor.name,
      revisions: [newRevision, ...decision.revisions],
      updatedAt: now,
    };

    return {
      updatedDecision: updated,
      flaggedDependents: [],
      auditEntry: {
        action: 'APPROVE_DECISION',
        actorRole: actor.role,
        actorName: actor.name,
        details: `Decision "${decision.title}" (${decision.typeCode}) approved with option "${selectedOption}". Signoff by ${actor.name}.`,
        timestamp: now,
      },
    };
  }

  /**
   * Reject a decision or request changes
   */
  public rejectDecision(
    decision: ProjectDecision,
    actor: { id: string; name: string; role: UserRole },
    reason: string,
    status: 'Changes Requested' | 'Rejected' = 'Changes Requested'
  ): DecisionEngineResult {
    const now = new Date().toISOString();
    const revisionNumber = decision.revisions.length + 1;

    const newRevision: DecisionRevision = {
      id: `rev-${decision.id}-${revisionNumber}`,
      decisionId: decision.id,
      revisionNumber,
      title: decision.title,
      description: decision.currentOption,
      selectedOption: 'None',
      rationale: reason,
      costImpactINR: decision.costImpactINR,
      timeImpactDays: decision.timeImpactDays,
      status,
      changedBy: actor.id,
      changedByName: actor.name,
      changedByRole: actor.role,
      createdAt: now,
      comments: reason,
    };

    const updated: ProjectDecision = {
      ...decision,
      status,
      revisions: [newRevision, ...decision.revisions],
      updatedAt: now,
    };

    return {
      updatedDecision: updated,
      flaggedDependents: [],
      auditEntry: {
        action: status === 'Rejected' ? 'REJECT_DECISION' : 'REQUEST_CHANGES',
        actorRole: actor.role,
        actorName: actor.name,
        details: `Decision "${decision.title}" status set to ${status}. Reason: "${reason}".`,
        timestamp: now,
      },
    };
  }

  /**
   * Apply a material change to an existing decision (creates revision & flags downstream dependents)
   */
  public applyMaterialChange(
    decision: ProjectDecision,
    allProjectDecisions: ProjectDecision[],
    actor: { id: string; name: string; role: UserRole },
    changes: {
      newOption: string;
      rationale: string;
      costDeltaINR: number;
      timeDeltaDays: number;
    }
  ): {
    updatedDecision: ProjectDecision;
    affectedDecisions: ProjectDecision[];
    flaggedDependents: { id: string; title: string; reason: string }[];
    auditEntry: {
      action: string;
      actorRole: UserRole;
      actorName: string;
      details: string;
      timestamp: string;
    };
  } {
    const now = new Date().toISOString();
    const revisionNumber = decision.revisions.length + 1;

    const newRevision: DecisionRevision = {
      id: `rev-${decision.id}-${revisionNumber}`,
      decisionId: decision.id,
      revisionNumber,
      title: decision.title,
      description: `Material change to option: ${changes.newOption}`,
      selectedOption: changes.newOption,
      rationale: changes.rationale,
      costImpactINR: decision.costImpactINR + changes.costDeltaINR,
      timeImpactDays: decision.timeImpactDays + changes.timeDeltaDays,
      status: 'Under Review',
      changedBy: actor.id,
      changedByName: actor.name,
      changedByRole: actor.role,
      createdAt: now,
    };

    // The modified decision itself becomes Under Review or Changes Requested
    const updatedDecision: ProjectDecision = {
      ...decision,
      status: 'Under Review',
      currentOption: changes.newOption,
      costImpactINR: Math.max(0, decision.costImpactINR + changes.costDeltaINR),
      timeImpactDays: Math.max(0, decision.timeImpactDays + changes.timeDeltaDays),
      revisions: [newRevision, ...decision.revisions],
      updatedAt: now,
    };

    // Find all downstream dependents
    const downstream = this.findDownstreamDependents(decision.typeCode, allProjectDecisions);
    const flaggedList: { id: string; title: string; reason: string }[] = [];

    const affectedDecisions = allProjectDecisions.map((item) => {
      if (item.id === decision.id) {
        return updatedDecision;
      }

      const isDependent = downstream.some((d) => d.id === item.id);
      if (isDependent) {
        const flagReason = `Upstream decision "${decision.title}" (${decision.typeCode}) had a material specification change to: "${changes.newOption}". Verify compatibility.`;
        flaggedList.push({
          id: item.id,
          title: item.title,
          reason: flagReason,
        });

        return {
          ...item,
          flaggedForReview: true,
          reviewFlagReason: flagReason,
          updatedAt: now,
        };
      }

      return item;
    });

    return {
      updatedDecision,
      affectedDecisions,
      flaggedDependents: flaggedList,
      auditEntry: {
        action: 'MATERIAL_REVISION_APPLIED',
        actorRole: actor.role,
        actorName: actor.name,
        details: `Material change on "${decision.title}": option updated to "${changes.newOption}". Cost impact: ₹${changes.costDeltaINR.toLocaleString('en-IN')}, Time: +${changes.timeDeltaDays}d. ${flaggedList.length} dependent decision(s) flagged for review.`,
        timestamp: now,
      },
    };
  }
}

export const decisionEngine = new DecisionEngine();
