import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Project,
  ProjectDecision,
  A0Assessment,
  AuditLogEntry,
  ProjectDocument,
  UserRole,
} from '../types';
import { DEMO_DOCUMENTS } from '../data/demoData';
import { decisionEngine } from '../services/decisionEngine';
import { demoStorageService } from '../lib/storage/demoStorageService';
import { DecizyDemoStoreData, StorageStatus } from '../lib/storage/types';
import { supabaseRepositories } from '../lib/supabase/repositories';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';

interface ProjectContextType {
  projects: Project[];
  selectedProjectId: string;
  selectedProject: Project | undefined;
  setSelectedProjectId: (id: string) => void;
  decisions: ProjectDecision[];
  assessments: A0Assessment[];
  documents: ProjectDocument[];
  auditLogs: AuditLogEntry[];
  storageStatus: StorageStatus;
  isLoadingData: boolean;
  dbError: string | null;
  clearDbError: () => void;
  // Actions
  submitA0Assessment: (
    assessment: Omit<A0Assessment, 'id' | 'referenceNumber' | 'status' | 'submittedAt'>
  ) => Promise<A0Assessment>;
  approveDecisionAction: (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole },
    selectedOption: string,
    comments?: string
  ) => Promise<void>;
  rejectDecisionAction: (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole },
    reason: string,
    isFullReject?: boolean
  ) => Promise<void>;
  applyMaterialChangeAction: (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole },
    changes: {
      newOption: string;
      rationale: string;
      costDeltaINR: number;
      timeDeltaDays: number;
    }
  ) => Promise<{ flaggedCount: number; message: string }>;
  submitForReviewAction: (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole }
  ) => Promise<void>;
  createProjectAction: (
    project: Omit<
      Project,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'activeDecisionsCount'
      | 'pendingApprovalsCount'
      | 'criticalRisksCount'
    >
  ) => Promise<Project>;
  // Storage operations
  exportDemoData: () => string;
  importDemoData: (jsonString: string) => { success: boolean; error?: string };
  resetDemoData: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authMode, currentUser, supabaseUser } = useAuth();

  // Demo persistent store state
  const [demoStore, setDemoStore] = useState<DecizyDemoStoreData>(() => demoStorageService.load());
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    const loaded = demoStorageService.load();
    return loaded.projects[0]?.id || '';
  });

  // Authenticated state (when authMode === 'authenticated')
  const [authProjects, setAuthProjects] = useState<Project[]>([]);
  const [authDecisions, setAuthDecisions] = useState<ProjectDecision[]>([]);
  const [authAssessments, setAuthAssessments] = useState<A0Assessment[]>([]);
  const [authAuditLogs, setAuthAuditLogs] = useState<AuditLogEntry[]>([]);

  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [documents] = useState<ProjectDocument[]>(DEMO_DOCUMENTS);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>(() => demoStorageService.getStatus());

  const clearDbError = () => setDbError(null);

  // Helper to persist demo state changes
  const persistAndSetDemoStore = useCallback(
    (updater: (prev: DecizyDemoStoreData) => DecizyDemoStoreData) => {
      setDemoStore((prev) => {
        const updated = updater(prev);
        demoStorageService.save(updated);
        setStorageStatus(demoStorageService.getStatus());
        return updated;
      });
    },
    []
  );

  // Load records from Supabase when in authenticated mode
  useEffect(() => {
    if (authMode !== 'authenticated' || !isSupabaseConfigured() || !supabaseUser) {
      // In Demo Mode, use local store
      return;
    }

    let isMounted = true;
    setIsLoadingData(true);
    setDbError(null);

    Promise.all([
      supabaseRepositories.getProjects(),
      supabaseRepositories.getDecisions(),
      supabaseRepositories.getAssessments(),
      supabaseRepositories.getAuditLogs(),
    ])
      .then(([projs, decs, assess, logs]) => {
        if (!isMounted) return;
        setAuthProjects(projs);
        setAuthDecisions(decs);
        setAuthAssessments(assess);
        setAuthAuditLogs(logs);
        if (projs.length > 0) {
          setSelectedProjectId(projs[0].id);
        }
        setIsLoadingData(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Database query failed.';
        setDbError(msg);
        setIsLoadingData(false);
      });

    return () => {
      isMounted = false;
    };
  }, [authMode, supabaseUser]);

  // Determine active dataset based on mode
  const projects = authMode === 'authenticated' ? authProjects : demoStore.projects;
  const decisions = authMode === 'authenticated' ? authDecisions : demoStore.decisions;
  const assessments = authMode === 'authenticated' ? authAssessments : demoStore.assessments;
  const auditLogs = authMode === 'authenticated' ? authAuditLogs : demoStore.auditLogs;

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const submitA0Assessment = async (
    data: Omit<A0Assessment, 'id' | 'referenceNumber' | 'status' | 'submittedAt'>
  ): Promise<A0Assessment> => {
    setDbError(null);
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

    const auditEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      action: 'A0_SUBMISSION_RECEIVED',
      actorId: currentUser.id,
      actorName: data.fullName,
      actorRole: currentUser.role,
      details: `New A0 Decision Check submitted: Reference ${referenceNumber} for ${data.projectCity} (${data.projectType}, ${data.approximateAreaSqFt} sq.ft).`,
      timestamp: now,
    };

    if (authMode === 'authenticated' && isSupabaseConfigured()) {
      try {
        const savedAssessment = await supabaseRepositories.createAssessment(newAssessment);
        setAuthAssessments((prev) => [savedAssessment, ...prev]);
        try {
          await supabaseRepositories.appendAuditLog(auditEntry);
          setAuthAuditLogs((prev) => [auditEntry, ...prev]);
        } catch {
          // Audit log failure handled safely
        }
        return savedAssessment;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Database error during A0 submission.';
        setDbError(msg);
        throw new Error(msg);
      }
    }

    // Demo Mode path
    persistAndSetDemoStore((prev) => ({
      ...prev,
      assessments: [newAssessment, ...prev.assessments],
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));

    return newAssessment;
  };

  const approveDecisionAction = async (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole },
    selectedOption: string,
    comments?: string
  ): Promise<void> => {
    setDbError(null);
    const target = decisions.find((d) => d.id === decisionId);
    if (!target) return;

    const result = decisionEngine.approveDecision(target, actor, selectedOption, comments);
    const logEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      projectId: target.projectId,
      decisionId: target.id,
      ...result.auditEntry,
      actorId: actor.id,
    };

    if (authMode === 'authenticated' && isSupabaseConfigured()) {
      try {
        await supabaseRepositories.saveDecision(result.updatedDecision);
        if (result.updatedDecision.revisions.length > 0) {
          await supabaseRepositories.addRevision(result.updatedDecision.revisions[0]);
        }
        await supabaseRepositories.appendAuditLog(logEntry);

        setAuthDecisions((prev) =>
          prev.map((d) => (d.id === decisionId ? result.updatedDecision : d))
        );
        setAuthAuditLogs((prev) => [logEntry, ...prev]);
        setAuthProjects((prev) =>
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
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to approve decision in database.';
        setDbError(msg);
        throw new Error(msg);
      }
    }

    // Demo Mode path
    persistAndSetDemoStore((prev) => ({
      ...prev,
      decisions: prev.decisions.map((d) => (d.id === decisionId ? result.updatedDecision : d)),
      auditLogs: [logEntry, ...prev.auditLogs],
      projects: prev.projects.map((p) =>
        p.id === target.projectId
          ? {
              ...p,
              pendingApprovalsCount: Math.max(0, p.pendingApprovalsCount - 1),
              updatedAt: new Date().toISOString(),
            }
          : p
      ),
    }));
  };

  const rejectDecisionAction = async (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole },
    reason: string,
    isFullReject = false
  ): Promise<void> => {
    setDbError(null);
    const target = decisions.find((d) => d.id === decisionId);
    if (!target) return;

    const status = isFullReject ? 'Rejected' : 'Changes Requested';
    const result = decisionEngine.rejectDecision(target, actor, reason, status);

    const logEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      projectId: target.projectId,
      decisionId: target.id,
      ...result.auditEntry,
      actorId: actor.id,
    };

    if (authMode === 'authenticated' && isSupabaseConfigured()) {
      try {
        await supabaseRepositories.saveDecision(result.updatedDecision);
        if (result.updatedDecision.revisions.length > 0) {
          await supabaseRepositories.addRevision(result.updatedDecision.revisions[0]);
        }
        await supabaseRepositories.appendAuditLog(logEntry);

        setAuthDecisions((prev) =>
          prev.map((d) => (d.id === decisionId ? result.updatedDecision : d))
        );
        setAuthAuditLogs((prev) => [logEntry, ...prev]);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Database rejection action failed.';
        setDbError(msg);
        throw new Error(msg);
      }
    }

    // Demo Mode path
    persistAndSetDemoStore((prev) => ({
      ...prev,
      decisions: prev.decisions.map((d) => (d.id === decisionId ? result.updatedDecision : d)),
      auditLogs: [logEntry, ...prev.auditLogs],
    }));
  };

  const submitForReviewAction = async (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole }
  ): Promise<void> => {
    setDbError(null);
    const target = decisions.find((d) => d.id === decisionId);
    if (!target) return;

    const result = decisionEngine.submitDecision(target, actor);
    const logEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      projectId: target.projectId,
      decisionId: target.id,
      ...result.auditEntry,
      actorId: actor.id,
    };

    if (authMode === 'authenticated' && isSupabaseConfigured()) {
      try {
        await supabaseRepositories.saveDecision(result.updatedDecision);
        await supabaseRepositories.appendAuditLog(logEntry);
        setAuthDecisions((prev) =>
          prev.map((d) => (d.id === decisionId ? result.updatedDecision : d))
        );
        setAuthAuditLogs((prev) => [logEntry, ...prev]);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to submit decision for review.';
        setDbError(msg);
        throw new Error(msg);
      }
    }

    // Demo Mode path
    persistAndSetDemoStore((prev) => ({
      ...prev,
      decisions: prev.decisions.map((d) => (d.id === decisionId ? result.updatedDecision : d)),
      auditLogs: [logEntry, ...prev.auditLogs],
    }));
  };

  const applyMaterialChangeAction = async (
    decisionId: string,
    actor: { id: string; name: string; role: UserRole },
    changes: {
      newOption: string;
      rationale: string;
      costDeltaINR: number;
      timeDeltaDays: number;
    }
  ): Promise<{ flaggedCount: number; message: string }> => {
    setDbError(null);
    const target = decisions.find((d) => d.id === decisionId);
    if (!target) return { flaggedCount: 0, message: 'Decision not found' };

    const projectDecisions = decisions.filter((d) => d.projectId === target.projectId);
    const result = decisionEngine.applyMaterialChange(
      target,
      projectDecisions,
      actor,
      changes
    );

    const logEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      projectId: target.projectId,
      decisionId: target.id,
      ...result.auditEntry,
      actorId: actor.id,
    };

    if (authMode === 'authenticated' && isSupabaseConfigured()) {
      try {
        await supabaseRepositories.saveDecision(result.updatedDecision);
        if (result.updatedDecision.revisions.length > 0) {
          await supabaseRepositories.addRevision(result.updatedDecision.revisions[0]);
        }
        // Save flagged dependents
        for (const aff of result.affectedDecisions) {
          if (aff.id !== result.updatedDecision.id) {
            await supabaseRepositories.saveDecision(aff);
          }
        }
        await supabaseRepositories.appendAuditLog(logEntry);

        setAuthDecisions((prev) =>
          prev.map((d) => {
            const found = result.affectedDecisions.find((ad) => ad.id === d.id);
            return found || d;
          })
        );
        setAuthAuditLogs((prev) => [logEntry, ...prev]);

        return {
          flaggedCount: result.flaggedDependents.length,
          message: `Material revision saved to Supabase. ${result.flaggedDependents.length} downstream decisions flagged for engineering review.`,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Database error during material change.';
        setDbError(msg);
        throw new Error(msg);
      }
    }

    // Demo Mode path
    persistAndSetDemoStore((prev) => ({
      ...prev,
      decisions: prev.decisions.map((d) => {
        const found = result.affectedDecisions.find((ad) => ad.id === d.id);
        return found || d;
      }),
      auditLogs: [logEntry, ...prev.auditLogs],
    }));

    return {
      flaggedCount: result.flaggedDependents.length,
      message: `Revision created. ${result.flaggedDependents.length} downstream decisions flagged for compatibility review.`,
    };
  };

  const createProjectAction = async (
    projectData: Omit<
      Project,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'activeDecisionsCount'
      | 'pendingApprovalsCount'
      | 'criticalRisksCount'
    >
  ): Promise<Project> => {
    setDbError(null);
    const now = new Date().toISOString();
    const newProject: Project = {
      ...projectData,
      id: `prj-${Date.now().toString(36)}`,
      customerId: currentUser.id, // Strictly link to authenticated user id
      customerName: currentUser.fullName,
      activeDecisionsCount: 0,
      pendingApprovalsCount: 0,
      criticalRisksCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const logEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      projectId: newProject.id,
      action: 'PROJECT_CREATED',
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      details: `Project "${newProject.title}" (${newProject.code}) initiated in ${newProject.city} with budget ₹${newProject.budgetINR.toLocaleString('en-IN')}.`,
      timestamp: now,
    };

    if (authMode === 'authenticated' && isSupabaseConfigured()) {
      try {
        const created = await supabaseRepositories.createProject(newProject);
        await supabaseRepositories.appendAuditLog(logEntry);
        setAuthProjects((prev) => [created, ...prev]);
        setAuthAuditLogs((prev) => [logEntry, ...prev]);
        setSelectedProjectId(created.id);
        return created;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Database project creation failed.';
        setDbError(msg);
        throw new Error(msg);
      }
    }

    // Demo Mode path
    persistAndSetDemoStore((prev) => ({
      ...prev,
      projects: [newProject, ...prev.projects],
      auditLogs: [logEntry, ...prev.auditLogs],
    }));

    setSelectedProjectId(newProject.id);
    return newProject;
  };

  const exportDemoData = useCallback((): string => {
    return demoStorageService.exportJson();
  }, []);

  const importDemoData = useCallback((jsonString: string): { success: boolean; error?: string } => {
    const result = demoStorageService.importJson(jsonString);
    if (result.success && result.data) {
      setDemoStore(result.data);
      if (result.data.projects.length > 0) {
        setSelectedProjectId(result.data.projects[0].id);
      }
      setStorageStatus(demoStorageService.getStatus());
      return { success: true };
    }
    return { success: false, error: result.error || 'Failed to import demo data.' };
  }, []);

  const resetDemoData = useCallback((): void => {
    const fresh = demoStorageService.resetToSeed();
    setDemoStore(fresh);
    if (fresh.projects.length > 0) {
      setSelectedProjectId(fresh.projects[0].id);
    }
    setStorageStatus(demoStorageService.getStatus());
  }, []);

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
        storageStatus,
        isLoadingData,
        dbError,
        clearDbError,
        submitA0Assessment,
        approveDecisionAction,
        rejectDecisionAction,
        applyMaterialChangeAction,
        submitForReviewAction,
        createProjectAction,
        exportDemoData,
        importDemoData,
        resetDemoData,
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
