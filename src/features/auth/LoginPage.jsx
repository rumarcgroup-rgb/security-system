import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, Shield, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { clearStoredSupabaseAuth, isRetryableSessionError } from "../../lib/authSession";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import employeeCardBackground from "../../assets/employee-card-bg.jpg";
import securityGuardLoginBackground from "../../assets/security-guard-login-bg.png";

const portalConfigs = {
  "security-guard": {
    title: "Security Guard",
    subtitle: "Security Guard Portal",
    loginTitle: "Security Guard Login",
    accentClass: "from-[#0d4dc4] to-[#08347d]",
    buttonClass: "bg-[#0d4dc4] hover:bg-[#0a3fa1]",
    badgeClass: "bg-[#e8f0ff] text-[#0d4dc4]",
    icon: ShieldCheck,
    description: "Access guard portal",
  },
  janitor: {
    title: "Janitor",
    subtitle: "Janitor Portal",
    loginTitle: "Janitor Login",
    accentClass: "from-[#0c8b4d] to-[#0b5f37]",
    buttonClass: "bg-[#0c8b4d] hover:bg-[#0a733f]",
    badgeClass: "bg-[#e6fff1] text-[#0c8b4d]",
    icon: UserRound,
    description: "Access janitor portal",
  },
  admin: {
    title: "Admin",
    subtitle: "Admin Portal",
    loginTitle: "Admin Login",
    accentClass: "from-[#123c94] to-[#0f2459]",
    buttonClass: "bg-[#123c94] hover:bg-[#0f2f74]",
    badgeClass: "bg-[#edf2ff] text-[#123c94]",
    icon: BriefcaseBusiness,
    description: "Access admin portal",
  },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { portalType } = useParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const portal = useMemo(() => {
    if (!portalType) return null;
    return portalConfigs[portalType] ?? portalConfigs.admin;
  }, [portalType]);

  useEffect(() => {
    let active = true;

    async function redirectAuthenticatedUser() {
      if (!isSupabaseConfigured) return;

      const { data, error } = await supabase.auth.getSession();
      if (!active || error) return;

      if (data.session?.user) {
        navigate("/", { replace: true });
      }
    }

    redirectAuthenticatedUser();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (!isSupabaseConfigured) {
      const message = "Supabase environment variables are missing. Update your .env file first.";
      setFormError(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      toast.success("Welcome back!");
      navigate("/", { replace: true });
    } catch (err) {
      const message = err?.message || "Authentication failed";

      if (isRetryableSessionError(message)) {
        clearStoredSupabaseAuth();
        await supabase.auth.signOut().catch(() => { });
      }

      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!portal) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#e0efff_0%,#f4f8ff_26%,#dce8f7_100%)] p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(12,74,110,0.18),transparent_32%)]" />
        <div className="relative w-full max-w-[430px] overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,#0d4ab4_0%,#0b357f_55%,#0a2e6a_100%)] shadow-[0_28px_80px_rgba(15,23,42,0.3)]">
          <div
            className="relative overflow-hidden px-5 pb-7 pt-5"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(13,74,180,0.12) 0%, rgba(13,74,180,0.66) 68%, rgba(10,46,106,0.95) 100%), url(${employeeCardBackground})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(255,255,255,0.18),transparent_35%)]" />
            <div className="relative mx-auto flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-white/90 ring-1 ring-white/20">
              <Sparkles size={12} />
              CGROUP CARES
            </div>

            <div className="relative mt-4 text-center text-white">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/30 bg-white/15 shadow-[0_16px_28px_rgba(7,18,53,0.28)] backdrop-blur-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-[#123f91]">
                  <Shield size={34} />
                </div>
              </div>
              <p className="mt-5 text-[15px] font-medium text-white/88">Welcome to</p>
              <h1 className="mt-1 text-[2rem] font-black tracking-[-0.03em]">CGROUP</h1>
              <div className="mx-auto mt-3 w-fit rounded-2xl bg-[#ffcc3f] px-5 py-2 text-lg font-black tracking-[0.05em] text-[#17386e] shadow-[0_12px_24px_rgba(255,204,63,0.28)]">
                EMPLOYEE PORTAL
              </div>
              <p className="mt-4 text-sm text-white/80">Please select your role to continue</p>
            </div>

            <div className="relative mt-5 space-y-3">
              {[
                { key: "security-guard", colorClass: "text-[#143d86]", copy: "Access Guard Portal" },
                { key: "janitor", colorClass: "text-[#0f7b4d]", copy: "Access Janitor Portal" },
              ].map((item) => {
                const config = portalConfigs[item.key];
                const Icon = config.icon;

                return (
                  <Link
                    key={item.key}
                    to={`/login/${item.key}`}
                    className="flex items-center gap-3 rounded-[26px] bg-white p-4 shadow-[0_18px_34px_rgba(4,17,50,0.22)] transition hover:-translate-y-0.5"
                  >
                    <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${config.badgeClass}`}>
                      <Icon size={28} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[2rem] font-black leading-none tracking-[-0.03em] ${item.colorClass}`}>{config.title}</p>
                      <p className="mt-1 text-sm font-medium text-slate-500">{item.copy}</p>
                    </div>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ffcc3f] text-[#17386e] shadow-md">
                      <ArrowRight size={20} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/10 bg-[#0a2d67] px-5 py-4 text-center text-sm font-semibold text-white/92">
            Secure • Professional • Reliable
            <p className="mt-1 text-xs font-medium text-white/65">© 2026 CGROUP Services</p>
            <Link to="/login/admin" className="mt-3 inline-flex text-xs font-semibold text-white/85 underline-offset-4 hover:underline">
              Admin Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const PortalIcon = portal.icon;
  const portalHeroBackground = portalType === "security-guard" ? securityGuardLoginBackground : employeeCardBackground;
  const portalHeroOverlay =
    portalType === "security-guard"
      ? "linear-gradient(180deg, rgba(13,77,196,0.18) 0%, rgba(13,77,196,0.58) 58%, rgba(8,52,125,0.84) 100%)"
      : "linear-gradient(180deg, rgba(8,56,143,0.1) 0%, rgba(8,56,143,0.68) 72%, rgba(16,41,92,0.95) 100%)";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#e0efff_0%,#f4f8ff_26%,#dce8f7_100%)] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(12,74,110,0.18),transparent_32%)]" />
      <div className="relative w-full max-w-[430px] overflow-hidden rounded-[34px] border border-white/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.22)]">
        <div
          className="px-5 pb-5 pt-4 text-white"
          style={{
            backgroundImage: `${portalHeroOverlay}, url(${portalHeroBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <Link to="/login" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
              <ArrowLeft size={18} />
            </Link>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-bold tracking-[0.04em]">
                <Shield size={16} />
                CGROUP
              </div>
              <p className="mt-1 text-xs font-medium text-white/80">{portal.subtitle}</p>
            </div>
            <div className="h-9 w-9" />
          </div>

          <div className="mt-4 rounded-[24px] bg-white/12 p-4 backdrop-blur-sm">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-white/30 bg-white/10 shadow-[0_14px_26px_rgba(9,20,54,0.22)]">
              <div className={`flex h-20 w-20 items-center justify-center rounded-full ${portal.badgeClass}`}>
                <PortalIcon size={38} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 pb-6 pt-5">
          <h1 className="text-[2rem] font-black tracking-[-0.03em] text-slate-800">{portal.loginTitle}</h1>
          <div className={`mt-2 h-1 w-24 rounded-full bg-gradient-to-r ${portal.accentClass}`} />

          <form className="mt-5 space-y-3" onSubmit={onSubmit}>
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter Email Address"
              className="rounded-2xl"
            />
            <Input
              label="Password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Password"
              className="rounded-2xl"
            />
            {formError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {formError}
              </div>
            ) : null}
            <button
              className={`w-full rounded-2xl px-4 py-3 text-base font-bold text-white shadow-[0_16px_28px_rgba(15,23,42,0.16)] transition ${portal.buttonClass}`}
              disabled={loading}
              type="submit"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <Link className="mt-4 block text-center text-sm font-bold text-slate-600 hover:text-slate-800 hover:underline" to="/onboarding">
            Need an account? Start onboarding
          </Link>
          <Link
            to={`/reset-password/${portalType || "admin"}`}
            className="mt-3 block text-center text-sm font-bold text-slate-600 hover:text-slate-800 hover:underline"
          >
            Forgot Password?
          </Link>

          <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-slate-600">
            <ShieldCheck size={16} className={portal.title === "Janitor" ? "text-[#0c8b4d]" : "text-[#0d4dc4]"} />
            Authorized Personnel Only
          </div>

          {portalType !== "admin" ? (
            <Link to="/login/admin" className="mt-2 block text-sm font-medium text-brand-600 hover:underline">
              Admin login
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
