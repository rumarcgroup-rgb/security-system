import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Eye, EyeOff, Shield, ShieldCheck, UserRound } from "lucide-react";
import Input from "../../components/ui/Input";
import { clearStoredSupabaseAuth, isRetryableSessionError } from "../../lib/authSession";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import employeeCardBackground from "../../assets/front-page.jpg";
import janitorLoginHalfbody from "../../assets/janitor.jpg";
import "./LoginPage.css";

const portalConfigs = {
  "cgroup-access": {
    title: "CGroup Access",
    subtitle: "CGroup Access Portal",
    loginTitle: "CGroup Access Login",
    accentStart: "#f4b400",
    accentEnd: "#d99100",
    buttonColor: "#f4b400",
    buttonHoverColor: "#d89f13",
    badgeBackground: "#fff4cc",
    badgeColor: "#153f91",
    icon: Shield,
  },
  "security-guard": {
    title: "Security Guard",
    subtitle: "Security Guard Portal",
    loginTitle: "Security Guard Login",
    accentStart: "#0d4dc4",
    accentEnd: "#08347d",
    buttonColor: "#0d4dc4",
    buttonHoverColor: "#0a3fa1",
    badgeBackground: "#e8f0ff",
    badgeColor: "#0d4dc4",
    image: "../../assets/sec-icon.png",
    icon: ShieldCheck,
  },
  janitor: {
    title: "Janitor",
    subtitle: "Janitor Portal",
    loginTitle: "Janitor Login",
    accentStart: "#0c8b4d",
    accentEnd: "#0b5f37",
    buttonColor: "#0c8b4d",
    buttonHoverColor: "#0a733f",
    badgeBackground: "#e6fff1",
    badgeColor: "#0c8b4d",
    image: "../../assets/jan-icon.png",
    icon: UserRound,
  },
  admin: {
    title: "Admin",
    subtitle: "Admin Portal",
    loginTitle: "Admin Login",
    accentStart: "#123c94",
    accentEnd: "#0f2459",
    buttonColor: "#123c94",
    buttonHoverColor: "#0f2f74",
    badgeBackground: "#edf2ff",
    badgeColor: "#123c94",
    icon: BriefcaseBusiness,
  },
};

const selectorCards = [
  { key: "cgroup-access", colorClass: "text-[#153f91]", copy: "Access CGroup Portal" },
  { key: "security-guard", colorClass: "text-[#143d86]", copy: "Access Guard Portal" },
  { key: "janitor", colorClass: "text-[#0f7b4d]", copy: "Access Janitor Portal" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { portalType } = useParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
      <div className="login-page login-page--default">
        <div className="login-page__backdrop" />
        <div className="login-selector">
          <div
            className="login-selector__hero"
            style={{
              "--login-hero-image": `url(${employeeCardBackground})`,
            }}
          >
            <div className="login-selector__copy">
              <p className="login-selector__welcome">Welcome to</p>
              <h1 className="login-selector__brand">CGROUP</h1>
              <div className="login-selector__badge">EMPLOYEE PORTAL</div>
              <p className="login-selector__subtitle">Please select your role to continue</p>
            </div>

            <div className="login-selector__cards">
              {selectorCards.map((item) => {
                const config = portalConfigs[item.key];

                return (
                  <Link key={item.key} to={`/login/${item.key}`} className="login-selector__card">
                    <div
                      className="login-selector__card-icon"
                      style={{ background: config.badgeBackground, color: config.badgeColor }}
                    >
                      {config.image ? (
                        <img src={config.image} alt={config.title} className="h-full w-full object-cover" />
                      ) : (
                        <config.icon size={28} />
                      )}
                    </div>
                    <div className="login-selector__card-copy">
                      <p className={`login-selector__card-title ${item.colorClass}`}>{config.title}</p>
                      <p className="login-selector__card-subtitle">{item.copy}</p>
                    </div>
                    <div className="login-selector__card-arrow">
                      <ArrowRight size={20} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="login-selector__footer">
            <span className="login-selector__footer-copy">Secure • Professional • Reliable</span>
            <p className="login-selector__footer-meta">© 2026 CGROUP Services</p>
            <Link to="/login/admin" className="login-selector__footer-link">
              Admin Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const PortalIcon = portal.icon;
  const isSecurityPortal = portalType === "security-guard";
  const isJanitorPortal = portalType === "janitor";
  const isCGroupPortal = portalType === "cgroup-access";
  const isCompactPortal = isJanitorPortal;
  const portalHeroBackground = isSecurityPortal ? null : isJanitorPortal ? janitorLoginHalfbody : employeeCardBackground;
  const portalHeroOverlay = isSecurityPortal
    ? "none"
    : isJanitorPortal
      ? "linear-gradient(180deg, rgba(8,104,58,0.18) 0%, rgba(9,109,62,0.62) 58%, rgba(8,70,43,0.88) 100%)"
      : isCGroupPortal
        ? "linear-gradient(180deg, rgba(244,180,0,0.12) 0%, rgba(21,63,145,0.72) 70%, rgba(16,41,92,0.95) 100%)"
        : "linear-gradient(180deg, rgba(8,56,143,0.1) 0%, rgba(8,56,143,0.68) 72%, rgba(16,41,92,0.95) 100%)";
  const pageClassName = `login-page ${isSecurityPortal ? "login-page--security" : "login-page--default"}`;
  const shellClassName = `login-page__shell ${isCompactPortal ? "login-page__shell--compact" : "login-page__shell--standard"}`;
  const heroClassName = `login-page__hero ${isSecurityPortal ? "login-page__hero--security" : isJanitorPortal ? "login-page__hero--janitor" : "login-page__hero--standard"
    }`;
  const backLinkClassName = `login-page__back-link ${isSecurityPortal ? "login-page__back-link--security" : isJanitorPortal ? "login-page__back-link--janitor" : "login-page__back-link--standard"
    }`;
  const brandChipClassName = `login-page__brand-chip ${isSecurityPortal
    ? "login-page__brand-chip--security"
    : isJanitorPortal
      ? "login-page__brand-chip--janitor"
      : isCGroupPortal
        ? "login-page__brand-chip--cgroup"
        : "login-page__brand-chip--standard"
    }`;
  const brandSubtitleClassName = `login-page__brand-subtitle ${isSecurityPortal
    ? "login-page__brand-subtitle--security"
    : isJanitorPortal
      ? "login-page__brand-subtitle--janitor"
      : isCGroupPortal
        ? "login-page__brand-subtitle--cgroup"
        : "login-page__brand-subtitle--standard"
    }`;
  const heroBodyClassName = `login-page__hero-body ${!isSecurityPortal && !isJanitorPortal ? "login-page__hero-body--standard" : ""}`;
  const contentClassName = `login-page__content ${isSecurityPortal ? "login-page__content--security" : isJanitorPortal ? "login-page__content--janitor" : ""
    }`;
  const titleClassName = `login-page__title ${isJanitorPortal ? "login-page__title--janitor" : ""}`;
  const underlineClassName = `login-page__underline ${isJanitorPortal ? "login-page__underline--janitor" : ""}`;
  const formClassName = `login-page__form ${isJanitorPortal ? "login-page__form--janitor" : ""}`;
  const forgotLinkClassName = `login-page__link login-page__link--forgot ${isJanitorPortal ? "login-page__link--janitor" : ""}`;
  const accountLinkClassName = `login-page__link login-page__link--account ${isJanitorPortal ? "login-page__link--janitor-account" : ""}`;
  const shieldToneClassName = portal.title === "Janitor" ? "text-[#0c8b4d]" : "text-[#0d4dc4]";
  const portalStyle = {
    "--portal-accent-start": portal.accentStart,
    "--portal-accent-end": portal.accentEnd,
    "--portal-button-color": portal.buttonColor,
    "--portal-button-hover": portal.buttonHoverColor,
    "--login-hero-overlay": portalHeroOverlay,
    "--login-hero-image": portalHeroBackground ? `url(${portalHeroBackground})` : "none",
    "--login-hero-position": isJanitorPortal ? "center 12%" : "center",
    "--login-janitor-image": `url(${janitorLoginHalfbody})`,
  };

  return (
    <div className={pageClassName} style={portalStyle}>
      <div className="login-page__backdrop" />
      <div className={shellClassName}>
        <div className={heroClassName}>
          {portalHeroBackground ? <div className="login-page__hero-image" /> : null}

          <div className="login-page__hero-top">
            <Link to="/login" className={backLinkClassName}>
              <ArrowLeft size={18} />
            </Link>
            <div className="login-page__brand">
              <div className={brandChipClassName}>
                <Shield size={16} />
                CGROUP
              </div>
              <p className={brandSubtitleClassName}>{portal.subtitle}</p>
            </div>
            <div className="login-page__hero-spacer" />
          </div>

          <div className={heroBodyClassName}>
            {isSecurityPortal ? (
              <div className="login-page__hero-icon-wrap">
                <div className="login-page__hero-icon-core">
                  <ShieldCheck size={42} />
                </div>
              </div>
            ) : isJanitorPortal ? (
              <div className="login-page__janitor-photo">
                <div className="login-page__janitor-photo-inner" />
              </div>
            ) : (
              <div className="login-page__portal-icon-wrap">
                <div
                  className="login-page__portal-icon"
                  style={{ background: portal.badgeBackground, color: portal.badgeColor }}
                >
                  <PortalIcon size={isCGroupPortal ? 34 : 38} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={contentClassName}>
          <h1 className={titleClassName}>{portal.loginTitle}</h1>
          <div className={underlineClassName} />

          <form className={formClassName} onSubmit={onSubmit}>
            <Input
              label={isJanitorPortal ? "Employee ID" : "Email"}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isJanitorPortal ? "Enter Employee ID" : "Enter Email Address"}
              className="rounded-2xl"
            />
            {isJanitorPortal ? (
              <label className="login-page__password-label">
                <span className="login-page__password-label-text">Password</span>
                <div className="login-page__password-wrap">
                  <input
                    className="login-page__password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="login-page__password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            ) : (
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
            )}
            {formError ? <div className="login-page__error">{formError}</div> : null}
            <button
              className="login-page__submit"
              disabled={loading}
              type="submit"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <Link to={`/reset-password/${portalType || "admin"}`} className={forgotLinkClassName}>
            Forgot Password?
          </Link>

          <Link className={accountLinkClassName} to="/onboarding">
            Need an account? Start onboarding
          </Link>

          <div className="login-page__auth-note">
            <ShieldCheck size={16} className={shieldToneClassName} />
            Authorized Personnel Only
          </div>

          {portalType !== "admin" ? (
            <Link to="/login/admin" className="login-page__admin-link">
              Admin login
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
