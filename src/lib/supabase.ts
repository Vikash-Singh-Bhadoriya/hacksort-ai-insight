/**
 * src/lib/supabase.ts
 *
 * Supabase client module.
 *
 * Two exports:
 *   supabase       — anonymous client (browser-safe, subject to RLS)
 *   createServiceClient() — server-only factory using the service-role key
 *
 * Environment variables (Vite convention for browser exposure):
 *   VITE_SUPABASE_URL               - Project URL (safe for browser)
 *   VITE_SUPABASE_PUBLISHABLE_KEY   - anon/public key (safe for browser)
 *
 * Server-only (never exposed to browser, never use VITE_ prefix):
 *   SUPABASE_SERVICE_ROLE_KEY       - bypasses RLS; server functions only
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
 * Subject to Row Level Security policies (anon SELECT only on all tables).
 */
export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

/**
 * Create a Supabase client with the service-role key.
 *
 * IMPORTANT: Call this ONLY inside server functions (createServerFn handlers).
 * The service-role key bypasses RLS and must never be exposed to the browser.
 * Never prefix it with VITE_ or import this function from client-side code.
 *
 * Returns null if the service-role key is not configured, so callers can
 * degrade gracefully rather than crashing.
 */
export function createServiceClient() {
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const url = process.env["VITE_SUPABASE_URL"];

  if (!serviceKey || !url) {
    console.warn(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL is not set. " +
        "Server-side Supabase writes will be unavailable.",
    );
    return null;
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
