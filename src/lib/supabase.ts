import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  return undefined;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export type SupabaseConnectionState = 'demo' | 'not_configured' | 'connected' | 'error';

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  state: SupabaseConnectionState;
  url: string | null;
  maskedKey: string | null;
  statusMessage: string;
  lastTestedAt: string | null;
}

const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  const clean = url.trim();
  if (
    clean === 'https://your-project.supabase.co' ||
    clean.includes('placeholder') ||
    clean === ''
  ) {
    return false;
  }
  try {
    const parsed = new URL(clean);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const isValidKey = (key: string | undefined): boolean => {
  if (!key) return false;
  const clean = key.trim();
  if (
    clean === 'your-anon-key-here' ||
    clean === 'your-anon-key' ||
    clean.includes('placeholder') ||
    clean.length < 20
  ) {
    return false;
  }
  return true;
};

export const isSupabaseConfigured = (): boolean => {
  return isValidUrl(supabaseUrl) && isValidKey(supabaseAnonKey);
};

export const maskApiKey = (key: string | undefined): string | null => {
  if (!key || key.length < 8) return null;
  const clean = key.trim();
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
};

export const getSupabaseConfigStatus = (): SupabaseConfigStatus => {
  const configured = isSupabaseConfigured();
  return {
    isConfigured: configured,
    state: configured ? 'connected' : 'demo',
    url: configured ? (supabaseUrl as string).trim() : null,
    maskedKey: configured ? maskApiKey(supabaseAnonKey) : null,
    statusMessage: configured
      ? 'Supabase credentials detected. Live database and authentication available.'
      : 'Running in safe local demonstration mode. Browser LocalStorage persistence active (zero external database writes).',
    lastTestedAt: null,
  };
};

let clientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient(
      (supabaseUrl as string).trim(),
      (supabaseAnonKey as string).trim(),
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
      }
    );
  }

  return clientInstance;
};

/**
 * Harmless connectivity test that verifies network connectivity and database response
 * without performing any mutation or exposing secrets.
 */
export const testSupabaseConnection = async (): Promise<{
  success: boolean;
  state: SupabaseConnectionState;
  latencyMs?: number;
  message: string;
  error?: string;
}> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      state: 'not_configured',
      message: 'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing or configured with placeholder values.',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      state: 'error',
      message: 'Failed to initialize Supabase client instance.',
    };
  }

  const startTime = Date.now();
  try {
    // Harmless lightweight query against public.master_decision_types or auth session
    const { data, error } = await client
      .from('master_decision_types')
      .select('code')
      .limit(1);

    const latencyMs = Date.now() - startTime;

    if (error) {
      // Check if it's a table missing error (meaning DB is connected but migration not applied)
      if (error.code === '42P01') {
        return {
          success: true,
          state: 'connected',
          latencyMs,
          message: 'Connected to Supabase PostgreSQL, but schema tables are not yet migrated (relation master_decision_types does not exist). Apply migration files.',
        };
      }

      return {
        success: false,
        state: 'error',
        latencyMs,
        message: 'Supabase responded with an error.',
        error: error.message,
      };
    }

    return {
      success: true,
      state: 'connected',
      latencyMs,
      message: `Successfully connected to Supabase database (${latencyMs}ms response time).`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Network unreachable';
    return {
      success: false,
      state: 'error',
      message: 'Failed to reach Supabase server. Check network connection and URL.',
      error: errorMsg,
    };
  }
};
