"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

/**
 * Centralized auth hook — uses getUser() for secure server-side validation
 * instead of getSession() which only reads from local storage.
 *
 * Returns the access_token for API calls and the verified user object.
 */

export function useAuth() {
  // Resolved per render rather than at module scope: during prerender the
  // getter hands back a placeholder, and we want the real client once the
  // component is running in the browser.
  const supabase = getSupabaseBrowserClient();

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        // 1. Verify user with Supabase Auth server (secure)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        setUser(user);

        // 2. Get session for access_token (only after user is verified)
        const { data: { session } } = await supabase.auth.getSession();
        setToken(session?.access_token ?? null);
      } catch (err) {
        console.error("Auth initialization failed:", err);
      } finally {
        setLoading(false);
      }
    }
    init();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setToken(session?.access_token ?? null);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Get a fresh token — useful when token might have expired.
   * Throws an error if no session exists (user not logged in).
   */
  const getToken = useCallback(async (): Promise<string> => {
    // If still initializing, wait briefly for the session to be populated
    if (loading) {
      // In a real app we'd wait for a promise, but a short delay handles the race condition
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const freshToken = session?.access_token;
      if (freshToken) {
        setToken(freshToken);
        return freshToken;
      }
    } catch (err) {
      console.warn("Failed to refresh token:", err);
    }
    
    if (token) return token;
    
    throw new Error("Authentication token not found");
  }, [token, loading]);

  return { token, user, loading, getToken, supabase };
}
