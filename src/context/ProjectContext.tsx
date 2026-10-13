import React, { createContext, useContext, useState } from 'react';
import {
  Project,
  ProjectDecision,
  A0Assessment,
  AuditLogEntry,
  ProjectDocument,
  UserRole,
} from '../types';
import {
  DEMO_PROJECTS,
  DEMO_DECISIONS,
  DEMO_ASSESSMENTS,
  DEMO_DOCUMENTS,
  DEMO_AUDIT_LOGS,
} from '../data/demoData';
import { decisionEngine } from '../services/decisionEngine';

interface ProjectContextType {
  projects: Project[];
  selectedProjectId: string;
  selectedProject: Project | undefined;
  setSelectedProjectId: (id: string) => void;
  decisions: ProjectDecision[];
  assessments: A0Assessment[];
  documents: ProjectDocument[];
  auditLogs: AuditLogEntry[];
  // Actions
  submitA0Assessment: (assessment: Omit<A0Assessment, 'id' | 'referenceNumber' | 'status' | 'submittedAt'>) => A0Assessment;
  approveDecisionAction: (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole },
    selectedOption: string,
    comments?: string
  ) => void;
  rejectDecisionAction: (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole },
    reason: string,
    isFullReject?: boolean
  ) => void;
  applyMaterialChangeAction: (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole },
    changes: {
      newOption: string;
      rationale: string;
      costDeltaINR: number;
      timeDeltaDays: number;
    }
  ) => { flaggedCount: number; message: string };
  submitForReviewAction: (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole }
  ) => void;
  createProjectAction: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'activeDecisionsCount' | 'pendingApprovalsCount' | 'criticalRisksCount'>) => Project;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>(DEMO_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(DEMO_PROJECTS[0].id);
  const [decisions, setDecisions] = useState<ProjectDecision[]>(DEMO_DECISIONS);
  const [assessments, setAssessments] = useState<A0Assessment[]>(DEMO_ASSESSMENTS);
  const [documents] = useState<ProjectDocument[]>(DEMO_DOCUMENTS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(DEMO_AUDIT_LOGS);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const submitA0Assessment = (
    data: Omit<A0Assessment, 'id' | 'referenceNumber' | 'status' | 'submittedAt'>
  ): A0Assessment => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const referenceNumber = `DCZ-A0-2026-${randomSuffix}`;
    const now = new Date().toISOString();

    const newAssessment: A0Assessment = {
      ...data,
      id: `a0-${Date.now()}`,
      referenceNumber,
      status: 'Received',
      submittedAt: now,
      riskSummaryScore: data.decisionNeededSoon ? 'High' : 'Moderate',
      recommendedFirstDecisions: ['DEC-01', 'DEC-02', 'DEC-03'],
    };

    setAssessments((prev) => [newAssessment, ...prev]);

    // Add audit log
    const auditEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      action: 'A0_SUBMISSION_RECEIVED',
      actorId: 'anonymous_client',
      actorName: data.fullName,
      actorRole: 'customer',
      details: `New A0 Decision Check submitted: Reference ${referenceNumber} for ${data.projectCity} (${data.projectType}, ${data.approximateAreaSqFt} sq.ft).`,
      timestamp: now,
    };
    setAuditLogs((prev) => [auditEntry, ...prev]);

    return newAssessment;
  };

  const approveDecisionAction = (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole },
    selectedOption: string,
    comments?: string
  ) => {
    const target = decisions.find((d) => d.id === decisionId);
    if (!target) return;

    const result = decisionEngine.approveDecision(target, actor, selectedOption, comments);

    setDecisions((prev) =>
      prev.map((d) => (d.id === decisionId ? result.updatedDecision : d))
    );

    const logEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      projectId: target.projectId,
      decisionId: target.id,
      ...result.auditEntry,
      actorId: actor.id,
    };
    setAuditLogs((prev) => [logEntry, ...prev]);

    // Update project metrics
    setProjects((prev) =>
      prev.map((p) =>
        p.id === target.projectId
          ? {
              ...p,
              pendingApprovalsCount: Math.max(0, p.pendingApprovalsCount - 1),
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  };

  const rejectDecisionAction = (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole },
    reason: string,
    isFullReject = false
  ) => {
    const target = decisions.find((d) => d.id === decisionId);
    if (!target) return;

    const status = isFullReject ? 'Rejected' : 'Changes Requested';
    const result = decisionEngine.rejectDecision(target, actor, reason, status);

    setDecisions((prev) =>
      prev.map((d) => (d.id === decisionId ? result.updatedDecision : d))
    );

    const logEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      projectId: target.projectId,
      decisionId: target.id,
      ...result.auditEntry,
      actorId: actor.id,
    };
    setAuditLogs((prev) => [logEntry, ...prev]);
  };

  const submitForReviewAction = (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole }
  ) => {
    const target = decisions.find((d) => d.id === decisionId);
    if (!target) return;

    const result = decisionEngine.submitDecision(target, actor);
    setDecisions((prev) =>
      prev.map((d) => (d.id === decisionId ? result.updatedDecision : d))
    );

    const logEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      projectId: target.projectId,
      decisionId: target.id,
      ...result.auditEntry,
      actorId: actor.id,
    };
    setAuditLogs((prev) => [logEntry, ...prev]);
  };

  const applyMaterialChangeAction = (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole },
    changes: {
      newOption: string;
      rationale: string;
      costDeltaINR: number;
      timeDeltaDays: number;
    }
  ) => {
    const target = decisions.find((d) => d.id === decisionId);
    if (!target) return { flaggedCount: 0, message: 'Decision not found' };

    const projectDecisions = decisions.filter((d) => d.projectId === target.projectId);
    const result = decisionEngine.applyMaterialChange(
      target,
      projectDecisions,
      actor,
      changes
    );

    setDecisions((prev) =>
      prev.map((d) => {
        const found = result.affectedDecisions.find((ad) => ad.id === d.id);
        return found || d;
      })
    );

    const logEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      projectId: target.projectId,
      decisionId: target.id,
      ...result.auditEntry,
      actorId: actor.id,
    };
    setAuditLogs((prev) => [logEntry, ...prev]);

    return {
      flaggedCount: result.flaggedDependents.length,
      message: `Revision created. ${result.flaggedDependents.length} downstream decisions flagged for compatibility review.`,
    };
  };

  const createProjectAction = (
    projectData: Omit<
      Project,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'activeDecisionsCount'
      | 'pendingApprovalsCount'
      | 'criticalRisksCount'
    >
  ): Project => {
    const now = new Date().toISOString();
    const newProject: Project = {
      ...projectData,
      id: `prj-${Date.now().toString(36)}`,
      activeDecisionsCount: 0,
      pendingApprovalsCount: 0,
      criticalRisksCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    setProjects((prev) => [newProject, ...prev]);
    setSelectedProjectId(newProject.id);

    const logEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      projectId: newProject.id,
      action: 'PROJECT_CREATED',
      actorId: projectData.customerId,
      actorName: projectData.customerName,
      actorRole: 'customer',
      details: `Project "${newProject.title}" (${newProject.code}) initiated in ${newProject.city} with budget ₹${newProject.budgetINR.toLocaleString('en-IN')}.`,
      timestamp: now,
    };
    setAuditLogs((prev) => [logEntry, ...prev]);

    return newProject;
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProjectId,
        selectedProject,
        setSelectedProjectId,
        decisions,
        assessments,
        documents,
        auditLogs,
        submitA0Assessment,
        approveDecisionAction,
        rejectDecisionAction,
        applyMaterialChangeAction,
        submitForReviewAction,
        createProjectAction,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};
