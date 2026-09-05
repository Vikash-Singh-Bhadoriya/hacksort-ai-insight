/**
 * src/lib/supabase.ts
 *
 * Supabase browser/SSR client singleton.
 *
 * Uses the anonymous (publishable) key only — safe to expose to the browser.
 * The service-role key MUST NOT be imported here or in any client-side module.
 *
 * Environment variables (Vite convention):
 *   VITE_SUPABASE_URL               - Project URL from Supabase dashboard
 *   VITE_SUPABASE_PUBLISHABLE_KEY   - anon/public key (safe for browser)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Only warn — the app runs in demo mode without Supabase configured.
  console.warn(
    "[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is not set. " +
      "Supabase features will be unavailable. Add these to .env.local to enable them.",
  );
}

/**
 * Anonymous Supabase client.
 * Safe to use from browser code and SSR.
 * Subject to Row Level Security policies.
 */
export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
