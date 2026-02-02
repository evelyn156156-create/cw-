import { createClient } from '@supabase/supabase-js';

// Safe retrieval of environment variables for both Client (Vite) and Server (Node/Vercel) contexts
const getEnvVar = (key: string): string => {
    try {
        // Vite / Client Side
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
            // @ts-ignore
            return import.meta.env[key];
        }
    } catch (e) {
        // ignore
    }

    try {
        // Node / Server Side fallback
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key];
        }
    } catch (e) {
        // ignore
    }
    
    return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase credentials missing. The app will load in demo mode but data fetching will fail. Please check your .env file or Vercel settings.");
}

// Use placeholders if missing to prevent 'supabaseUrl is required' crash during initialization
// This prevents the White Screen of Death if env vars are not set yet.
export const supabase = createClient(
    supabaseUrl || 'https://placeholder-project.supabase.co', 
    supabaseAnonKey || 'placeholder-key'
);