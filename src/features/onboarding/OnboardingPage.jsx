import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Camera, Upload } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { supabase } from "../../lib/supabase";

const steps = [
  "Account Setup",
  "Basic Information",
  "Government Details",
  "Employment Details",
  "Upload Documents",
  "Terms & Signature",
];

const docTypes = ["Valid ID", "NBI Clearance", "Medical Certificate", "Barangay Clearance"];

export default function OnboardingPage({ user, refreshProfile }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [step, setStep] = useState(1);
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
    location: "ABC Building",
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

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: account.password,
        });
        if (signUpError) throw signUpError;
        if (!signUpData.session?.user) {
          throw new Error("Account created, but email confirmation is required before onboarding can continue.");
        }
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
      toast.success("Onboarding completed.");
      navigate("/");
    } catch (err) {
      toast.error(err.message || "Onboarding failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl p-4 md:p-8">
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-800">Employee Onboarding</h1>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            Step {step} of 6
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${(step / 6) * 100}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-500">{steps[step - 1]}</p>
      </Card>

      <Card>
        {step === 1 ? (
          <div className="space-y-4 py-2">
            <h2 className="text-2xl font-bold">{user ? "Continue Onboarding" : "Create Your Account"}</h2>
            <p className="text-sm text-slate-600">
              Kumpletuhin ang registration para makapagsumite ka ng DTR at makita ang iyong employee records.
            </p>

            {!user ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  className="md:col-span-2"
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
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
                Your account is already signed in. Continue filling out your employee onboarding details below.
              </div>
            )}

            <Button onClick={() => setStep(2)}>Start Registration</Button>
            <Link className="block text-sm font-medium text-brand-600 hover:underline" to="/login">
              Already Registered? Login
            </Link>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="First Name" value={form.first_name} onChange={(e) => setField("first_name", e.target.value)} />
            <Input label="Last Name" value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} />
            <Input label="Birthday" type="date" value={form.birthday} onChange={(e) => setField("birthday", e.target.value)} />
            <Input label="Age" type="number" value={form.age} onChange={(e) => setField("age", e.target.value)} />
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Gender</span>
              <div className="flex gap-4 text-sm">
                {["Male", "Female"].map((item) => (
                  <label key={item} className="flex items-center gap-2">
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
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="SSS" value={form.sss} onChange={(e) => setField("sss", e.target.value)} />
            <Input label="PhilHealth" value={form.philhealth} onChange={(e) => setField("philhealth", e.target.value)} />
            <Input label="Pag-IBIG" value={form.pagibig} onChange={(e) => setField("pagibig", e.target.value)} />
            <Input label="TIN" value={form.tin} onChange={(e) => setField("tin", e.target.value)} />
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="Assigned Site" value={form.location} onChange={(e) => setField("location", e.target.value)}>
              <option>ABC Building</option>
              <option>XYZ Tower</option>
              <option>Main Plant</option>
            </Select>
            <Select label="Position" value={form.position} onChange={(e) => setField("position", e.target.value)}>
              <option>Janitor</option>
              <option>Security Guard</option>
              <option>Maintenance Staff</option>
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
          <div className="space-y-3">
            {docTypes.map((type) => (
              <div key={type} className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium">{type}</p>
                <div className="flex gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                    <Camera size={16} /> Take Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => setDocs((prev) => ({ ...prev, [type]: e.target.files?.[0] ?? null }))}
                    />
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                    <Upload size={16} /> Upload from Gallery
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => setDocs((prev) => ({ ...prev, [type]: e.target.files?.[0] ?? null }))}
                    />
                  </label>
                </div>
                <p className="mt-1 text-xs text-slate-500">{docs[type]?.name ?? "No file selected"}</p>
              </div>
            ))}
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-4">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={form.agree1} onChange={(e) => setField("agree1", e.target.checked)} />
              I agree that all submitted records are accurate and complete.
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={form.agree2} onChange={(e) => setField("agree2", e.target.checked)} />
              I authorize CGROUP of COMPANIES to process and store these records for HR and payroll use.
            </label>
            <div>
              <p className="mb-2 text-sm font-medium">Signature</p>
              <canvas
                ref={canvasRef}
                width={800}
                height={220}
                className="w-full rounded-xl border border-slate-300 bg-white"
                onMouseDown={startDraw}
                onMouseUp={endDraw}
                onMouseMove={draw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchEnd={endDraw}
                onTouchMove={draw}
              />
              <button className="mt-2 text-xs font-medium text-rose-600 hover:underline" onClick={clearSignature}>
                Clear Signature
              </button>
            </div>
            <Button onClick={saveOnboarding} loading={loading}>
              Submit Registration
            </Button>
          </div>
        ) : null}

        {step > 1 ? (
          <div className="mt-5 flex justify-between">
            <Button variant="secondary" onClick={() => setStep((prev) => Math.max(prev - 1, 1))}>
              Back
            </Button>
            {step < 6 ? <Button onClick={() => setStep((prev) => Math.min(prev + 1, 6))}>Next</Button> : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
