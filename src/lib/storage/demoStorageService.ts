import {
  DecizyDemoStoreData,
  DECIZY_STORAGE_KEY,
  DECIZY_STORAGE_SCHEMA_VERSION,
  IDemoStorageService,
  IStorageDriver,
  StorageStatus,
} from './types';
import { demoStorePayloadSchema } from './schema';
import {
  DEMO_PROJECTS,
  DEMO_DECISIONS,
  DEMO_ASSESSMENTS,
  DEMO_AUDIT_LOGS,
} from '../../data/demoData';
import { Project, ProjectDecision, A0Assessment, AuditLogEntry } from '../../types';

/**
 * Browser LocalStorage driver with exception protection (e.g. Incognito quota limits)
 */
export class BrowserLocalStorageDriver implements IStorageDriver {
  isAvailable(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    try {
      const testKey = '__decizy_storage_probe__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[Decizy Storage] Failed to write to localStorage:', e);
    }
  }

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/**
 * In-memory storage driver for Node.js environments, unit tests, or quota failures
 */
export class MemoryStorageDriver implements IStorageDriver {
  private store: Map<string, string> = new Map();

  isAvailable(): boolean {
    return true;
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

/**
 * Deep copy helper to avoid mutating seed data
 */
function cloneDeep<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Returns fresh seed state
 */
export function getInitialSeedData(): DecizyDemoStoreData {
  return {
    version: DECIZY_STORAGE_SCHEMA_VERSION,
    lastSavedAt: new Date().toISOString(),
    projects: cloneDeep(DEMO_PROJECTS),
    decisions: cloneDeep(DEMO_DECISIONS),
    assessments: cloneDeep(DEMO_ASSESSMENTS),
    auditLogs: cloneDeep(DEMO_AUDIT_LOGS),
  };
}

export class DemoStorageService implements IDemoStorageService {
  private driver: IStorageDriver;
  private memoryCache: DecizyDemoStoreData | null = null;
  private key: string;

  constructor(driver?: IStorageDriver, storageKey: string = DECIZY_STORAGE_KEY) {
    if (driver) {
      this.driver = driver;
    } else {
      const browserDriver = new BrowserLocalStorageDriver();
      this.driver = browserDriver.isAvailable() ? browserDriver : new MemoryStorageDriver();
    }
    this.key = storageKey;
  }

  getStatus(): StorageStatus {
    const isLocal = this.driver instanceof BrowserLocalStorageDriver && this.driver.isAvailable();
    const current = this.load();

    return {
      mode: isLocal ? 'demo_local_storage' : 'in_memory',
      availability: isLocal ? 'available' : 'in_memory_fallback',
      schemaVersion: DECIZY_STORAGE_SCHEMA_VERSION,
      lastSavedAt: current.lastSavedAt,
      projectCount: current.projects.length,
      decisionCount: current.decisions.length,
      assessmentCount: current.assessments.length,
      auditCount: current.auditLogs.length,
    };
  }

  load(): DecizyDemoStoreData {
    if (this.memoryCache) {
      return this.memoryCache;
    }

    const raw = this.driver.getItem(this.key);
    if (!raw) {
      // First boot: initialize seed data and save it
      const seed = getInitialSeedData();
      this.memoryCache = seed;
      this.driver.setItem(this.key, JSON.stringify(seed));
      return seed;
    }

    try {
      const parsed = JSON.parse(raw);
      const validation = demoStorePayloadSchema.safeParse(parsed);

      if (validation.success) {
        this.memoryCache = validation.data as DecizyDemoStoreData;
        return this.memoryCache;
      } else {
        console.warn(
          '[Decizy Storage] Stored data did not match current schema version. Recovering to clean seed data.',
          validation.error.issues
        );
        const seed = getInitialSeedData();
        this.memoryCache = seed;
        this.driver.setItem(this.key, JSON.stringify(seed));
        return seed;
      }
    } catch (err) {
      console.warn('[Decizy Storage] Corrupted JSON found in storage. Recovering to clean seed data:', err);
      const seed = getInitialSeedData();
      this.memoryCache = seed;
      this.driver.setItem(this.key, JSON.stringify(seed));
      return seed;
    }
  }

  save(data: {
    projects: Project[];
    decisions: ProjectDecision[];
    assessments: A0Assessment[];
    auditLogs: AuditLogEntry[];
  }): boolean {
    const payload: DecizyDemoStoreData = {
      version: DECIZY_STORAGE_SCHEMA_VERSION,
      lastSavedAt: new Date().toISOString(),
      projects: data.projects,
      decisions: data.decisions,
      assessments: data.assessments,
      auditLogs: data.auditLogs,
    };

    try {
      const serialized = JSON.stringify(payload);
      this.driver.setItem(this.key, serialized);
      this.memoryCache = payload;
      return true;
    } catch (e) {
      console.error('[Decizy Storage] Failed to serialize and save demo store:', e);
      return false;
    }
  }

  exportJson(): string {
    const current = this.load();
    // Exclude any sensitive metadata if present, format cleanly
    return JSON.stringify(current, null, 2);
  }

  importJson(jsonString: string): {
    success: boolean;
    data?: DecizyDemoStoreData;
    error?: string;
  } {
    try {
      const parsed = JSON.parse(jsonString);
      const validation = demoStorePayloadSchema.safeParse(parsed);

      if (!validation.success) {
        const issuesSummary = validation.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
          .join('; ');
        return {
          success: false,
          error: `Invalid Decizy demo export schema (${issuesSummary})`,
        };
      }

      const validatedData = validation.data as DecizyDemoStoreData;
      // Update lastSavedAt to current import timestamp
      validatedData.lastSavedAt = new Date().toISOString();

      this.driver.setItem(this.key, JSON.stringify(validatedData));
      this.memoryCache = validatedData;

      return {
        success: true,
        data: validatedData,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON formatting';
      return {
        success: false,
        error: `JSON parsing failed: ${msg}`,
      };
    }
  }

  resetToSeed(): DecizyDemoStoreData {
    const freshSeed = getInitialSeedData();
    this.driver.setItem(this.key, JSON.stringify(freshSeed));
    this.memoryCache = freshSeed;
    return freshSeed;
  }
}

// Singleton storage manager instance for the app
export const demoStorageService = new DemoStorageService();
