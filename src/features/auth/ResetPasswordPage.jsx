import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, BriefcaseBusiness, ShieldCheck, UserRound } from "lucide-react";
import Input from "../../components/ui/Input";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

const portalConfigs = {
  "security-guard": {
    title: "Security Guard",
    subtitle: "Security Guard Portal",
    heading: "Reset Security Guard Password",
    accentClass: "from-[#0d4dc4] to-[#08347d]",
    buttonClass: "bg-[#0d4dc4] hover:bg-[#0a3fa1]",
    badgeClass: "bg-[#e8f0ff] text-[#0d4dc4]",
    icon: ShieldCheck,
  },
  janitor: {
    title: "Janitor",
    subtitle: "Janitor Portal",
    heading: "Reset Janitor Password",
    accentClass: "from-[#0c8b4d] to-[#0b5f37]",
    buttonClass: "bg-[#0c8b4d] hover:bg-[#0a733f]",
    badgeClass: "bg-[#e6fff1] text-[#0c8b4d]",
    icon: UserRound,
  },
  admin: {
    title: "Admin",
    subtitle: "Admin Portal",
    heading: "Reset Admin Password",
    accentClass: "from-[#123c94] to-[#0f2459]",
    buttonClass: "bg-[#123c94] hover:bg-[#0f2f74]",
    badgeClass: "bg-[#edf2ff] text-[#123c94]",
    icon: BriefcaseBusiness,
  },
};

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { portalType } = useParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  const portal = useMemo(() => portalConfigs[portalType] ?? portalConfigs.admin, [portalType]);
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#e0efff_0%,#f4f8ff_26%,#dce8f7_100%)] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(12,74,110,0.18),transparent_32%)]" />
      <div className="relative w-full max-w-[430px] overflow-hidden rounded-[34px] border border-white/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.22)]">
        <div className={`bg-gradient-to-r ${portal.accentClass} px-5 pb-5 pt-4 text-white`}>
          <div className="flex items-center justify-between gap-3">
            <Link to={`/login/${portalType || "admin"}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
              <ArrowLeft size={18} />
            </Link>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-bold tracking-[0.04em]">
                <PortalIcon size={16} />
                CGROUP
              </div>
              <p className="mt-1 text-xs font-medium text-white/80">{portal.subtitle}</p>
            </div>
            <div className="h-9 w-9" />
          </div>
        </div>

        <div className="px-5 pb-6 pt-5">
          <h1 className="text-[1.9rem] font-black tracking-[-0.03em] text-slate-800">{portal.heading}</h1>
          <div className={`mt-2 h-1 w-24 rounded-full bg-gradient-to-r ${portal.accentClass}`} />

          {!isRecoveryMode ? (
            <form className="mt-5 space-y-3" onSubmit={requestReset}>
              <p className="text-sm text-slate-500">Enter your account email and we’ll send you a password reset link.</p>
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter Email Address"
                className="rounded-2xl"
              />
              <button
                className={`w-full rounded-2xl px-4 py-3 text-base font-bold text-white shadow-[0_16px_28px_rgba(15,23,42,0.16)] transition ${portal.buttonClass}`}
                disabled={loading}
                type="submit"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          ) : (
            <form className="mt-5 space-y-3" onSubmit={updatePassword}>
              <p className="text-sm text-slate-500">Enter your new password below.</p>
              <Input
                label="New Password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter New Password"
                className="rounded-2xl"
              />
              <Input
                label="Confirm Password"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                className="rounded-2xl"
              />
              <button
                className={`w-full rounded-2xl px-4 py-3 text-base font-bold text-white shadow-[0_16px_28px_rgba(15,23,42,0.16)] transition ${portal.buttonClass}`}
                disabled={loading}
                type="submit"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}

          <Link to={`/login/${portalType || "admin"}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
            <ArrowLeft size={14} />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
