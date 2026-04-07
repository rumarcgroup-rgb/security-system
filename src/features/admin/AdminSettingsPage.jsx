import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import "./AdminSettingsPage.css";

function getDashboardSoundPreferenceKey(profileId) {
  return `admin-dashboard-sound-muted:${profileId || "default"}`;
}

export default function AdminSettingsPage({ profile, refreshProfile }) {
  const [form, setForm] = useState({
    full_name: "",
    location: "",
    position: "",
    supervisor: "",
    shift: "",
  });
  const [dashboardSoundMuted, setDashboardSoundMuted] = useState(false);
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedPreference = window.localStorage.getItem(getDashboardSoundPreferenceKey(profile?.id));
    setDashboardSoundMuted(storedPreference === "true");
  }, [profile?.id]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleDashboardSound() {
    const nextValue = !dashboardSoundMuted;
    setDashboardSoundMuted(nextValue);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(getDashboardSoundPreferenceKey(profile?.id), String(nextValue));
      window.dispatchEvent(
        new CustomEvent("admin-dashboard-sound-preference-change", {
          detail: {
            profileId: profile?.id ?? null,
            muted: nextValue,
          },
        })
      );
    }

    toast.success(nextValue ? "Dashboard sounds muted." : "Dashboard sounds enabled.");
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
    <div className="admin-page admin-settings-page">
      <Card>
        <div className="admin-section-intro">
          <h2 className="admin-section-title">Admin Profile Settings</h2>
          <p className="admin-section-copy">Keep the dashboard identity and assignment details current.</p>
        </div>

        <div className="app-form-grid app-form-grid--two admin-settings-page__form-grid">
          <Input label="Full Name" value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} />
          <Input label="Assigned Location" value={form.location} onChange={(e) => setField("location", e.target.value)} />
          <Input label="Position" value={form.position} onChange={(e) => setField("position", e.target.value)} />
          <Input label="Supervisor" value={form.supervisor} onChange={(e) => setField("supervisor", e.target.value)} />
          <Input label="Shift" value={form.shift} onChange={(e) => setField("shift", e.target.value)} />
        </div>

        <div className="admin-settings-page__actions">
          <Button loading={saving} onClick={saveSettings}>
            Save Settings
          </Button>
        </div>
      </Card>

      <Card>
        <div className="admin-section-intro">
          <h2 className="admin-section-title">System Notes</h2>
        </div>
        <div className="admin-stack-sm admin-settings-page__notes">
          <div className="admin-card-panel admin-settings-page__note">
            <p className="app-note-title">Storage buckets</p>
            <p className="app-note-copy">Private buckets expected by the app: `dtr-images` and `documents`.</p>
          </div>
          <div className="admin-card-panel admin-settings-page__note">
            <p className="app-note-title">Access model</p>
            <p className="app-note-copy">Admin access is controlled through `profiles.role = 'admin'` and enforced in RLS.</p>
          </div>
          <div className="admin-card-panel admin-settings-page__note">
            <p className="app-note-title">Current admin account</p>
            <p className="app-note-copy app-note-copy--break">{profile?.id || "No active profile loaded."}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="admin-section-intro">
          <h2 className="admin-section-title">Realtime Alerts</h2>
          <p className="admin-section-copy">Control the small dashboard sounds used for new DTR and requirement notifications.</p>
        </div>
        <div className="admin-settings-page__toggle-row">
          <div>
            <p className="app-note-title">Mute dashboard sounds</p>
            <p className="app-note-copy">Visual toasts and activity highlights will still appear even when sound is off.</p>
          </div>
          <button
            type="button"
            className={`admin-settings-page__toggle${dashboardSoundMuted ? " admin-settings-page__toggle--muted" : ""}`}
            onClick={toggleDashboardSound}
            aria-pressed={dashboardSoundMuted}
          >
            <span className="admin-settings-page__toggle-thumb" />
            <span className="admin-settings-page__toggle-copy">{dashboardSoundMuted ? "Muted" : "On"}</span>
          </button>
        </div>
      </Card>
    </div>
  );
}
