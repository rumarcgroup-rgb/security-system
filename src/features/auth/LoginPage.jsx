import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ShieldCheck } from "lucide-react";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { clearStoredSupabaseAuth, isRetryableSessionError } from "../../lib/authSession";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

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

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/", { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. Please finish onboarding.");
          navigate("/onboarding", { replace: true });
        } else if (data.user) {
          toast.success("Account created. Check your email to confirm your account.");
          setMode("login");
          setPassword("");
        }
      }
    } catch (err) {
      const message = err?.message || "Authentication failed";

      if (isRetryableSessionError(message)) {
        clearStoredSupabaseAuth();
        await supabase.auth.signOut().catch(() => {});
      }

      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-100 p-4">
      <Card className="w-full max-w-md p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-brand-500 p-2 text-white">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">CGROUP of COMPANIES DTR System</h1>
            <p className="text-sm text-slate-500">Employee & Admin Portal</p>
          </div>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {formError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}
          <Button className="w-full" loading={loading} type="submit">
            {mode === "login" ? "Login" : "Create Account"}
          </Button>
        </form>

        <button
          className="mt-4 text-sm font-medium text-brand-600 hover:underline"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already registered? Login"}
        </button>
      </Card>
    </div>
  );
}
