import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared browser-side Supabase client.
 *
 * `createBrowserClient` throws immediately when the URL or anon key is missing.
 * Calling it directly in a component body (or at module scope) therefore blew
 * up during `next build`, because static prerendering evaluates client
 * components on the server where those vars may be unset — the production
 * build could not complete without build-time secrets, and `docker compose
 * build` with the default empty NEXT_PUBLIC_* values failed outright.
 *
 * This getter defers the failure to the point of use: prerender can construct
 * it safely, and a genuinely misconfigured deployment gets a clear error the
 * moment it tries to talk to Supabase.
 */

let cached: SupabaseClient | null = null;

const MISSING_CONFIG_MESSAGE =
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY (they are baked in at build time).";

function unconfiguredClient(): SupabaseClient {
  // Throws on first property access rather than on construction.
  return new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(MISSING_CONFIG_MESSAGE);
    },
  });
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return unconfiguredClient();
  }

  cached = createBrowserClient(url, anonKey);
  return cached;
}

/** @deprecated Use getSupabaseBrowserClient() — it memoizes and is prerender-safe. */
export const createClient = getSupabaseBrowserClient;
