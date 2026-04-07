import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Camera, KeyRound, LifeBuoy, Mail } from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import { attachSignedUrls } from "../../lib/storage";
import { getSupervisorScopeLabel } from "../../lib/supervisorScope";
import { supabase } from "../../lib/supabase";
import "../admin/AdminSettingsPage.css";
import "./SupervisorSettingsPage.css";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

function buildStoragePath(userId, label, file) {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  return `${userId}/${safeLabel}-${Date.now()}.${ext}`;
}

function validateAvatarFile(file) {
  if (!file) return null;
  if (file.type && !IMAGE_TYPES.includes(file.type)) {
    return "Profile picture must be PNG, JPG, or WEBP.";
  }
  return null;
}

export default function SupervisorSettingsPage({ profile, refreshProfile }) {
  const [form, setForm] = useState({
    full_name: "",
    position: "",
    shift: "",
    supervisor: "",
    location: "",
    branch: "",
  });
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [accountEmail, setAccountEmail] = useState("");

  useEffect(() => {
    setForm({
      full_name: profile?.full_name || "",
      position: profile?.position || "Area Supervisor",
      shift: profile?.shift || "",
      supervisor: profile?.supervisor || "",
      location: profile?.location || "",
      branch: profile?.branch || "",
    });
  }, [profile]);

  useEffect(() => {
    let cancelled = false;

    async function loadAccountEmail() {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) {
        setAccountEmail(data.user?.email || "");
      }
    }

    loadAccountEmail();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  const currentAvatar = useMemo(() => avatarPreview || profile?.preview_url || "", [avatarPreview, profile?.preview_url]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings() {
    if (!profile?.id) return;

    const avatarError = validateAvatarFile(avatarFile);
    if (avatarError) {
      toast.error(avatarError);
      return;
    }

    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url || null;

      if (avatarFile) {
        const avatarPath = buildStoragePath(profile.id, "avatar", avatarFile);
        const upload = await supabase.storage.from("documents").upload(avatarPath, avatarFile, {
          contentType: avatarFile.type || undefined,
          upsert: false,
        });
        if (upload.error) throw upload.error;
        avatarUrl = avatarPath;
      }

      const payload = {
        full_name: form.full_name.trim() || null,
        shift: form.shift.trim() || null,
        supervisor: form.supervisor.trim() || null,
        avatar_url: avatarUrl,
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id);
      if (error) throw error;

      if (refreshProfile) {
        await refreshProfile();
      }

      setAvatarFile(null);
      if (avatarUrl) {
        const [signedProfile] = await attachSignedUrls([{ avatar_url: avatarUrl }], "documents", "avatar_url");
        if (signedProfile?.preview_url) {
          setAvatarPreview(signedProfile.preview_url);
        }
      }

      toast.success("Supervisor profile updated.");
    } catch (error) {
      toast.error(error.message || "Unable to save supervisor settings.");
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    if (!accountEmail) {
      toast.error("No account email is available for this supervisor.");
      return;
    }

    setSendingReset(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password/admin`;
      const { error } = await supabase.auth.resetPasswordForEmail(accountEmail, { redirectTo });
      if (error) throw error;
      toast.success("Password reset link sent to your email.");
    } catch (error) {
      toast.error(error.message || "Unable to send reset email.");
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <div className="admin-page admin-settings-page supervisor-settings-page">
      <Card>
        <div className="admin-section-intro">
          <h2 className="admin-section-title">Supervisor Profile Settings</h2>
          <p className="admin-section-copy">Update your personal supervisor details while keeping your assigned scope managed by admin.</p>
        </div>

        <div className="supervisor-settings-page__avatar-row">
          <div className="app-avatar app-avatar--circle app-avatar--lg supervisor-settings-page__avatar">
            {currentAvatar ? (
              <img src={currentAvatar} alt={form.full_name || "Supervisor"} className="app-media-cover" />
            ) : (
              (form.full_name || "Supervisor")
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()
            )}
          </div>
          <div className="supervisor-settings-page__avatar-copy">
            <p className="app-text-strong-dark">Profile Photo</p>
            <p className="app-copy-sm">Upload a clear square photo for your supervisor account.</p>
            <label className="supervisor-settings-page__upload-label">
              <Camera size={16} />
              <span>{avatarFile ? "Change Photo" : "Upload Photo"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="supervisor-settings-page__hidden-input"
                onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </div>

        <div className="app-form-grid app-form-grid--two admin-settings-page__form-grid">
          <Input label="Full Name" value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} />
          <Input label="Position" value={form.position} disabled />
          <Input label="Assigned Area" value={form.location || "No area assigned"} disabled />
          <Input label="Assigned Branch" value={form.branch || "Whole area access"} disabled />
          <Input label="Shift" value={form.shift} onChange={(e) => setField("shift", e.target.value)} />
          <Input label="Supervisor / Manager" value={form.supervisor} onChange={(e) => setField("supervisor", e.target.value)} />
        </div>

        <div className="admin-settings-page__actions">
          <Button loading={saving} onClick={saveSettings}>
            Save Settings
          </Button>
        </div>
      </Card>

      <Card>
        <div className="admin-section-intro">
          <h2 className="admin-section-title">Password & Help</h2>
          <p className="admin-section-copy">Use these tools if you need to reset your access or confirm which email is linked to your supervisor account.</p>
        </div>
        <div className="admin-stack-sm admin-settings-page__notes">
          <div className="admin-card-panel admin-settings-page__note supervisor-settings-page__help-card">
            <div className="supervisor-settings-page__help-head">
              <div className="app-icon-box app-icon-box--sm">
                <Mail size={16} />
              </div>
              <div>
                <p className="app-note-title">Account Email</p>
                <p className="app-note-copy app-note-copy--break">{accountEmail || "No email found for this session."}</p>
              </div>
            </div>
          </div>
          <div className="admin-card-panel admin-settings-page__note supervisor-settings-page__help-card">
            <div className="supervisor-settings-page__help-head">
              <div className="app-icon-box app-icon-box--sm">
                <KeyRound size={16} />
              </div>
              <div>
                <p className="app-note-title">Password Reset</p>
                <p className="app-note-copy">Send a reset link to your current email if you want to change your password securely.</p>
              </div>
            </div>
            <div className="app-actions-wrap app-actions-wrap--spaced">
              <Button variant="secondary" loading={sendingReset} onClick={sendPasswordReset}>
                Send Reset Email
              </Button>
            </div>
          </div>
          <div className="admin-card-panel admin-settings-page__note supervisor-settings-page__help-card">
            <div className="supervisor-settings-page__help-head">
              <div className="app-icon-box app-icon-box--sm">
                <LifeBuoy size={16} />
              </div>
              <div>
                <p className="app-note-title">Need Help?</p>
                <p className="app-note-copy">If your area assignment or branch scope looks wrong, contact an admin so they can update your supervisor access.</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="admin-section-intro">
          <h2 className="admin-section-title">Scope Notes</h2>
        </div>
        <div className="admin-stack-sm admin-settings-page__notes">
          <div className="admin-card-panel admin-settings-page__note">
            <p className="app-note-title">Current supervisor scope</p>
            <p className="app-note-copy">{getSupervisorScopeLabel(profile)}</p>
          </div>
          <div className="admin-card-panel admin-settings-page__note">
            <p className="app-note-title">Assignment control</p>
            <p className="app-note-copy">Area and branch scope are managed from the admin users page to keep supervisor access aligned.</p>
          </div>
          <div className="admin-card-panel admin-settings-page__note">
            <p className="app-note-title">Current supervisor account</p>
            <p className="app-note-copy app-note-copy--break">{profile?.id || "No active profile loaded."}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
