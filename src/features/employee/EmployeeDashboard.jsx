import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  LayoutDashboard,
  ListChecks,
  UploadCloud,
  MessageSquareText,
  MoreHorizontal,
  Camera,
  ImageUp,
  ExternalLink,
  FileImage,
  FileText,
  ShieldCheck,
  LogOut,
  RefreshCw,
  UserRound,
  PencilLine,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import StatusBadge from "../../components/ui/StatusBadge";
import { supabase } from "../../lib/supabase";
import { attachSignedUrls } from "../../lib/storage";
import { buildCutoffOptions } from "../../lib/dtr";

const REQUIRED_DOCUMENTS = ["Valid ID", "NBI Clearance", "Medical Certificate", "Barangay Clearance", "Signature"];
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];

function isPdfFile(path = "") {
  return /\.pdf($|\?)/i.test(path);
}

function getDocumentIcon(path = "") {
  return isPdfFile(path) ? FileText : FileImage;
}

function buildStoragePath(userId, label, file) {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  return `${userId}/${safeLabel}-${Date.now()}.${ext}`;
}

function validateRequirementFile(file, documentType) {
  if (!file) return "Please choose a file first.";
  const allowedTypes = documentType === "Signature" ? IMAGE_TYPES : DOCUMENT_TYPES;
  if (file.type && !allowedTypes.includes(file.type)) {
    return documentType === "Signature"
      ? "Signature must be uploaded as PNG, JPG, or WEBP."
      : "Requirement must be uploaded as PNG, JPG, WEBP, or PDF.";
  }
  return null;
}

function validateAvatarFile(file) {
  if (!file) return null;
  if (file.type && !IMAGE_TYPES.includes(file.type)) {
    return "Profile picture must be PNG, JPG, or WEBP.";
  }
  return null;
}

function getStatusCopy(status) {
  if (status === "Approved") return "Approved by admin";
  if (status === "Rejected") return "Rejected by admin";
  return "Waiting for admin approval";
}

export default function EmployeeDashboard({ user, profile, refreshProfile }) {
  const navigate = useNavigate();
  const cutoffOptions = useMemo(() => buildCutoffOptions(new Date(), 4), []);
  const [cutoff, setCutoff] = useState(() => cutoffOptions[0]);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [profileRow, setProfileRow] = useState(profile);
  const [profileChangeRequest, setProfileChangeRequest] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [activeDocument, setActiveDocument] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [replacementFile, setReplacementFile] = useState(null);
  const [uploadingRequirement, setUploadingRequirement] = useState(false);
  const [submittingProfileRequest, setSubmittingProfileRequest] = useState(false);
  const [profileRequestLoading, setProfileRequestLoading] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileImageFile, setEditProfileImageFile] = useState(null);
  const [editProfileImagePreview, setEditProfileImagePreview] = useState("");

  useEffect(() => {
    setProfileRow(profile);
  }, [profile]);

  useEffect(() => {
    loadDashboardData();
    const channel = supabase
      .channel("employee-dtr-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "dtr_submissions", filter: `user_id=eq.${user.id}` }, loadSubmissions)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_documents", filter: `user_id=eq.${user.id}` }, loadDocuments)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, loadDashboardData)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_change_requests", filter: `user_id=eq.${user.id}` }, loadProfileChangeRequest)
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editProfileImageFile) {
      setEditProfileImagePreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(editProfileImageFile);
    setEditProfileImagePreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [editProfileImageFile]);

  async function loadProfileRow() {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) return profileRow ?? null;

    let nextProfile = data ?? null;
    if (nextProfile?.avatar_url) {
      const [withSignedAvatar] = await attachSignedUrls([nextProfile], "documents", "avatar_url");
      nextProfile = withSignedAvatar ?? nextProfile;
    }

    setProfileRow(nextProfile);
    await refreshProfile?.();
    return nextProfile;
  }

  async function loadProfileChangeRequest() {
    setProfileRequestLoading(true);
    const { data, error } = await supabase
      .from("profile_change_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) {
      let nextRequest = data ?? null;
      if (nextRequest?.requested_avatar_url) {
        const [withSignedAvatar] = await attachSignedUrls([nextRequest], "documents", "requested_avatar_url");
        nextRequest = withSignedAvatar ?? nextRequest;
      }
      setProfileChangeRequest(nextRequest);
    }

    setProfileRequestLoading(false);
  }

  async function loadDashboardData() {
    await Promise.all([loadSubmissions(), loadDocuments(), loadProfileChangeRequest()]);
  }

  async function loadSubmissions() {
    const { data, error } = await supabase
      .from("dtr_submissions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);
    if (!error) {
      const withSignedUrls = await attachSignedUrls(data ?? [], "dtr-images");
      setSubmissions(withSignedUrls);
    }
  }

  async function loadDocuments() {
    setDocumentsLoading(true);
    const currentProfile = await loadProfileRow();

    const { data, error } = await supabase
      .from("employee_documents")
      .select("id,document_type,file_url,review_status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message || "Unable to load requirements.");
      setDocumentsLoading(false);
      return;
    }

    let docs = await attachSignedUrls(data ?? [], "documents");
    docs = docs.map((document) => ({
      ...document,
      review_status: document.review_status || "Pending Review",
      source_table: "employee_documents",
      is_missing: false,
    }));

    if (currentProfile?.signature_url) {
      const signatureRows = await attachSignedUrls(
        [
          {
            id: `signature-${user.id}`,
            document_type: "Signature",
            file_url: currentProfile.signature_url,
            created_at: currentProfile.created_at,
          },
        ],
        "documents"
      );
      docs = [
        ...signatureRows.map((document) => ({
          ...document,
          review_status: currentProfile.signature_status || "Pending Review",
          source_table: "profiles",
          is_missing: false,
        })),
        ...docs,
      ];
    }

    const byType = new Map(docs.map((document) => [document.document_type, document]));
    const mergedDocs = REQUIRED_DOCUMENTS.map(
      (type) =>
        byType.get(type) || {
          id: `missing-${user.id}-${type}`,
          document_type: type,
          file_url: "",
          created_at: null,
          review_status: "Missing",
          preview_url: null,
          source_table: "virtual",
          is_missing: true,
        }
    );
    const extraDocs = docs.filter((document) => !REQUIRED_DOCUMENTS.includes(document.document_type));
    const nextDocuments = [...mergedDocs, ...extraDocs];

    setDocuments(nextDocuments);
    setActiveDocument((current) => nextDocuments.find((item) => item.id === current?.id) || null);
    setDocumentsLoading(false);
  }

  async function submitDtr() {
    if (!file) return toast.error("Please upload a DTR image.");
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("dtr-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("dtr_submissions").insert({
        user_id: user.id,
        cutoff,
        file_url: path,
        status: "Pending Review",
        approved_at: null,
      });
      if (insertError) throw insertError;
      setFile(null);
      toast.success("DTR submitted successfully.");
      await loadSubmissions();
    } catch (err) {
      toast.error(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshDashboard() {
    setRefreshing(true);
    try {
      await loadDashboardData();
      toast.success("Dashboard refreshed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function uploadRequirement(document) {
    const validationError = validateRequirementFile(replacementFile, document.document_type);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setUploadingRequirement(true);

    try {
      const path = buildStoragePath(user.id, document.document_type, replacementFile);
      const upload = await supabase.storage.from("documents").upload(path, replacementFile, {
        contentType: replacementFile.type || undefined,
        upsert: false,
      });
      if (upload.error) throw upload.error;

      if (document.document_type === "Signature") {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            signature_url: path,
            signature_status: "Pending Review",
          })
          .eq("id", user.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("employee_documents").insert({
          user_id: user.id,
          document_type: document.document_type,
          file_url: path,
          review_status: "Pending Review",
        });
        if (insertError) throw insertError;
      }

      setReplacementFile(null);
      toast.success(`${document.document_type} uploaded successfully.`);
      await loadDocuments();
    } catch (err) {
      toast.error(err.message || "Upload failed.");
    } finally {
      setUploadingRequirement(false);
    }
  }

  function openEditProfileModal() {
    setEditProfileName(
      profileChangeRequest?.status === "Pending Review" ? profileChangeRequest.requested_full_name || person.full_name : person.full_name
    );
    setEditProfileImageFile(null);
    setEditProfileOpen(true);
    setMoreOpen(false);
  }

  async function submitProfileChangeRequest() {
    const trimmedName = editProfileName.trim();
    if (!trimmedName) {
      toast.error("Please enter your full name.");
      return;
    }

    const avatarError = validateAvatarFile(editProfileImageFile);
    if (avatarError) {
      toast.error(avatarError);
      return;
    }

    const desiredAvatarUrl =
      (editProfileImageFile ? null : profileChangeRequest?.status === "Pending Review" ? profileChangeRequest.requested_avatar_url : null) ??
      profileRow?.avatar_url ??
      null;
    const hasNameChanged = trimmedName !== (profileRow?.full_name || "").trim();
    const hasAvatarChanged = Boolean(editProfileImageFile);

    if (!hasNameChanged && !hasAvatarChanged) {
      toast.error("Please change your name or choose a new profile picture first.");
      return;
    }

    setSubmittingProfileRequest(true);

    try {
      let requestedAvatarUrl = desiredAvatarUrl;
      if (editProfileImageFile) {
        const avatarPath = buildStoragePath(user.id, "avatar", editProfileImageFile);
        const upload = await supabase.storage.from("documents").upload(avatarPath, editProfileImageFile, {
          contentType: editProfileImageFile.type || undefined,
          upsert: false,
        });
        if (upload.error) throw upload.error;
        requestedAvatarUrl = avatarPath;
      }

      const payload = {
        user_id: user.id,
        requested_full_name: trimmedName,
        requested_avatar_url: requestedAvatarUrl,
        status: "Pending Review",
        reviewed_at: null,
      };

      const hasPendingRequest = profileChangeRequest?.status === "Pending Review";
      const query = hasPendingRequest
        ? supabase.from("profile_change_requests").update(payload).eq("id", profileChangeRequest.id)
        : supabase.from("profile_change_requests").insert(payload);

      const { error } = await query;
      if (error) throw error;

      toast.success(hasPendingRequest ? "Pending profile request updated." : "Profile edit request sent to admin.");
      setEditProfileOpen(false);
      setEditProfileImageFile(null);
      await loadProfileChangeRequest();
    } catch (err) {
      toast.error(err.message || "Unable to submit profile request.");
    } finally {
      setSubmittingProfileRequest(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    setLoggingOut(false);

    if (error) {
      toast.error(error.message || "Unable to sign out.");
      return;
    }

    setMoreOpen(false);
    navigate("/login", { replace: true });
  }

  const person = useMemo(() => {
    return {
      full_name: profileRow?.full_name ?? "John Dela Cruz",
      role: profileRow?.position ?? profileRow?.role ?? "Janitor",
      employee_id: profileRow?.employee_id ?? "EMP-00124",
      location: profileRow?.location ?? "ABC Building",
      avatar_url: profileRow?.avatar_url ?? "",
      avatar_preview_url: profileRow?.preview_url ?? "",
    };
  }, [profileRow]);

  const activeProfileRequestAvatar =
    editProfileImagePreview ||
    (profileChangeRequest?.status === "Pending Review" ? profileChangeRequest.preview_url : "") ||
    person.avatar_preview_url;

  const summary = useMemo(() => {
    const pendingDtrs = submissions.filter((item) => item.status === "Pending Review").length;
    const approvedDtrs = submissions.filter((item) => item.status === "Approved").length;
    const verifiedDocs = documents.filter((item) => item.review_status === "Verified").length;
    const flaggedDocs = documents.filter(
      (item) => item.review_status === "Needs Reupload" || item.review_status === "Missing"
    ).length;

    return { pendingDtrs, approvedDtrs, verifiedDocs, flaggedDocs };
  }, [documents, submissions]);

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-slate-100 pb-24">
      <header className="sticky top-0 z-20 glass border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-bold text-white">OMGJ</div>
          <button className="relative rounded-full bg-white p-2 shadow">
            <Bell size={18} />
            {summary.flaggedDocs > 0 ? (
              <span className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] text-white">
                {summary.flaggedDocs}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <main className="space-y-4 p-4">
        <Card className="bg-gradient-to-r from-brand-500 to-brand-600 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white/20 text-xl font-bold">
              {person.avatar_preview_url ? (
                <img src={person.avatar_preview_url} alt={person.full_name} className="h-full w-full object-cover" />
              ) : (
                person.full_name
                  .split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{person.full_name}</h2>
              <p className="text-sm opacity-90">{person.role}</p>
              <p className="text-xs opacity-80">
                {person.employee_id} | {person.location}
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-slate-900 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Pending DTR</p>
            <p className="mt-2 text-2xl font-bold">{summary.pendingDtrs}</p>
            <p className="mt-1 text-xs text-slate-300">Waiting for payroll review</p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Approved DTR</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{summary.approvedDtrs}</p>
            <p className="mt-1 text-xs text-slate-500">Recent approved cutoffs</p>
          </Card>
          <Card className="bg-white">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Verified Files</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{summary.verifiedDocs}</p>
            <p className="mt-1 text-xs text-slate-500">Docs cleared by admin</p>
          </Card>
          <Card className="bg-rose-50">
            <p className="text-xs uppercase tracking-[0.18em] text-rose-500">Needs Action</p>
            <p className="mt-2 text-2xl font-bold text-rose-600">{summary.flaggedDocs}</p>
            <p className="mt-1 text-xs text-rose-600">Missing or for reupload</p>
          </Card>
        </div>

        <Card>
          <h3 className="mb-3 text-base font-semibold">Submit DTR</h3>
          <div className="space-y-3">
            <Select value={cutoff} onChange={(e) => setCutoff(e.target.value)}>
              {cutoffOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-brand-400">
              <div className="mb-2 flex gap-2 text-slate-500">
                <Camera size={18} />
                <ImageUp size={18} />
              </div>
              <p className="text-sm text-slate-600">{file ? file.name : "Tap to upload DTR image"}</p>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0])} />
            </label>
            <Button className="w-full" loading={submitting} onClick={submitDtr}>
              Submit DTR
            </Button>
          </div>
        </Card>

        <div>
          <h3 className="mb-2 text-base font-semibold">Recent Submissions</h3>
          <div className="space-y-2">
            {submissions.map((row) => (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-white p-3 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</p>
                    <p className="text-sm font-medium text-slate-700">{row.cutoff}</p>
                    {row.approved_at ? (
                      <p className="text-xs text-emerald-600">Approved: {new Date(row.approved_at).toLocaleString()}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              </motion.div>
            ))}
            {submissions.length === 0 ? <p className="text-sm text-slate-500">No submissions yet.</p> : null}
          </div>
        </div>

        <Card>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Document Status</h3>
              <p className="text-sm text-slate-500">Track uploaded requirements and signature review.</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
              <ShieldCheck size={18} />
            </div>
          </div>

          <div className="space-y-2">
            {documentsLoading ? <p className="text-sm text-slate-500">Loading documents...</p> : null}
            {!documentsLoading
              ? documents.map((document) => {
                  const Icon = getDocumentIcon(document.file_url);

                  return (
                    <button
                      key={document.id}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-brand-300 hover:bg-white"
                      onClick={() => {
                        setReplacementFile(null);
                        setActiveDocument(document);
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-xl bg-white p-2 text-slate-600 shadow-sm">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{document.document_type}</p>
                          <p className="truncate text-xs text-slate-500">
                            {document.created_at
                              ? new Date(document.created_at).toLocaleString()
                              : document.is_missing
                              ? "Upload required"
                              : "Waiting for timestamp"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={document.review_status} />
                    </button>
                  );
                })
              : null}
            {!documentsLoading && documents.length === 0 ? (
              <p className="text-sm text-slate-500">No uploaded documents found yet.</p>
            ) : null}
          </div>
        </Card>
      </main>

      <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-md -translate-x-1/2 items-center justify-around border-t border-slate-200 bg-white px-2 py-2">
        <Nav icon={LayoutDashboard} label="Dashboard" />
        <Nav icon={ListChecks} label="Tasks" />
        <button className="-mt-8 rounded-full bg-brand-500 p-4 text-white shadow-lg shadow-brand-500/30">
          <UploadCloud size={20} />
        </button>
        <Nav icon={MessageSquareText} label="Messages" />
        <Nav icon={MoreHorizontal} label="More" onClick={() => setMoreOpen(true)} />
      </nav>

      <Modal
        open={Boolean(activeDocument)}
        onClose={() => {
          setActiveDocument(null);
          setReplacementFile(null);
        }}
        title={activeDocument?.document_type || "Document Preview"}
      >
        {activeDocument ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{activeDocument.document_type}</p>
                  <StatusBadge status={activeDocument.review_status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {activeDocument.created_at
                    ? new Date(activeDocument.created_at).toLocaleString()
                    : "No upload record available yet."}
                </p>
              </div>
              {activeDocument.preview_url ? (
                <a
                  href={activeDocument.preview_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink size={16} />
                  Open File
                </a>
              ) : null}
            </div>

            {activeDocument.preview_url ? (
              isPdfFile(activeDocument.file_url) ? (
                <iframe
                  title={activeDocument.document_type}
                  src={activeDocument.preview_url}
                  className="h-[60vh] w-full rounded-2xl border border-slate-200"
                />
              ) : (
                <img
                  src={activeDocument.preview_url}
                  alt={activeDocument.document_type}
                  className="max-h-[60vh] w-full rounded-2xl border border-slate-200 object-contain"
                />
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                {activeDocument.is_missing
                  ? "This requirement has not been uploaded yet."
                  : "Preview is currently unavailable for this file."}
              </div>
            )}

            {activeDocument.review_status === "Needs Reupload" ? (
              <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
                This file was flagged for reupload. Upload a replacement below to send it back for review.
              </div>
            ) : null}

            {(activeDocument.is_missing || activeDocument.review_status === "Needs Reupload") ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {activeDocument.is_missing ? "Upload missing requirement" : "Upload replacement"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {activeDocument.document_type === "Signature"
                      ? "Signature accepts PNG, JPG, or WEBP."
                      : "Accepted files: PNG, JPG, WEBP, or PDF."}
                  </p>
                </div>

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-center transition hover:border-brand-400">
                  <div className="mb-2 flex gap-2 text-slate-500">
                    <Camera size={18} />
                    <ImageUp size={18} />
                  </div>
                  <p className="text-sm text-slate-600">
                    {replacementFile ? replacementFile.name : `Choose ${activeDocument.document_type} file`}
                  </p>
                  <input
                    type="file"
                    accept={activeDocument.document_type === "Signature" ? "image/png,image/jpeg,image/webp" : "image/*,.pdf"}
                    className="hidden"
                    onChange={(e) => setReplacementFile(e.target.files?.[0] ?? null)}
                  />
                </label>

                <Button className="w-full" loading={uploadingRequirement} onClick={() => uploadRequirement(activeDocument)}>
                  {activeDocument.is_missing ? "Upload Requirement" : "Upload Replacement"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More Actions">
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-brand-500/10 text-brand-700">
                {person.avatar_preview_url ? (
                  <img src={person.avatar_preview_url} alt={person.full_name} className="h-full w-full object-cover" />
                ) : (
                  <UserRound size={18} />
                )}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{person.full_name}</p>
                <p className="text-sm text-slate-500">
                  {person.employee_id} | {person.role}
                </p>
                <p className="text-xs text-slate-400">{person.location}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Profile Edit Request</p>
                <p className="mt-1 text-xs text-slate-500">
                  Name and profile picture changes must be approved by admin before they go live.
                </p>
              </div>
              {profileRequestLoading ? null : profileChangeRequest ? <StatusBadge status={profileChangeRequest.status} /> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" className="justify-start" onClick={openEditProfileModal}>
                <PencilLine size={16} />
                {profileChangeRequest?.status === "Pending Review" ? "Update Pending Request" : "Edit Profile"}
              </Button>
            </div>
            {profileRequestLoading ? (
              <p className="mt-3 text-sm text-slate-500">Loading request status...</p>
            ) : profileChangeRequest ? (
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <p className="font-medium text-slate-700">{getStatusCopy(profileChangeRequest.status)}</p>
                <p className="mt-1">Requested name: {profileChangeRequest.requested_full_name || person.full_name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Submitted {new Date(profileChangeRequest.created_at).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No profile edit request submitted yet.</p>
            )}
          </div>

          <div className="grid gap-2">
            <Button variant="secondary" className="w-full justify-start" loading={refreshing} onClick={refreshDashboard}>
              <RefreshCw size={16} />
              Refresh Dashboard
            </Button>
            <Button variant="danger" className="w-full justify-start" loading={loggingOut} onClick={handleLogout}>
              <LogOut size={16} />
              Sign Out
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            You currently have {summary.flaggedDocs} file{summary.flaggedDocs === 1 ? "" : "s"} that need attention and{" "}
            {summary.pendingDtrs} DTR submission{summary.pendingDtrs === 1 ? "" : "s"} still pending review.
          </div>
        </div>
      </Modal>

      <Modal open={editProfileOpen} onClose={() => setEditProfileOpen(false)} title="Request Profile Update">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-500">
              {activeProfileRequestAvatar ? (
                <img src={activeProfileRequestAvatar} alt={editProfileName || person.full_name} className="h-full w-full object-cover" />
              ) : (
                <UserRound size={24} />
              )}
            </div>
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">Current profile approval flow</p>
              <p>Submit your new name and profile picture here. Admin must approve before your live profile updates.</p>
            </div>
          </div>

          <Input label="Full Name" value={editProfileName} onChange={(e) => setEditProfileName(e.target.value)} />

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Profile Picture</span>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-brand-400">
              <div className="mb-2 flex gap-2 text-slate-500">
                <Camera size={18} />
                <ImageUp size={18} />
              </div>
              <p className="text-sm text-slate-600">
                {editProfileImageFile ? editProfileImageFile.name : "Choose a new profile picture"}
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => setEditProfileImageFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">Accepted files: PNG, JPG, or WEBP.</p>
          </label>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            {profileChangeRequest?.status === "Pending Review"
              ? "A pending request already exists. Submitting again will update the pending request."
              : "Your current profile will stay the same until an admin approves this request."}
          </div>

          <Button className="w-full" loading={submittingProfileRequest} onClick={submitProfileChangeRequest}>
            {profileChangeRequest?.status === "Pending Review" ? "Update Pending Request" : "Submit For Approval"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Nav({ icon: Icon, label, onClick }) {
  return (
    <button
      className="flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:text-brand-600"
      onClick={onClick}
    >
      <Icon size={17} />
      {label}
    </button>
  );
}
