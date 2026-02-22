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

// Debugging log for browser console
if (!supabaseUrl || !supabaseAnonKey) {
  console.group("⚠️ Application Config Warning");
  console.warn("Supabase credentials are missing.");
  console.warn("Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  console.warn("App is running in DEMO/OFFLINE mode. Network requests will fail.");
  console.groupEnd();
} else {
  console.log("✅ Supabase Client Initialized");
}

// Use placeholders if missing to prevent 'supabaseUrl is required' crash during initialization
export const supabase = createClient(
    supabaseUrl || 'https://placeholder-project.supabase.co', 
    supabaseAnonKey || 'placeholder-key'
);