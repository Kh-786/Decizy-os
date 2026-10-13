import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  url: string | null;
  mode: 'live' | 'demo';
  statusMessage: string;
}

const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  if (url === 'https://your-project.supabase.co' || url.includes('placeholder')) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const isValidKey = (key: string | undefined): boolean => {
  if (!key) return false;
  if (key === 'your-anon-key' || key.includes('placeholder') || key.length < 20) return false;
  return true;
};

export const isSupabaseConfigured = (): boolean => {
  return isValidUrl(supabaseUrl) && isValidKey(supabaseAnonKey);
};

export const getSupabaseConfigStatus = (): SupabaseConfigStatus => {
  const configured = isSupabaseConfigured();
  return {
    isConfigured: configured,
    url: configured ? (supabaseUrl as string) : null,
    mode: configured ? 'live' : 'demo',
    statusMessage: configured
      ? 'Connected to configured Supabase project'
      : 'Running in safe local demonstration mode. Data operates with in-memory persistence and seed data.',
  };
};

let clientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return clientInstance;
};
