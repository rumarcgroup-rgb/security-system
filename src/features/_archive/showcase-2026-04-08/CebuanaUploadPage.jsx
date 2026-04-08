
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Building2, CalendarDays, CheckCircle2, Clock3, FileText, ImageIcon, MapPinned, Upload, Users, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { buildCutoffOptions } from "../../lib/dtr";
import { getSupervisorScopeLabel, isScopedEmployee } from "../../lib/supervisorScope";
import { attachSignedUrls } from "../../lib/storage";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import "./CebuanaUploadPreviewPage.css";
import "./CebuanaUploadPage.css";

const ACTIVE_TAB_KEY = "cebuana-preview-active-tab";
const SETTINGS_KEY = "cebuana-preview-settings";
const WORKSPACE_KEY = "cebuana-preview-upload-workspace";
const LIVE_UPLOAD_CHANNEL = "cebuana-live-upload";
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE_ACCEPT = [".png", ".jpg", ".jpeg", ".webp", ...IMAGE_TYPES].join(",");
const SUMMARY_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const SUMMARY_ACCEPT = [".png", ".jpg", ".jpeg", ".webp", ".pdf", ...SUMMARY_TYPES].join(",");

function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function formatFileSize(size) {
  if (!size) return "0 KB";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function normalize(value) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenize(value) {
  return (value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function buildStoragePath(userId, file, prefix) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  return `${userId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
}

function guessAssignedGuard(name, teamProfiles) {
  const normalizedName = normalize(name);
  const nameTokens = new Set(tokenize(name));
  let bestMatch = null;

  teamProfiles.forEach((member) => {
    const fullName = normalize(member.full_name);
    const employeeId = normalize(member.employee_id);
    const memberTokens = tokenize(`${member.full_name || ""} ${member.employee_id || ""}`);
    let score = 0;

    if (employeeId && normalizedName.includes(employeeId)) score += 90;
    if (fullName && normalizedName.includes(fullName)) score += 80;

    memberTokens.forEach((token) => {
      if (nameTokens.has(token)) score += token.length >= 5 ? 16 : 8;
      else if (normalizedName.includes(token)) score += token.length >= 5 ? 10 : 5;
    });

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { member, score };
    }
  });

  if (!bestMatch || bestMatch.score < 24) {
    return { id: "", label: "", matched: false };
  }

  return {
    id: bestMatch.member.id,
    label: bestMatch.member.full_name || bestMatch.member.employee_id || "guard",
    matched: true,
  };
}

function createGuardUploads(fileList, teamProfiles) {
  return Array.from(fileList || []).map((file, index) => {
    const guessed = guessAssignedGuard(file.name, teamProfiles);
    return {
      id: `guard-${Date.now()}-${index}`,
      file,
      name: file.name,
      size: file.size,
      previewUrl: file.type?.startsWith("image/") ? URL.createObjectURL(file) : "",
      assignedUserId: guessed.id,
      status: "pending",
      message: guessed.matched ? `Auto-matched to ${guessed.label}` : "Assign guard before upload",
    };
  });
}

export default function CebuanaUploadPage({ profile = null }) {
  const navigate = useNavigate();
  const guardInputRef = useRef(null);
  const summaryInputRef = useRef(null);
  const settings = readJson(SETTINGS_KEY, { compactMode: false, animationsEnabled: true });
  const workspace = readJson(WORKSPACE_KEY, {});
  const cutoffOptions = useMemo(() => buildCutoffOptions(new Date(), 48), []);
  const [teamProfiles, setTeamProfiles] = useState([]);
  const [scopedRows, setScopedRows] = useState([]);
  const [dtrHistory, setDtrHistory] = useState([]);
  const [summaryHistory, setSummaryHistory] = useState([]);
  const [cutoff, setCutoff] = useState(workspace.cutoff || cutoffOptions[0] || "");
  const [area, setArea] = useState(workspace.area || "");
  const [branch, setBranch] = useState(workspace.branch || "");
  const [employeeNote, setEmployeeNote] = useState("");
  const [skipExistingRows, setSkipExistingRows] = useState(true);
  const [guardUploads, setGuardUploads] = useState([]);
  const [summaryUpload, setSummaryUpload] = useState(null);
  const [status, setStatus] = useState({ tone: "success", title: "", message: "" });
  const [loading, setLoading] = useState(true);
  const [submittingDtrs, setSubmittingDtrs] = useState(false);
  const [submittingSummary, setSubmittingSummary] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, success: 0, skipped: 0, failed: 0 });
  const [previewImage, setPreviewImage] = useState(null);
  const [collapsedUploadCount, setCollapsedUploadCount] = useState(0);

  const isPrivilegedViewer = Boolean(profile && ["admin", "supervisor"].includes(profile.role));
  const areaOptions = useMemo(() => Array.from(new Set(teamProfiles.map((item) => item.location).filter(Boolean))), [teamProfiles]);
  const branchOptions = useMemo(
    () => Array.from(new Set(teamProfiles.filter((item) => !area || item.location === area).map((item) => item.branch).filter(Boolean))),
    [area, teamProfiles]
  );
  const filteredTeamProfiles = useMemo(
    () => teamProfiles.filter((item) => (!area || item.location === area) && (!branch || item.branch === branch)),
    [area, branch, teamProfiles]
  );
  const existingCutoffKeys = useMemo(
    () => new Set(scopedRows.filter((row) => row.cutoff === cutoff).map((row) => `${row.user_id}:::${row.cutoff}`)),
    [cutoff, scopedRows]
  );
  const sortedFilteredTeamProfiles = useMemo(() => {
    return [...filteredTeamProfiles].sort((left, right) => {
      const leftSubmitted = existingCutoffKeys.has(`${left.id}:::${cutoff}`) ? 1 : 0;
      const rightSubmitted = existingCutoffKeys.has(`${right.id}:::${cutoff}`) ? 1 : 0;
      if (leftSubmitted !== rightSubmitted) return leftSubmitted - rightSubmitted;
      return (left.full_name || "").localeCompare(right.full_name || "");
    });
  }, [cutoff, existingCutoffKeys, filteredTeamProfiles]);
  const duplicateAssignedCount = useMemo(
    () => guardUploads.filter((item) => item.assignedUserId && existingCutoffKeys.has(`${item.assignedUserId}:::${cutoff}`)).length,
    [cutoff, existingCutoffKeys, guardUploads]
  );
  const branchGuardCount = filteredTeamProfiles.length;
  const areaScopedGuardCount = useMemo(
    () => teamProfiles.filter((item) => !area || item.location === area).length,
    [area, teamProfiles]
  );
  const branchUploadedCount = useMemo(
    () => {
      const memberIds = new Set(filteredTeamProfiles.map((item) => item.id));
      return scopedRows.filter((row) => memberIds.has(row.user_id) && row.cutoff === cutoff).length;
    },
    [cutoff, filteredTeamProfiles, scopedRows]
  );

  useEffect(() => {
    if (!status.message) return undefined;
    const timeoutId = window.setTimeout(() => setStatus((current) => ({ ...current, title: "", message: "" })), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [status.message]);

  async function refreshHistoryNow() {
    if (!supabase || !isPrivilegedViewer) return;

    const [dtrRes, summaryRes] = await Promise.all([
      supabase
        .from("dtr_submissions")
        .select("id,user_id,cutoff,status,file_url,created_at,submitted_by_user_id,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,employee_id,location,branch)")
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("employee_documents")
        .select("id,user_id,document_type,review_status,file_url,created_at")
        .ilike("document_type", "Weekly DTR Summary%")
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    if (!dtrRes.error) {
      const nextScopedRows =
        profile.role === "admin"
          ? dtrRes.data ?? []
          : (dtrRes.data ?? []).filter((row) => isScopedEmployee({ ...row.profiles, id: row.user_id, role: "employee" }, profile));
      setScopedRows(nextScopedRows);
      setDtrHistory(await attachSignedUrls(nextScopedRows.filter((row) => row.submitted_by_user_id === profile.id).slice(0, 10), "dtr-images"));
    }

    if (!summaryRes.error) {
      setSummaryHistory(await attachSignedUrls((summaryRes.data ?? []).filter((row) => row.user_id === profile.id).slice(0, 8), "documents"));
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ ...workspace, cutoff, area, branch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutoff, area, branch]);

  useEffect(() => {
    if (!teamProfiles.length) return;
    if (!area) setArea(profile?.location || areaOptions[0] || "");
  }, [area, areaOptions, profile?.location, teamProfiles.length]);

  useEffect(() => {
    if (!branchOptions.length) {
      if (branch) setBranch("");
      return;
    }
    if (!branch || !branchOptions.includes(branch)) {
      setBranch(profile?.branch && branchOptions.includes(profile.branch) ? profile.branch : branchOptions[0] || "");
    }
  }, [branch, branchOptions, profile?.branch]);

  useEffect(() => {
    setGuardUploads((current) =>
      current.map((item) =>
        filteredTeamProfiles.some((member) => member.id === item.assignedUserId)
          ? item
          : { ...item, assignedUserId: "", status: item.status === "uploaded" ? item.status : "pending", message: "Reassign guard for this branch" }
      )
    );
  }, [filteredTeamProfiles]);

  useEffect(() => {
    let active = true;

    async function loadLiveData() {
      if (!isSupabaseConfigured || !isPrivilegedViewer || !supabase) {
        if (active) setLoading(false);
        return;
      }

      setLoading(true);
      const [profilesRes, dtrRes, summaryRes] = await Promise.all([
        supabase.from("profiles").select("id,role,full_name,employee_id,location,branch").order("full_name", { ascending: true }),
        supabase
          .from("dtr_submissions")
          .select("id,user_id,cutoff,status,file_url,created_at,submitted_by_user_id,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,employee_id,location,branch)")
          .order("created_at", { ascending: false })
          .limit(120),
        supabase
          .from("employee_documents")
          .select("id,user_id,document_type,review_status,file_url,created_at")
          .ilike("document_type", "Weekly DTR Summary%")
          .order("created_at", { ascending: false })
          .limit(60),
      ]);

      if (!active) return;
      if (profilesRes.error || dtrRes.error || summaryRes.error) {
        setStatus({
          tone: "error",
          title: "Unable to load live upload workspace",
          message: profilesRes.error?.message || dtrRes.error?.message || summaryRes.error?.message || "Unable to load the live upload workspace.",
        });
        setLoading(false);
        return;
      }

      const nextTeamProfiles =
        profile.role === "admin"
          ? (profilesRes.data ?? []).filter((item) => item.role === "employee")
          : (profilesRes.data ?? []).filter((item) => isScopedEmployee(item, profile));
      const nextScopedRows =
        profile.role === "admin"
          ? dtrRes.data ?? []
          : (dtrRes.data ?? []).filter((row) => isScopedEmployee({ ...row.profiles, id: row.user_id, role: "employee" }, profile));
      const [signedDtrs, signedSummaries] = await Promise.all([
        attachSignedUrls(nextScopedRows.filter((row) => row.submitted_by_user_id === profile.id).slice(0, 10), "dtr-images"),
        attachSignedUrls((summaryRes.data ?? []).filter((row) => row.user_id === profile.id).slice(0, 8), "documents"),
      ]);

      setTeamProfiles(nextTeamProfiles);
      setScopedRows(nextScopedRows);
      setDtrHistory(signedDtrs);
      setSummaryHistory(signedSummaries);
      setLoading(false);
    }

    loadLiveData();

    if (!isSupabaseConfigured || !isPrivilegedViewer || !supabase) {
      return () => {
        active = false;
      };
    }

    const channel = supabase
      .channel(LIVE_UPLOAD_CHANNEL)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadLiveData)
      .on("postgres_changes", { event: "*", schema: "public", table: "dtr_submissions" }, loadLiveData)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_documents" }, loadLiveData)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
      guardUploads.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrivilegedViewer, profile]);

  function setProductionTab(label) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_TAB_KEY, label);
    }
    navigate("/cebuana");
  }

  function handleGuardFilesChange(event) {
    setGuardUploads((current) => [...current, ...createGuardUploads(event.target.files, filteredTeamProfiles.length ? filteredTeamProfiles : teamProfiles)]);
    event.target.value = "";
  }

  function openNativePicker(inputRef) {
    const input = inputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch {
      // Fall through to click for browsers that expose showPicker but reject it.
    }
    input.click();
  }

  async function submitGuardBatch() {
    if (!supabase || !isPrivilegedViewer) return;
    if (!guardUploads.length) {
      setStatus({ tone: "error", title: "No DTR files selected", message: "Choose at least one DTR image first." });
      return;
    }
    if (guardUploads.some((item) => !item.assignedUserId)) {
      setStatus({ tone: "error", title: "Guard assignment required", message: "Assign every staged DTR file to a scoped guard before submitting." });
      return;
    }

    let processed = 0;
    let success = 0;
    let skipped = 0;
    let failed = 0;
    const uploadedIds = [];
    setSubmittingDtrs(true);
    setProgress({ processed: 0, total: guardUploads.length, success: 0, skipped: 0, failed: 0 });

    for (const item of guardUploads) {
      const existingKey = `${item.assignedUserId}:::${cutoff}`;
      if (skipExistingRows && existingCutoffKeys.has(existingKey)) {
        skipped += 1;
        processed += 1;
        setProgress({ processed, total: guardUploads.length, success, skipped, failed });
        setGuardUploads((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: "skipped", message: "Skipped existing cutoff match" } : entry)));
        continue;
      }

      try {
        if (item.file.type && !IMAGE_TYPES.includes(item.file.type)) {
          throw new Error("Only PNG, JPG, or WEBP files are supported for guard DTR uploads.");
        }

        const path = buildStoragePath(item.assignedUserId, item.file, "cebuana-dtr");
        const uploadRes = await supabase.storage.from("dtr-images").upload(path, item.file, {
          cacheControl: "3600",
          contentType: item.file.type || undefined,
          upsert: false,
        });
        if (uploadRes.error) throw uploadRes.error;

        const insertRes = await supabase.from("dtr_submissions").insert({
          user_id: item.assignedUserId,
          cutoff,
          employee_note: employeeNote.trim() || null,
          file_url: path,
          status: "Pending Review",
          submitted_by_role: "supervisor",
          submitted_by_user_id: profile.id,
          approved_at: null,
        });
        if (insertRes.error) throw insertRes.error;

        success += 1;
        uploadedIds.push(item.id);
        setGuardUploads((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: "uploaded", message: "Uploaded successfully" } : entry)));
      } catch (error) {
        failed += 1;
        setGuardUploads((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: "error", message: error.message || "Upload failed" } : entry)));
      }

      processed += 1;
      setProgress({ processed, total: guardUploads.length, success, skipped, failed });
    }

    setSubmittingDtrs(false);
    if (uploadedIds.length) {
      setCollapsedUploadCount((current) => current + uploadedIds.length);
      setGuardUploads((current) => current.filter((entry) => !uploadedIds.includes(entry.id)));
    }
    setStatus({
      tone: failed > 0 ? "warning" : "success",
      title: failed > 0 ? "Batch finished with attention needed" : "DTR batch uploaded",
      message: `Processed ${processed} DTR file(s): ${success} successful, ${skipped} skipped, ${failed} failed.${uploadedIds.length ? ` Collapsed ${uploadedIds.length} uploaded file${uploadedIds.length === 1 ? "" : "s"} from staging and refreshed history.` : ""}`,
    });
    await refreshHistoryNow();
  }

  async function submitSummary() {
    if (!supabase || !isPrivilegedViewer || !summaryUpload?.file) {
      setStatus({ tone: "error", title: "No summary selected", message: "Choose a weekly summary file first." });
      return;
    }

    setSubmittingSummary(true);
    try {
      if (summaryUpload.file.type && !SUMMARY_TYPES.includes(summaryUpload.file.type)) {
        throw new Error("Summary files must be PNG, JPG, WEBP, or PDF.");
      }

      const path = buildStoragePath(profile.id, summaryUpload.file, "weekly-dtr-summary");
      const uploadRes = await supabase.storage.from("documents").upload(path, summaryUpload.file, {
        contentType: summaryUpload.file.type || undefined,
        upsert: false,
      });
      if (uploadRes.error) throw uploadRes.error;

      const insertRes = await supabase.from("employee_documents").insert({
        user_id: profile.id,
        document_type: `Weekly DTR Summary (${cutoff})`,
        file_url: path,
        review_status: "Pending Review",
      });
      if (insertRes.error) throw insertRes.error;

      setSummaryUpload((current) => (current ? { ...current, status: "uploaded", message: "Summary uploaded successfully" } : current));
      setStatus({ tone: "success", title: "Weekly summary uploaded", message: "The summary was uploaded successfully and history has been refreshed." });
      await refreshHistoryNow();
    } catch (error) {
      setSummaryUpload((current) => (current ? { ...current, status: "error", message: error.message || "Upload failed" } : current));
      setStatus({ tone: "error", title: "Summary upload failed", message: error.message || "Unable to upload the weekly summary." });
    } finally {
      setSubmittingSummary(false);
    }
  }

  const rootClassName = `cebuana-preview cebuana-live-upload${settings.compactMode ? " cebuana-preview--compact" : ""}${settings.animationsEnabled ? "" : " cebuana-preview--reduced-motion"}`;

  return (
    <div className={rootClassName}>
      <div className="cebuana-preview__backdrop" />
      <div className="cebuana-preview__phone-shell">
        <div className="cebuana-preview__phone-camera" />
        <div className="cebuana-preview__screen">
          <header className="cebuana-preview__topbar">
            <div className="cebuana-preview__topbar-main">
              <div className="cebuana-preview__brand">CEBUANA</div>
              <nav className="cebuana-preview__header-nav" aria-label="Cebuana navigation">
                {["Dashboard", "Guards", "Upload", "Reports", "Settings"].map((label) => (
                  <button key={label} type="button" className={`cebuana-preview__header-nav-item${label === "Upload" ? " cebuana-preview__header-nav-item--active" : ""}`} onClick={() => (label === "Upload" ? null : setProductionTab(label))}>{label}</button>
                ))}
              </nav>
            </div>
            <div className="cebuana-preview__topbar-actions">
              <div className="cebuana-preview__profile-pill">
                <div className="cebuana-preview__avatar">{(profile?.full_name || profile?.role || "S").charAt(0).toUpperCase()}</div>
                <span>{profile?.role ? `${profile.role.charAt(0).toUpperCase()}${profile.role.slice(1)}` : "Supervisor"}</span>
              </div>
            </div>
          </header>

          <main className="cebuana-preview__content cebuana-live-upload__content">
            <div className="cebuana-preview__toolbar">
              <div className="cebuana-preview__toolbar-copy">
                <h1>Upload DTRs and Summary</h1>
                <p>Real Cebuana upload workspace for supervisors and admins. Files here go directly to Supabase.</p>
              </div>
              <div className="cebuana-preview__toolbar-actions">
                <button type="button" className="cebuana-preview__icon-button" aria-label="Time"><Clock3 size={18} /></button>
                <button type="button" className="cebuana-preview__icon-button cebuana-preview__icon-button--alert" aria-label="Notifications"><Bell size={18} /></button>
              </div>
            </div>

            {!isSupabaseConfigured ? <div className="cebuana-live-upload__access-card"><strong>Supabase is not configured</strong><p>Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` first so the live Cebuana upload page can connect.</p></div> : !profile ? <div className="cebuana-live-upload__access-card"><strong>Sign in to continue</strong><p>The live Cebuana upload route needs a signed-in supervisor or admin account before it can load scoped guards.</p><button type="button" className="cebuana-live-upload__primary-button" onClick={() => navigate("/login/supervisor")}>Go to supervisor login</button></div> : !isPrivilegedViewer ? <div className="cebuana-live-upload__access-card"><strong>Supervisor or admin access required</strong><p>This route is reserved for scoped Cebuana operations.</p><button type="button" className="cebuana-live-upload__primary-button" onClick={() => navigate("/")}>Return to dashboard</button></div> : <>
              <div className="cebuana-live-upload__banner"><div><strong>Live Supabase upload mode</strong><span>Scope: {profile.role === "admin" ? "All branches" : getSupervisorScopeLabel(profile)}. The polished backup stays at <code>/cebuana-preview</code>.</span></div></div>
              {status.message ? <div className={`cebuana-live-upload__status-banner cebuana-live-upload__status-banner--${status.tone}`} role="status">{status.tone === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}<div><strong>{status.title || "Update"}</strong><span>{status.message}</span></div></div> : null}

                <section className="cebuana-live-upload__summary-grid">
                  <article className="cebuana-live-upload__summary-card"><span>Scoped guards</span><strong>{branchGuardCount}</strong><p>Visible inside the selected area and branch.</p></article>
                  <article className="cebuana-live-upload__summary-card"><span>DTR files staged</span><strong>{guardUploads.length}</strong><p>{guardUploads.filter((item) => item.assignedUserId).length} already mapped to a guard.</p></article>
                  <article className="cebuana-live-upload__summary-card"><span>Branch cutoff coverage</span><strong>{branchUploadedCount}</strong><p>{cutoff ? `Live rows already recorded for ${cutoff}.` : "Choose a cutoff to measure branch coverage."}</p></article>
                </section>

              <div className="cebuana-live-upload__workspace">
                <div className="cebuana-live-upload__main">
                  <section className="cebuana-live-upload__card">
                    <div className="cebuana-live-upload__card-head"><div><strong>Upload Guard DTRs</strong><p>Assign each image to a guard before it enters the review queue.</p></div><div className="cebuana-live-upload__button-stack"><button type="button" className="cebuana-live-upload__file-button" onClick={() => openNativePicker(guardInputRef)}><Upload size={16} />Add DTR files</button><input ref={guardInputRef} id="cebuana-live-guard-input" className="cebuana-live-upload__hidden-input" type="file" accept={IMAGE_ACCEPT} multiple onChange={handleGuardFilesChange} /></div></div>
                    {!branchGuardCount ? <div className="cebuana-live-upload__duplicate-warning"><strong>No guards are currently in scope for this selection.</strong><span>{areaScopedGuardCount ? "This area has guards, but not in the selected branch. Try switching to all scoped branches or choose a different branch." : "No guards were found in this area yet. Try All scoped areas or return to your assigned branch."}</span><div className="cebuana-live-upload__scope-actions"><button type="button" className="cebuana-live-upload__history-button" onClick={() => setBranch("")}>Use all scoped branches</button><button type="button" className="cebuana-live-upload__history-button" onClick={() => { setArea(profile?.location || ""); setBranch(profile?.branch || ""); }}>Use my assigned scope</button></div></div> : null}
                    {duplicateAssignedCount > 0 ? <div className="cebuana-live-upload__duplicate-warning"><strong>{duplicateAssignedCount} staged file{duplicateAssignedCount === 1 ? "" : "s"} already match this cutoff.</strong><span>{skipExistingRows ? "They will be skipped on submit because duplicate protection is enabled." : "These rows will still submit because duplicate protection is currently off."}</span></div> : null}
                    {collapsedUploadCount > 0 ? <div className="cebuana-live-upload__collapse-note"><strong>{collapsedUploadCount} uploaded file{collapsedUploadCount === 1 ? "" : "s"} hidden from staging.</strong><span>Use the live history panel on the right to inspect the latest submitted records.</span></div> : null}
                    {guardUploads.length ? <div className="cebuana-live-upload__file-list">{guardUploads.map((item) => { const assignedHasExistingCutoff = item.assignedUserId && existingCutoffKeys.has(`${item.assignedUserId}:::${cutoff}`); return <article key={item.id} className={`cebuana-live-upload__file-card cebuana-live-upload__file-card--${item.status}${assignedHasExistingCutoff ? " cebuana-live-upload__file-card--duplicate" : ""}`}><div className="cebuana-live-upload__file-thumb">{item.previewUrl ? <img src={item.previewUrl} alt={item.name} /> : <ImageIcon size={18} />}</div><div className="cebuana-live-upload__file-copy"><strong>{item.name}</strong><span>{formatFileSize(item.size)}</span><em>{item.message}</em>{assignedHasExistingCutoff ? <b className="cebuana-live-upload__inline-duplicate">Already submitted for this cutoff</b> : null}</div><label className="cebuana-live-upload__assign"><span>Guard</span><select value={item.assignedUserId} onChange={(event) => setGuardUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, assignedUserId: event.target.value, status: entry.status === "uploaded" ? entry.status : "pending", message: event.target.value ? "Ready to upload" : "Assign guard before upload" } : entry))}><option value="">Select guard</option>{sortedFilteredTeamProfiles.map((member) => { const hasExistingCutoff = existingCutoffKeys.has(`${member.id}:::${cutoff}`); return <option key={member.id} value={member.id}>{hasExistingCutoff ? "[Submitted] " : ""}{member.full_name || "Unnamed guard"}{member.employee_id ? ` • ${member.employee_id}` : ""}{member.branch ? ` • ${member.branch}` : member.location ? ` • ${member.location}` : ""}{hasExistingCutoff ? " • Already submitted" : ""}</option>; })}</select></label><button type="button" className="cebuana-live-upload__remove" onClick={() => setGuardUploads((current) => current.filter((entry) => entry.id !== item.id))}>Remove</button></article>; })}</div> : <button type="button" className="cebuana-live-upload__empty cebuana-live-upload__empty--interactive" onClick={() => openNativePicker(guardInputRef)}><Upload size={22} /><strong>No DTR files staged yet</strong><p>Add images first, then map each one to a scoped guard.</p><span>Tap here if the button above does not open the file picker.</span></button>}
                    <div className="cebuana-live-upload__actions"><label className="cebuana-live-upload__checkbox"><input type="checkbox" checked={skipExistingRows} onChange={(event) => setSkipExistingRows(event.target.checked)} /><span>Skip guards that already have a DTR for this cutoff</span></label><button type="button" className="cebuana-live-upload__primary-button" disabled={submittingDtrs || !guardUploads.length} onClick={submitGuardBatch}>{submittingDtrs ? "Uploading DTRs..." : "Submit DTR batch"}</button></div>
                    {progress.total ? <p className="cebuana-live-upload__progress">{progress.processed} of {progress.total} processed | {progress.success} successful | {progress.skipped} skipped | {progress.failed} failed</p> : null}
                  </section>

                  <section className="cebuana-live-upload__card">
                    <div className="cebuana-live-upload__card-head"><div><strong>Upload Weekly Summary</strong><p>Send one weekly summary file for the selected cutoff.</p></div><div className="cebuana-live-upload__button-stack"><button type="button" className="cebuana-live-upload__file-button cebuana-live-upload__file-button--green" onClick={() => openNativePicker(summaryInputRef)}><FileText size={16} />Choose summary</button><input ref={summaryInputRef} id="cebuana-live-summary-input" className="cebuana-live-upload__hidden-input" type="file" accept={SUMMARY_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; if (file) setSummaryUpload({ file, name: file.name, size: file.size, status: "pending", message: "Ready to upload" }); event.target.value = ""; }} /></div></div>
                    {summaryUpload ? <article className={`cebuana-live-upload__summary-file cebuana-live-upload__summary-file--${summaryUpload.status}`}><div><strong>{summaryUpload.name}</strong><span>{formatFileSize(summaryUpload.size)}</span></div><em>{summaryUpload.message}</em></article> : <div className="cebuana-live-upload__empty cebuana-live-upload__empty--summary"><FileText size={22} /><strong>No summary file selected yet</strong><p>Choose a JPG, WEBP, PNG, or PDF summary report.</p></div>}
                    <div className="cebuana-live-upload__actions"><button type="button" className="cebuana-live-upload__secondary-button" disabled={submittingSummary || !summaryUpload} onClick={submitSummary}>{submittingSummary ? "Uploading summary..." : "Submit weekly summary"}</button></div>
                  </section>
                </div>

                <aside className="cebuana-live-upload__side">
                  <section className="cebuana-live-upload__card">
                    <div className="cebuana-live-upload__card-head"><div><strong>Select Details</strong><p>These values shape the scope of the live upload batch.</p></div></div>
                    <label className="cebuana-live-upload__field"><span><CalendarDays size={15} /> Cut-off Date</span><select value={cutoff} onChange={(event) => setCutoff(event.target.value)}>{cutoffOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                    <label className="cebuana-live-upload__field"><span><MapPinned size={15} /> Area</span><select value={area} onChange={(event) => setArea(event.target.value)}><option value="">All scoped areas</option>{areaOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                    <label className="cebuana-live-upload__field"><span><Building2 size={15} /> Branch Location</span><select value={branch} onChange={(event) => setBranch(event.target.value)}><option value="">All scoped branches</option>{branchOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                    <label className="cebuana-live-upload__field"><span><Users size={15} /> Supervisor note</span><textarea rows="3" value={employeeNote} onChange={(event) => setEmployeeNote(event.target.value)} placeholder="Optional note saved into submitted DTR rows" /></label>
                    <div className="cebuana-live-upload__scope-note">
                      <strong>Branch scope snapshot</strong>
                      <span>{branchGuardCount} guard{branchGuardCount === 1 ? "" : "s"} currently in scope for this branch selection.</span>
                      <span>{branchUploadedCount} existing DTR row{branchUploadedCount === 1 ? "" : "s"} already recorded for this cutoff.</span>
                    </div>
                  </section>

                  <section className="cebuana-live-upload__card">
                    <div className="cebuana-live-upload__card-head"><div><strong>Recent DTR Uploads</strong><p>Latest scoped files submitted from this route.</p></div></div>
                    {loading ? <div className="cebuana-live-upload__mini-empty">Loading live upload history...</div> : dtrHistory.length ? <div className="cebuana-live-upload__history-list">{dtrHistory.map((row) => <article key={row.id} className="cebuana-live-upload__history-item"><div><strong>{row.profiles?.full_name || "Unnamed guard"}</strong><span>{row.cutoff} | {row.profiles?.branch || row.profiles?.location || "Unassigned"}</span></div><div className="cebuana-live-upload__history-actions">{row.preview_url ? <button type="button" className="cebuana-live-upload__history-button" onClick={() => setPreviewImage({ url: row.preview_url, title: row.profiles?.full_name || "DTR image" })}>View image</button> : <em>No preview</em>}{row.preview_url ? <a href={row.preview_url} target="_blank" rel="noreferrer">Open file</a> : null}</div></article>)}</div> : <div className="cebuana-live-upload__mini-empty">No DTR uploads from this route yet.</div>}
                  </section>

                  <section className="cebuana-live-upload__card">
                    <div className="cebuana-live-upload__card-head"><div><strong>Summary History</strong><p>Weekly summary uploads created from this workspace.</p></div></div>
                    {loading ? <div className="cebuana-live-upload__mini-empty">Loading live summary history...</div> : summaryHistory.length ? <div className="cebuana-live-upload__history-list">{summaryHistory.map((row) => <article key={row.id} className="cebuana-live-upload__history-item"><div><strong>{row.document_type}</strong><span>{new Date(row.created_at).toLocaleString()}</span></div><div className="cebuana-live-upload__history-actions">{row.preview_url ? <button type="button" className="cebuana-live-upload__history-button" onClick={() => setPreviewImage({ url: row.preview_url, title: row.document_type })}>Preview</button> : <em>No preview</em>}{row.preview_url ? <a href={row.preview_url} target="_blank" rel="noreferrer">Open file</a> : null}</div></article>)}</div> : <div className="cebuana-live-upload__mini-empty">No weekly summaries uploaded yet.</div>}
                  </section>
                </aside>
              </div>
            </>}
          </main>
        </div>
      </div>
      {previewImage ? <div className="cebuana-live-upload__lightbox" role="dialog" aria-modal="true" aria-label="Uploaded DTR preview" onClick={() => setPreviewImage(null)}><div className="cebuana-live-upload__lightbox-card" onClick={(event) => event.stopPropagation()}><div className="cebuana-live-upload__lightbox-head"><strong>{previewImage.title}</strong><button type="button" className="cebuana-live-upload__history-button" onClick={() => setPreviewImage(null)}>Close</button></div><img src={previewImage.url} alt={previewImage.title} /></div></div> : null}
    </div>
  );
}
