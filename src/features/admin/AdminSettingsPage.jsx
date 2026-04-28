import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { AREA_OPTIONS } from "../../lib/areas";
import { getBranchesForArea } from "../../lib/branches";
import { buildCutoffOptions } from "../../lib/dtr";
import { supabase } from "../../lib/supabase";
import { REQUIRED_DOCUMENTS } from "../employee/employeeDashboardConfig";
import { isSuperAdminRole } from "../../lib/roles";
import "./AdminSettingsPage.css";

function getDashboardSoundPreferenceKey(profileId) {
  return `admin-dashboard-sound-muted:${profileId || "default"}`;
}

export default function AdminSettingsPage({ profile, refreshProfile }) {
  const canAccessSettings = isSuperAdminRole(profile?.role);
  const [form, setForm] = useState({
    full_name: "",
    location: "",
    position: "",
    supervisor: "",
    shift: "",
  });
  const [dashboardSoundMuted, setDashboardSoundMuted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [systemHealthLoading, setSystemHealthLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogsError, setAuditLogsError] = useState("");

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

  useEffect(() => {
    loadSystemHealth();
    loadAuditLogs();
  }, [profile?.id]);

  const missingRealtimeTables = useMemo(() => {
    return Array.isArray(systemHealth?.missing_realtime_tables) ? systemHealth.missing_realtime_tables : [];
  }, [systemHealth]);

  const enabledRealtimeTables = useMemo(() => {
    return Array.isArray(systemHealth?.enabled_realtime_tables) ? systemHealth.enabled_realtime_tables : [];
  }, [systemHealth]);
  const operationalLists = useMemo(() => {
    const cutoffOptions = buildCutoffOptions(new Date(), 6);
    const branchCount = AREA_OPTIONS.reduce((count, area) => count + getBranchesForArea(area).length, 0);

    return [
      { label: "Areas", value: AREA_OPTIONS.length, copy: AREA_OPTIONS.slice(0, 4).join(", ") },
      { label: "Branches", value: branchCount, copy: "Derived from the area and branch configuration." },
      { label: "Required Documents", value: REQUIRED_DOCUMENTS.length, copy: REQUIRED_DOCUMENTS.slice(0, 4).join(", ") },
      { label: "Upcoming Cutoffs", value: cutoffOptions.length, copy: cutoffOptions.slice(0, 3).join(", ") },
    ];
  }, []);

  if (!canAccessSettings) {
    return <Navigate to="/admin" replace />;
  }

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

  async function loadSystemHealth() {
    if (!profile?.id) return;

    setSystemHealthLoading(true);
    const { data, error } = await supabase.rpc("get_admin_system_health");
    setSystemHealthLoading(false);

    if (error) {
      setSystemHealth({
        error: error.message,
        realtime_publication_exists: false,
        missing_realtime_tables: [],
        enabled_realtime_tables: [],
      });
      return;
    }

    setSystemHealth(data);
  }

  async function loadAuditLogs() {
    if (!profile?.id) return;

    setAuditLogsLoading(true);
    setAuditLogsError("");
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, actor_user_id, event_type, table_name, record_id, target_user_id, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(12);
    setAuditLogsLoading(false);

    if (error) {
      setAuditLogs([]);
      setAuditLogsError(error.message);
      return;
    }

    setAuditLogs(data || []);
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
            <p className="app-note-copy">Admin access is controlled through `super_admin` and `admin_ops` roles in `profiles.role` and enforced in RLS.</p>
          </div>
          <div className="admin-card-panel admin-settings-page__note">
            <p className="app-note-title">Current admin account</p>
            <p className="app-note-copy app-note-copy--break">{profile?.id || "No active profile loaded."}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="admin-section-intro">
          <h2 className="admin-section-title">Operational Lists</h2>
          <p className="admin-section-copy">
            Current app lists used for areas, branches, requirements, and cutoff choices. These are the admin-facing source lists for this version.
          </p>
        </div>
        <div className="admin-settings-page__managed-list-grid">
          {operationalLists.map((item) => (
            <div key={item.label} className="admin-card-panel admin-settings-page__managed-list-card">
              <p className="app-note-title">{item.label}</p>
              <p className="admin-settings-page__managed-list-value">{item.value}</p>
              <p className="app-note-copy">{item.copy}</p>
            </div>
          ))}
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

      <Card>
        <div className="admin-section-head">
          <div className="admin-section-intro">
            <h2 className="admin-section-title">System Health</h2>
            <p className="admin-section-copy">Admin-only check for realtime publication membership and core schema readiness.</p>
          </div>
          <Button variant="secondary" loading={systemHealthLoading} onClick={loadSystemHealth}>
            Refresh Check
          </Button>
        </div>

        <div className="admin-settings-page__health-grid">
          <div className="admin-card-panel admin-settings-page__health-card">
            <p className="app-note-title">Current role</p>
            <p className="app-note-copy">{profile?.role || "Unknown"}</p>
          </div>
          <div className="admin-card-panel admin-settings-page__health-card">
            <p className="app-note-title">Realtime publication</p>
            <p className={`app-note-copy ${systemHealth?.realtime_publication_exists ? "app-copy-xs-success" : "app-copy-xs-spaced-brand"}`}>
              {systemHealth?.realtime_publication_exists ? "Available" : "Needs attention"}
            </p>
          </div>
          <div className="admin-card-panel admin-settings-page__health-card">
            <p className="app-note-title">Realtime tables</p>
            <p className="app-note-copy">{enabledRealtimeTables.length} enabled</p>
          </div>
          <div className="admin-card-panel admin-settings-page__health-card">
            <p className="app-note-title">Missing tables</p>
            <p className="app-note-copy">{missingRealtimeTables.length ? missingRealtimeTables.join(", ") : "None"}</p>
          </div>
        </div>

        {systemHealth?.error ? (
          <div className="app-info-panel admin-settings-page__health-error">
            {systemHealth.error}. If this appears after deployment, rerun `supabase/schema.sql` in the Supabase SQL editor.
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="admin-section-head">
          <div className="admin-section-intro">
            <h2 className="admin-section-title">Audit Log Preview</h2>
            <p className="admin-section-copy">Recent DTR, requirement, profile, assignment, and messaging events.</p>
          </div>
          <Button variant="secondary" loading={auditLogsLoading} onClick={loadAuditLogs}>
            Refresh Logs
          </Button>
        </div>

        <div className="admin-settings-page__audit-list">
          {auditLogs.map((item) => (
            <div key={item.id} className="admin-card-panel admin-settings-page__audit-item">
              <div>
                <p className="app-note-title">{item.summary}</p>
                <p className="app-note-copy">
                  {item.table_name} | {item.event_type} | {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <span className="app-pill">{item.table_name}</span>
            </div>
          ))}
          {auditLogs.length === 0 && !auditLogsError ? <p className="admin-empty-copy">No audit events yet.</p> : null}
          {auditLogsError ? (
            <div className="app-info-panel admin-settings-page__health-error">
              Audit log is not available yet. Rerun `supabase/schema.sql`, then refresh this page. Details: {auditLogsError}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
