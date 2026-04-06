import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import Input from "../../components/ui/Input";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { getPortalConfig } from "./portalConfig";
import "./ResetPasswordPage.css";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { portalType } = useParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  const portal = useMemo(() => getPortalConfig(portalType) ?? getPortalConfig("admin"), [portalType]);
  const PortalIcon = portal.icon;

  useEffect(() => {
    let mounted = true;

    async function checkRecoveryState() {
      const hash = window.location.hash || "";
      if (hash.includes("type=recovery")) {
        setIsRecoveryMode(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session?.user) {
        setIsRecoveryMode(true);
      }
    }

    checkRecoveryState();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function requestReset(e) {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      toast.error("Supabase environment variables are missing. Update your .env file first.");
      return;
    }

    if (!email.trim()) {
      toast.error("Please enter your email first.");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password/${portalType || "admin"}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      if (error) throw error;
      toast.success("Password reset link sent. Check your email.");
    } catch (err) {
      toast.error(err?.message || "Unable to send reset email.");
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword(e) {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated successfully.");
      navigate(`/login/${portalType || "admin"}`, { replace: true });
    } catch (err) {
      toast.error(err?.message || "Unable to update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-auth-page reset-password-page">
      <div className="app-auth-overlay reset-password-page__overlay" />
      <div
        className="app-auth-card reset-password-page__card"
        style={{
          "--portal-button-color": portal.theme.buttonColor,
          "--portal-button-hover": portal.theme.buttonHover,
        }}
      >
        <div className={`reset-password-page__hero bg-gradient-to-r ${portal.accentClass}`}>
          <div className="reset-password-page__hero-head">
            <Link to={`/login/${portalType || "admin"}`} className="reset-password-page__back">
              <ArrowLeft size={18} />
            </Link>
            <div className="reset-password-page__hero-center">
              <div className="reset-password-page__hero-pill">
                <PortalIcon size={16} />
                CGROUP
              </div>
              <p className="reset-password-page__hero-copy">{portal.subtitle}</p>
            </div>
            <div className="reset-password-page__hero-spacer" />
          </div>
        </div>

        <div className="reset-password-page__body">
          <h1 className="reset-password-page__title">{portal.resetHeading}</h1>
          <div className={`reset-password-page__accent bg-gradient-to-r ${portal.accentClass}`} />

          {!isRecoveryMode ? (
            <form className="reset-password-page__form" onSubmit={requestReset}>
              <p className="reset-password-page__copy">Enter your account email and we'll send you a password reset link.</p>
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter Email Address"
                className="reset-password-page__input"
              />
              <button className={`reset-password-page__submit ${portal.buttonClass}`} disabled={loading} type="submit">
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          ) : (
            <form className="reset-password-page__form" onSubmit={updatePassword}>
              <p className="reset-password-page__copy">Enter your new password below.</p>
              <Input
                label="New Password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter New Password"
                className="reset-password-page__input"
              />
              <Input
                label="Confirm Password"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                className="reset-password-page__input"
              />
              <button className={`reset-password-page__submit ${portal.buttonClass}`} disabled={loading} type="submit">
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}

          <Link to={`/login/${portalType || "admin"}`} className="reset-password-page__return">
            <ArrowLeft size={14} />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}