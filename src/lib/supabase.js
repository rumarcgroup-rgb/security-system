import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn("Supabase environment variables are missing.");
}

async function runWithoutBrowserLock(_name, _acquireTimeout, fn) {
  return fn();
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        lock: runWithoutBrowserLock,
        lockAcquireTimeout: 3000,
      },
    })
  : null;
