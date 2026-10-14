import {
  Project,
  ProjectDecision,
  A0Assessment,
  AuditLogEntry,
} from '../../types';

export const DECIZY_STORAGE_SCHEMA_VERSION = 1;
export const DECIZY_STORAGE_KEY = 'decizy_demo_store_v1';

export type StorageAvailability = 'available' | 'in_memory_fallback' | 'unavailable';

export interface StorageStatus {
  mode: 'demo_local_storage' | 'in_memory';
  availability: StorageAvailability;
  schemaVersion: number;
  lastSavedAt: string | null;
  projectCount: number;
  decisionCount: number;
  assessmentCount: number;
  auditCount: number;
}

export interface DecizyDemoStoreData {
  version: number;
  lastSavedAt: string;
  projects: Project[];
  decisions: ProjectDecision[];
  assessments: A0Assessment[];
  auditLogs: AuditLogEntry[];
}

export interface IStorageDriver {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  isAvailable(): boolean;
}

export interface IDemoStorageService {
  getStatus(): StorageStatus;
  load(): DecizyDemoStoreData;
  save(data: {
    projects: Project[];
    decisions: ProjectDecision[];
    assessments: A0Assessment[];
    auditLogs: AuditLogEntry[];
  }): boolean;
  exportJson(): string;
  importJson(jsonString: string): {
    success: boolean;
    data?: DecizyDemoStoreData;
    error?: string;
  };
  resetToSeed(): DecizyDemoStoreData;
}
