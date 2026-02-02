import { createClient } from '@supabase/supabase-js';

// Vercel/Vite environment variables must start with VITE_ for client-side access
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase Env Variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
