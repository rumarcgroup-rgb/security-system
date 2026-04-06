import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Shield, ShieldCheck } from "lucide-react";
import Input from "../../components/ui/Input";
import { clearStoredSupabaseAuth, isRetryableSessionError } from "../../lib/authSession";
import { saveEmployeePortalType } from "../../lib/employeePortal";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import employeeCardBackground from "../../assets/front-page.jpg";
import janitorLoginHalfbody from "../../assets/janitor.jpg";
import securityGuardHalfBody from "../../assets/security-guard-half-body.png";
import cgroupHeroLogo from "../../assets/employee-card-bg.jpg";
import { getPortalConfig, portalConfigs, selectorItems } from "./portalConfig";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { portalType } = useParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const portal = useMemo(() => getPortalConfig(portalType), [portalType]);

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
      saveEmployeePortalType(portalType);
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
      <div className="app-auth-page login-page login-page--default">
        <div className="app-auth-overlay login-page__backdrop" />
        <div className="login-selector">
          <div
            className="login-selector__hero"
            style={{
              "--login-hero-image": `url(${employeeCardBackground})`,
            }}
          >
            <div className="login-selector__copy">
              <div className="login-selector__badge">EMPLOYEE PORTAL</div>
              <p className="login-selector__subtitle">Please select your role to continue</p>
            </div>

            <div className="login-selector__cards">
              {selectorItems.map((item) => {
                const config = portalConfigs[item.key];
                const image = config.image;
                const Icon = config.icon;

                return (
                  <Link key={item.key} to={`/login/${item.key}`} className="login-selector__card">
                    <div className={`login-selector__card-icon ${config.badgeClass}`}>
                      {image ? <img src={image} alt={config.title} /> : <Icon size={28} />}
                    </div>
                    <div className="login-selector__card-copy">
                      <p className={`login-selector__card-title ${item.titleClass}`}>{config.title}</p>
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
            <span className="login-selector__footer-copy">Secure / Professional / Reliable</span>
            <p className="login-selector__footer-meta">(c) 2026 CGROUP Services</p>
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
  const isEmployeePhotoPortal = isCGroupPortal || isSecurityPortal || isJanitorPortal;
  const portalHeroBackground = isJanitorPortal
    ? janitorLoginHalfbody
    : isSecurityPortal
      ? securityGuardHalfBody
      : isCGroupPortal
        ? cgroupHeroLogo
        : isEmployeePhotoPortal
          ? employeeCardBackground
          : null;
  const portalHeroOverlay = isSecurityPortal
    ? "linear-gradient(180deg, rgba(7,52,126,0.22) 0%, rgba(12,73,184,0.48) 44%, rgba(8,52,125,0.74) 100%)"
    : isJanitorPortal
      ? "linear-gradient(180deg, rgba(8,104,58,0.18) 0%, rgba(9,109,62,0.62) 58%, rgba(8,70,43,0.88) 100%)"
      : isCGroupPortal
        ? "radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 55%)"
        : "linear-gradient(180deg, rgba(8,56,143,0.1) 0%, rgba(8,56,143,0.68) 72%, rgba(16,41,92,0.95) 100%)";
  const portalHeroPosition = isJanitorPortal ? "center 12%" : isSecurityPortal ? "center top" : isCGroupPortal ? "center 68%" : "center";
  const portalHeroSize = isCGroupPortal ? "72% auto" : "cover";
  const portalHeroRepeat = isCGroupPortal ? "no-repeat" : "no-repeat";

  const pageClassName = `login-page ${isSecurityPortal ? "login-page--security" : "login-page--default"}`;
  const shellClassName = `login-page__shell ${isEmployeePhotoPortal ? "login-page__shell--photo" : "login-page__shell--standard"}`;
  const heroClassName = `login-page__hero ${isEmployeePhotoPortal ? "login-page__hero--photo" : isSecurityPortal ? "login-page__hero--security" : "login-page__hero--standard"
    }`;
  const backLinkClassName = `login-page__back-link ${isEmployeePhotoPortal ? "login-page__back-link--photo" : isSecurityPortal ? "login-page__back-link--security" : "login-page__back-link--standard"
    }`;
  const brandChipClassName = `login-page__brand-chip ${isSecurityPortal
    ? "login-page__brand-chip--photo"
    : isJanitorPortal
      ? "login-page__brand-chip--janitor"
      : isCGroupPortal
        ? "login-page__brand-chip--photo"
        : "login-page__brand-chip--standard"
    }`;
  const brandSubtitleClassName = `login-page__brand-subtitle ${isEmployeePhotoPortal
    ? "login-page__brand-subtitle--photo"
    : "login-page__brand-subtitle--standard"
    }`;
  const heroBodyClassName = `login-page__hero-body${isEmployeePhotoPortal ? " login-page__hero-body--photo" : " login-page__hero-body--standard"}`;
  const contentClassName = `login-page__content ${isEmployeePhotoPortal ? "login-page__content--photo" : isSecurityPortal ? "login-page__content--security" : "login-page__content--standard"
    }`;
  const titleClassName = `login-page__title${isEmployeePhotoPortal ? " login-page__title--photo" : ""}`;
  const underlineClassName = `login-page__underline${isEmployeePhotoPortal ? " login-page__underline--photo" : ""}`;
  const formClassName = `login-page__form${isEmployeePhotoPortal ? " login-page__form--photo" : ""}`;
  const forgotLinkClassName = `login-page__link login-page__link--forgot${isEmployeePhotoPortal ? " login-page__link--photo" : ""}`;
  const accountLinkClassName = `login-page__link login-page__link--account${isEmployeePhotoPortal ? " login-page__link--photo-account" : ""}`;
  const authNoteIconClassName = isJanitorPortal ? "text-[#0c8b4d]" : isCGroupPortal ? "text-[#153f91]" : "text-[#0d4dc4]";

  return (
    <div className={`app-auth-page ${pageClassName}`}>
      <div className="app-auth-overlay login-page__backdrop" />
      <div className={`app-auth-card ${shellClassName}`}>
        <div
          className={heroClassName}
          style={{
            "--login-hero-image": portalHeroBackground ? `url('${portalHeroBackground}')` : "none",
            "--login-hero-overlay": portalHeroOverlay,
            "--login-hero-position": portalHeroPosition,
            "--login-hero-size": portalHeroSize,
            "--login-hero-repeat": portalHeroRepeat,
            "--portal-accent-start": portal.theme.accentStart,
            "--portal-accent-end": portal.theme.accentEnd,
            "--portal-button-color": portal.theme.buttonColor,
            "--portal-button-hover": portal.theme.buttonHover,
          }}
        >
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
            {!isEmployeePhotoPortal && isSecurityPortal ? (
              <div className="login-page__hero-icon-wrap">
                <div className="login-page__hero-icon-core">
                  <ShieldCheck size={42} />
                </div>
              </div>
            ) : !isEmployeePhotoPortal ? (
              <div className="login-page__portal-icon-wrap">
                <div className={`login-page__portal-icon ${portal.badgeClass}`}>
                  <PortalIcon size={isCGroupPortal ? 34 : 38} />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className={contentClassName}>
          <h1 className={titleClassName}>{portal.loginTitle}</h1>
          <div className={`bg-gradient-to-r ${portal.accentClass} ${underlineClassName}`} />

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

            <button className={`login-page__submit ${portal.buttonClass}`} disabled={loading} type="submit">
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
            <ShieldCheck size={16} className={authNoteIconClassName} />
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
