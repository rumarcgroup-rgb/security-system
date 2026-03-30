import { useEffect, useRef, useState } from "react";
import { attachSignedUrls } from "../lib/storage";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { clearStoredSupabaseAuth, isRetryableSessionError } from "../lib/authSession";

const AUTH_TIMEOUT_MS = 8000;

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out.`)), AUTH_TIMEOUT_MS);
    }),
  ]);
}

export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const hasRetriedSessionRecovery = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function recoverInvalidSession() {
      clearStoredSupabaseAuth();
      await supabase.auth.signOut().catch(() => {});
      if (!mounted) return;
      setSession(null);
      setProfile(null);
      setAuthError("");
    }

    async function syncSessionState(nextSession) {
      if (!mounted) return;

      try {
        setSession(nextSession);
        setAuthError("");

        if (nextSession?.user) {
          const { error: userError } = await withTimeout(supabase.auth.getUser(), "Refreshing session");
          if (userError) throw userError;
          await withTimeout(fetchProfile(nextSession.user.id), "Refreshing profile");
        } else {
          setProfile(null);
        }
      } catch (error) {
        if (isRetryableSessionError(error.message || "") && !hasRetriedSessionRecovery.current) {
          hasRetriedSessionRecovery.current = true;
          await recoverInvalidSession();
          return;
        }
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setAuthError(error.message || "Unable to refresh session.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    async function init() {
      if (!isSupabaseConfigured) {
        if (!mounted) return;
        setAuthError("Supabase environment variables are missing. Check your `.env` configuration.");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await withTimeout(supabase.auth.getSession(), "Loading session");
        if (error) throw error;
        if (!mounted) return;

        setAuthError("");
        setSession(data.session);
        if (data.session?.user) {
          const { error: userError } = await withTimeout(supabase.auth.getUser(), "Validating session");
          if (userError) throw userError;
          await withTimeout(fetchProfile(data.session.user.id), "Loading profile");
        } else {
          setProfile(null);
        }
      } catch (error) {
        if (isRetryableSessionError(error.message || "") && !hasRetriedSessionRecovery.current) {
          hasRetriedSessionRecovery.current = true;
          await recoverInvalidSession();
          await init();
          return;
        }
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setAuthError(error.message || "Unable to load session.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        void syncSessionState(nextSession);
      }, 0);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;

    let nextProfile = data ?? null;
    if (nextProfile?.avatar_url) {
      const [withSignedAvatar] = await attachSignedUrls([nextProfile], "documents", "avatar_url");
      nextProfile = withSignedAvatar ?? nextProfile;
    }

    setProfile(nextProfile);
    return nextProfile;
  }

  return {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    authError,
    resetSession: async () => {
      await recoverInvalidSession();
      hasRetriedSessionRecovery.current = false;
    },
    refreshProfile: () => (session?.user ? fetchProfile(session.user.id) : Promise.resolve()),
  };
}
