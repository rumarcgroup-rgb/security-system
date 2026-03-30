import { useEffect, useRef, useState } from "react";
import { attachSignedUrls } from "../lib/storage";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { clearStoredSupabaseAuth, isRetryableSessionError } from "../lib/authSession";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const hasRetriedSessionRecovery = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!isSupabaseConfigured) {
        if (!mounted) return;
        setAuthError("Supabase environment variables are missing. Check your `.env` configuration.");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        setAuthError("");
        setSession(data.session);
        if (data.session?.user) {
          await fetchProfile(data.session.user.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        if (isRetryableSessionError(error.message || "") && !hasRetriedSessionRecovery.current) {
          hasRetriedSessionRecovery.current = true;
          clearStoredSupabaseAuth();
          await supabase.auth.signOut().catch(() => {});
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

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;

      try {
        setSession(nextSession);
        setAuthError("");
        if (nextSession?.user) {
          await fetchProfile(nextSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        if (!mounted) return;
        setProfile(null);
        setAuthError(error.message || "Unable to refresh session.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
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
    refreshProfile: () => (session?.user ? fetchProfile(session.user.id) : Promise.resolve()),
  };
}
