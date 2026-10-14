import {
  Project,
  ProjectDecision,
  A0Assessment,
  AuditLogEntry,
} from '../../types';
import { IDemoStorageService } from './types';
import { demoStorageService } from './demoStorageService';

export interface IProjectRepository {
  getAll(): Project[];
  getById(id: string): Project | undefined;
  create(project: Project): Project;
  update(project: Project): Project;
}

export interface IDecisionRepository {
  getAll(): ProjectDecision[];
  getByProjectId(projectId: string): ProjectDecision[];
  getById(id: string): ProjectDecision | undefined;
  save(decision: ProjectDecision): ProjectDecision;
  saveMany(decisions: ProjectDecision[]): void;
}

export interface IAssessmentRepository {
  getAll(): A0Assessment[];
  create(assessment: A0Assessment): A0Assessment;
}

export interface IAuditRepository {
  getAll(): AuditLogEntry[];
  append(entry: AuditLogEntry): AuditLogEntry;
}

/**
 * Demo repository suite operating through the storage service
 */
export class DemoRepositories {
  constructor(private storage: IDemoStorageService = demoStorageService) {}

  get projectRepo(): IProjectRepository {
    return {
      getAll: () => this.storage.load().projects,
      getById: (id: string) => this.storage.load().projects.find((p) => p.id === id),
      create: (project: Project) => {
        const current = this.storage.load();
        const updated = [project, ...current.projects];
        this.storage.save({ ...current, projects: updated });
        return project;
      },
      update: (project: Project) => {
        const current = this.storage.load();
        const updated = current.projects.map((p) => (p.id === project.id ? project : p));
        this.storage.save({ ...current, projects: updated });
        return project;
      },
    };
  }

  get decisionRepo(): IDecisionRepository {
    return {
      getAll: () => this.storage.load().decisions,
      getByProjectId: (projectId: string) =>
        this.storage.load().decisions.filter((d) => d.projectId === projectId),
      getById: (id: string) => this.storage.load().decisions.find((d) => d.id === id),
      save: (decision: ProjectDecision) => {
        const current = this.storage.load();
        const exists = current.decisions.some((d) => d.id === decision.id);
        const updated = exists
          ? current.decisions.map((d) => (d.id === decision.id ? decision : d))
          : [decision, ...current.decisions];
        this.storage.save({ ...current, decisions: updated });
        return decision;
      },
      saveMany: (decisions: ProjectDecision[]) => {
        const current = this.storage.load();
        const map = new Map<string, ProjectDecision>();
        current.decisions.forEach((d) => map.set(d.id, d));
        decisions.forEach((d) => map.set(d.id, d));
        this.storage.save({ ...current, decisions: Array.from(map.values()) });
      },
    };
  }

  get assessmentRepo(): IAssessmentRepository {
    return {
      getAll: () => this.storage.load().assessments,
      create: (assessment: A0Assessment) => {
        const current = this.storage.load();
        const updated = [assessment, ...current.assessments];
        this.storage.save({ ...current, assessments: updated });
        return assessment;
      },
    };
  }

  get auditRepo(): IAuditRepository {
    return {
      getAll: () => this.storage.load().auditLogs,
      append: (entry: AuditLogEntry) => {
        const current = this.storage.load();
        const updated = [entry, ...current.auditLogs];
        this.storage.save({ ...current, auditLogs: updated });
        return entry;
      },
    };
  }
}

export const demoRepositories = new DemoRepositories(demoStorageService);
