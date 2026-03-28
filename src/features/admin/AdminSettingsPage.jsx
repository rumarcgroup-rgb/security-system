import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";

export default function AdminSettingsPage({ profile, refreshProfile }) {
  const [form, setForm] = useState({
    full_name: "",
    location: "",
    position: "",
    supervisor: "",
    shift: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      full_name: profile?.full_name || "",
      location: profile?.location || "",
      position: profile?.position || "",
      supervisor: profile?.supervisor || "",
      shift: profile?.shift || "",
    });
  }, [profile]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings() {
    if (!profile?.id) return;

    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", profile.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await refreshProfile?.();
    toast.success("Admin profile updated.");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
      <Card>
        <h2 className="text-lg font-semibold text-slate-800">Admin Profile Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Keep the dashboard identity and assignment details current.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input label="Full Name" value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} />
          <Input label="Assigned Location" value={form.location} onChange={(e) => setField("location", e.target.value)} />
          <Input label="Position" value={form.position} onChange={(e) => setField("position", e.target.value)} />
          <Input label="Supervisor" value={form.supervisor} onChange={(e) => setField("supervisor", e.target.value)} />
          <Input label="Shift" value={form.shift} onChange={(e) => setField("shift", e.target.value)} />
        </div>

        <div className="mt-5">
          <Button loading={saving} onClick={saveSettings}>
            Save Settings
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-800">System Notes</h2>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-800">Storage buckets</p>
            <p className="mt-1">Private buckets expected by the app: `dtr-images` and `documents`.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-800">Access model</p>
            <p className="mt-1">Admin access is controlled through `profiles.role = 'admin'` and enforced in RLS.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-800">Current admin account</p>
            <p className="mt-1 break-all">{profile?.id || "No active profile loaded."}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
