import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Camera, Upload } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { AREA_OPTIONS } from "../../lib/areas";
import { getBranchesForArea } from "../../lib/branches";
import { saveEmployeePortalType } from "../../lib/employeePortal";
import { supabase } from "../../lib/supabase";
import "./OnboardingPage.css";

const steps = [
  "Account Setup",
  "Basic Information",
  "Government Details",
  "Employment Details",
  "Upload Documents",
  "Terms & Signature",
];

const docTypes = ["License", "Valid ID", "NBI Clearance", "Medical Certificate", "Barangay Clearance"];
const PENDING_SIGNUP_STORAGE_KEY = "pending-onboarding-signup";

function getPendingSignup() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(PENDING_SIGNUP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setPendingSignup(email) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    PENDING_SIGNUP_STORAGE_KEY,
    JSON.stringify({
      email,
      createdAt: new Date().toISOString(),
    })
  );
}

function clearPendingSignup() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
}

function isRateLimitError(message = "") {
  return /rate limit|too many requests|email rate limit/i.test(message);
}

export default function OnboardingPage({ user, profile, refreshProfile }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [step, setStep] = useState(user ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [account, setAccount] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    birthday: "",
    age: "",
    gender: "Male",
    civil_status: "Single",
    sss: "",
    philhealth: "",
    pagibig: "",
    tin: "",
    location: AREA_OPTIONS[0],
    branch: "",
    position: "Janitor",
    start_date: "",
    shift: "AM",
    supervisor: "",
    employee_id: "",
    agree1: false,
    agree2: false,
  });
  const [docs, setDocs] = useState({
    "Valid ID": null,
    "NBI Clearance": null,
    "Medical Certificate": null,
    "Barangay Clearance": null,
  });
  const [pendingSignup, setPendingSignupState] = useState(() => getPendingSignup());

  const visibleSteps = user ? steps.slice(1) : steps;
  const visibleStepNumber = user ? step - 1 : step;
  const totalSteps = visibleSteps.length;
  const branchOptions = useMemo(() => getBranchesForArea(form.location), [form.location]);

  useEffect(() => {
    const storedPendingSignup = getPendingSignup();
    if (storedPendingSignup?.email) {
      setAccount((prev) => ({
        ...prev,
        email: prev.email || storedPendingSignup.email,
      }));
      setPendingSignupState(storedPendingSignup);
    }
  }, []);

  useEffect(() => {
    if (user && step === 1) {
      setStep(2);
    }
  }, [step, user]);

  useEffect(() => {
    if (!user || !profile) return;
    navigate(profile.role === "admin" ? "/admin" : "/", { replace: true });
  }, [navigate, profile, user]);

  useEffect(() => {
    setForm((prev) => {
      if (branchOptions.includes(prev.branch)) return prev;
      return {
        ...prev,
        branch: branchOptions[0] || "",
      };
    });
  }, [branchOptions]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setAccountField(key, value) {
    setAccount((prev) => ({ ...prev, [key]: value }));
  }

  function startDraw(e) {
    setDrawing(true);
    draw(e);
  }

  function endDraw() {
    setDrawing(false);
  }

  function draw(e) {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0F172A";
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
  }

  async function saveOnboarding() {
    if (!form.agree1 || !form.agree2) return toast.error("Please accept all terms.");
    setLoading(true);
    try {
      let activeUser = user;

      if (!activeUser) {
        const normalizedEmail = account.email.trim().toLowerCase();
        if (!normalizedEmail || !account.password) {
          throw new Error("Please complete your account email and password first.");
        }
        if (account.password.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }
        if (account.password !== account.confirmPassword) {
          throw new Error("Password confirmation does not match.");
        }

        if (pendingSignup?.email?.toLowerCase() === normalizedEmail) {
          throw new Error(
            "This signup is already pending. Please check your email for the confirmation link before trying again."
          );
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: account.password,
        });
        if (signUpError) throw signUpError;
        if (!signUpData.session?.user) {
          setPendingSignup(normalizedEmail);
          setPendingSignupState(getPendingSignup());
          throw new Error(
            "Account created. Check your email and confirm your account first, then log in and continue onboarding."
          );
        }
        clearPendingSignup();
        setPendingSignupState(null);
        activeUser = signUpData.session.user;
      }

      const signatureData = canvasRef.current.toDataURL("image/png");
      const signaturePath = `${activeUser.id}/signature-${Date.now()}.png`;
      const signatureBlob = await (await fetch(signatureData)).blob();
      const sigUpload = await supabase.storage.from("documents").upload(signaturePath, signatureBlob, {
        contentType: "image/png",
      });
      if (sigUpload.error) throw sigUpload.error;

      const fullName = `${form.first_name} ${form.last_name}`.trim();
      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: activeUser.id,
        full_name: fullName,
        role: "employee",
        employee_id: form.employee_id || `EMP-${Math.floor(Math.random() * 90000 + 10000)}`,
        location: form.location,
        branch: form.branch,
        birthday: form.birthday,
        age: Number(form.age) || null,
        gender: form.gender,
        civil_status: form.civil_status,
        sss: form.sss,
        philhealth: form.philhealth,
        pagibig: form.pagibig,
        tin: form.tin,
        position: form.position,
        start_date: form.start_date,
        shift: form.shift,
        supervisor: form.supervisor,
        signature_url: signaturePath,
      });
      if (profileErr) throw profileErr;
      saveEmployeePortalType(
        form.position === "Security Guard"
          ? "security-guard"
          : form.position === "Janitor"
            ? "janitor"
            : "cgroup-access"
      );

      for (const type of docTypes) {
        if (!docs[type]) continue;
        const ext = docs[type].name.split(".").pop();
        const path = `${activeUser.id}/${type.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.${ext}`;
        const upload = await supabase.storage.from("documents").upload(path, docs[type], { upsert: true });
        if (upload.error) throw upload.error;
        const { error: docErr } = await supabase.from("employee_documents").insert({
          user_id: activeUser.id,
          document_type: type,
          file_url: path,
        });
        if (docErr) throw docErr;
      }

      await refreshProfile();
      clearPendingSignup();
      setPendingSignupState(null);
      toast.success("Onboarding completed.");
      navigate("/");
    } catch (err) {
      const message = err?.message || "Onboarding failed";

      if (isRateLimitError(message)) {
        toast.error(
          "Email sending is temporarily rate limited. If you already signed up, check your inbox first instead of submitting again."
        );
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="onboarding-page">
      <Card className="onboarding-page__progress-card">
        <div className="onboarding-page__progress-head">
          <h1 className="onboarding-page__title">Employee Onboarding</h1>
          <span className="onboarding-page__step-pill">
            Step {visibleStepNumber} of {totalSteps}
          </span>
        </div>
        <div className="onboarding-page__progress-track">
          <div
            className="onboarding-page__progress-fill"
            style={{ width: `${(visibleStepNumber / totalSteps) * 100}%` }}
          />
        </div>
        <p className="onboarding-page__step-copy">{visibleSteps[visibleStepNumber - 1]}</p>
      </Card>

      <Card>
        {step === 1 ? (
          <div className="onboarding-page__intro">
            <h2 className="onboarding-page__hero-title">{user ? "Continue Onboarding" : "Create Your Account"}</h2>
            <p className="onboarding-page__hero-copy">
              Kumpletuhin ang registration para makapagsumite ka ng DTR at makita ang iyong employee records.
            </p>
            {pendingSignup?.email && !user ? (
              <div className="onboarding-page__notice onboarding-page__notice--pending">
                A signup request is already pending for <span className="onboarding-page__emphasis">{pendingSignup.email}</span>.
                Confirm the email first, then log in to continue onboarding.
              </div>
            ) : null}

            {!user ? (
              <div className="app-form-grid app-form-grid--two">
                <Input
                  className="app-form-grid-full"
                  label="Email Address"
                  type="email"
                  value={account.email}
                  onChange={(e) => setAccountField("email", e.target.value)}
                />
                <Input
                  label="Password"
                  type="password"
                  minLength={6}
                  value={account.password}
                  onChange={(e) => setAccountField("password", e.target.value)}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  minLength={6}
                  value={account.confirmPassword}
                  onChange={(e) => setAccountField("confirmPassword", e.target.value)}
                />
              </div>
            ) : (
              <div className="onboarding-page__notice onboarding-page__notice--success">
                Your account is already signed in. Continue filling out your employee onboarding details below.
              </div>
            )}

            <Button onClick={() => setStep(2)}>Start Registration</Button>
            <Link className="app-inline-link" to="/login">
              Already Registered? Login
            </Link>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="app-form-grid app-form-grid--two">
            <Input label="First Name" value={form.first_name} onChange={(e) => setField("first_name", e.target.value)} />
            <Input label="Last Name" value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} />
            <Input label="Birthday" type="date" value={form.birthday} onChange={(e) => setField("birthday", e.target.value)} />
            <Input label="Age" type="number" value={form.age} onChange={(e) => setField("age", e.target.value)} />
            <div>
              <span className="app-field-label">Gender</span>
              <div className="onboarding-page__radio-group">
                {["Male", "Female"].map((item) => (
                  <label key={item} className="onboarding-page__radio-label">
                    <input
                      type="radio"
                      name="gender"
                      checked={form.gender === item}
                      onChange={() => setField("gender", item)}
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <Select label="Civil Status" value={form.civil_status} onChange={(e) => setField("civil_status", e.target.value)}>
              <option>Single</option>
              <option>Married</option>
              <option>Widowed</option>
            </Select>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="app-form-grid app-form-grid--two">
            <Input label="SSS" value={form.sss} onChange={(e) => setField("sss", e.target.value)} />
            <Input label="PhilHealth" value={form.philhealth} onChange={(e) => setField("philhealth", e.target.value)} />
            <Input label="Pag-IBIG" value={form.pagibig} onChange={(e) => setField("pagibig", e.target.value)} />
            <Input label="TIN" value={form.tin} onChange={(e) => setField("tin", e.target.value)} />
          </div>
        ) : null}

        {step === 4 ? (
          <div className="app-form-grid app-form-grid--two">
            <Select label="Assigned Site" value={form.location} onChange={(e) => setField("location", e.target.value)}>
              {AREA_OPTIONS.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </Select>
            <Select label="Branch" value={form.branch} onChange={(e) => setField("branch", e.target.value)}>
              {branchOptions.length === 0 ? <option value="">No branches for this area</option> : null}
              {branchOptions.map((branch) => (
                <option key={branch}>{branch}</option>
              ))}
            </Select>
            <Select label="Position" value={form.position} onChange={(e) => setField("position", e.target.value)}>
              <option>CGroup Access</option>
              <option>Janitor</option>
              <option>Security Guard</option>
              <option>Area Supervisor</option>
            </Select>
            <Input label="Employee ID" value={form.employee_id} onChange={(e) => setField("employee_id", e.target.value)} />
            <Input label="Start Date" type="date" value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />
            <Select label="Shift" value={form.shift} onChange={(e) => setField("shift", e.target.value)}>
              <option>AM</option>
              <option>PM</option>
              <option>Night</option>
            </Select>
            <Input label="Supervisor" value={form.supervisor} onChange={(e) => setField("supervisor", e.target.value)} />
          </div>
        ) : null}

        {step === 5 ? (
          <div className="onboarding-page__docs-list">
            {docTypes.map((type) => (
              <div key={type} className="onboarding-page__doc-card">
                <p className="app-field-label">{type}</p>
                <div className="onboarding-page__doc-actions">
                  <label className="onboarding-page__doc-button">
                    <Camera size={16} /> Take Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="onboarding-page__hidden-input"
                      onChange={(e) => setDocs((prev) => ({ ...prev, [type]: e.target.files?.[0] ?? null }))}
                    />
                  </label>
                  <label className="onboarding-page__doc-button">
                    <Upload size={16} /> Upload from Gallery
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="onboarding-page__hidden-input"
                      onChange={(e) => setDocs((prev) => ({ ...prev, [type]: e.target.files?.[0] ?? null }))}
                    />
                  </label>
                </div>
                <p className="onboarding-page__doc-copy">{docs[type]?.name ?? "No file selected"}</p>
              </div>
            ))}
          </div>
        ) : null}

        {step === 6 ? (
          <div className="onboarding-page__terms">
            <label className="onboarding-page__checkbox">
              <input type="checkbox" checked={form.agree1} onChange={(e) => setField("agree1", e.target.checked)} />
              I agree that all submitted records are accurate and complete.
            </label>
            <label className="onboarding-page__checkbox">
              <input type="checkbox" checked={form.agree2} onChange={(e) => setField("agree2", e.target.checked)} />
              I authorize CGROUP of COMPANIES to process and store these records for HR and payroll use.
            </label>
            <div>
              <p className="app-field-label">Signature</p>
              <canvas
                ref={canvasRef}
                width={800}
                height={220}
                className="onboarding-page__signature-canvas"
                onMouseDown={startDraw}
                onMouseUp={endDraw}
                onMouseMove={draw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchEnd={endDraw}
                onTouchMove={draw}
              />
              <button className="app-inline-link app-inline-link--danger" onClick={clearSignature}>
                Clear Signature
              </button>
            </div>
            <Button onClick={saveOnboarding} loading={loading}>
              Submit Registration
            </Button>
          </div>
        ) : null}

        {step > 1 ? (
          <div className="app-actions-between">
            <Button variant="secondary" onClick={() => setStep((prev) => Math.max(prev - 1, user ? 2 : 1))}>
              Back
            </Button>
            {step < 6 ? <Button onClick={() => setStep((prev) => Math.min(prev + 1, 6))}>Next</Button> : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
