import { useEffect, useMemo, useRef, useState } from "react";
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
  IdCard,
  MapPin,
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
import employeeCardBackground from "../../assets/employee-card-bg.jpg";

const REQUIRED_DOCUMENTS = ["Valid ID", "NBI Clearance", "Medical Certificate", "Barangay Clearance", "Signature"];
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];
const GENDER_OPTIONS = ["Male", "Female"];
const CIVIL_STATUS_OPTIONS = ["Single", "Married", "Widowed"];

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

function formatDateTime(value) {
  if (!value) return "No date available";
  return new Date(value).toLocaleString();
}

function canEditDocument(document) {
  if (!document) return false;
  if (document.document_type === "Signature") return true;
  return Boolean(document.preview_url) || document.is_missing || document.review_status === "Needs Reupload";
}

export default function EmployeeDashboard({ user, profile, refreshProfile }) {
  const navigate = useNavigate();
  const signatureCanvasRef = useRef(null);
  const cutoffOptions = useMemo(() => buildCutoffOptions(new Date(), 48), []);
  const [cutoff, setCutoff] = useState(() => cutoffOptions[0]);
  const [file, setFile] = useState(null);
  const [employeeNote, setEmployeeNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [profileRow, setProfileRow] = useState(profile);
  const [profileChangeRequest, setProfileChangeRequest] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [activeDocument, setActiveDocument] = useState(null);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [replacementFile, setReplacementFile] = useState(null);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [hasSignatureDrawing, setHasSignatureDrawing] = useState(false);
  const [uploadingRequirement, setUploadingRequirement] = useState(false);
  const [submittingProfileRequest, setSubmittingProfileRequest] = useState(false);
  const [profileRequestLoading, setProfileRequestLoading] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({
    full_name: "",
    birthday: "",
    age: "",
    gender: "Male",
    civil_status: "Single",
    sss: "",
    philhealth: "",
    pagibig: "",
    tin: "",
  });
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

  useEffect(() => {
    if (!activeDocument || activeDocument.document_type !== "Signature") return;

    window.setTimeout(() => {
      const canvas = signatureCanvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.beginPath();
    }, 0);
  }, [activeDocument]);

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
        employee_note: employeeNote.trim() || null,
        file_url: path,
        status: "Pending Review",
        approved_at: null,
      });
      if (insertError) throw insertError;
      setFile(null);
      setEmployeeNote("");
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
    setUploadingRequirement(true);

    try {
      let path = "";
      let contentType;
      let uploadPayload;

      if (document.document_type === "Signature" && !replacementFile && hasSignatureDrawing) {
        const canvas = signatureCanvasRef.current;
        if (!canvas) {
          throw new Error("Signature pad is unavailable right now.");
        }

        const signatureBlob = await (await fetch(canvas.toDataURL("image/png"))).blob();
        path = `${user.id}/signature-${Date.now()}.png`;
        contentType = "image/png";
        uploadPayload = signatureBlob;
      } else {
        const validationError = validateRequirementFile(replacementFile, document.document_type);
        if (validationError) {
          throw new Error(validationError);
        }

        path = buildStoragePath(user.id, document.document_type, replacementFile);
        contentType = replacementFile.type || undefined;
        uploadPayload = replacementFile;
      }

      const upload = await supabase.storage.from("documents").upload(path, uploadPayload, {
        contentType,
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
      clearSignaturePad();
      toast.success(`${document.document_type} uploaded successfully.`);
      await loadDocuments();
    } catch (err) {
      toast.error(err.message || "Upload failed.");
    } finally {
      setUploadingRequirement(false);
    }
  }

  function clearSignaturePad() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      setHasSignatureDrawing(false);
      return;
    }

    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    setHasSignatureDrawing(false);
  }

  function startSignatureStroke(event) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    context.beginPath();
    context.moveTo(x, y);

    setIsDrawingSignature(true);
    setHasSignatureDrawing(true);
  }

  function drawSignatureStroke(event) {
    if (!isDrawingSignature) return;

    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    context.lineTo(x, y);
    context.stroke();
  }

  function endSignatureStroke() {
    if (!isDrawingSignature) return;
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    context?.beginPath();
    setIsDrawingSignature(false);
  }

  function openEditProfileModal() {
    const requestSource = profileChangeRequest?.status === "Pending Review" ? profileChangeRequest : null;
    setEditProfileForm({
      full_name: requestSource?.requested_full_name ?? profileRow?.full_name ?? "",
      birthday: requestSource?.requested_birthday ?? profileRow?.birthday ?? "",
      age: requestSource?.requested_age?.toString?.() ?? profileRow?.age?.toString?.() ?? "",
      gender: requestSource?.requested_gender ?? profileRow?.gender ?? "Male",
      civil_status: requestSource?.requested_civil_status ?? profileRow?.civil_status ?? "Single",
      sss: requestSource?.requested_sss ?? profileRow?.sss ?? "",
      philhealth: requestSource?.requested_philhealth ?? profileRow?.philhealth ?? "",
      pagibig: requestSource?.requested_pagibig ?? profileRow?.pagibig ?? "",
      tin: requestSource?.requested_tin ?? profileRow?.tin ?? "",
    });
    setEditProfileImageFile(null);
    setEditProfileOpen(true);
    setMoreOpen(false);
  }

  async function submitProfileChangeRequest() {
    const trimmedName = editProfileForm.full_name.trim();
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
    const nextRequestFields = {
      requested_full_name: trimmedName,
      requested_birthday: editProfileForm.birthday || null,
      requested_age: editProfileForm.age ? Number(editProfileForm.age) : null,
      requested_gender: editProfileForm.gender || null,
      requested_civil_status: editProfileForm.civil_status || null,
      requested_sss: editProfileForm.sss.trim() || null,
      requested_philhealth: editProfileForm.philhealth.trim() || null,
      requested_pagibig: editProfileForm.pagibig.trim() || null,
      requested_tin: editProfileForm.tin.trim() || null,
    };
    const hasProfileFieldChanges =
      trimmedName !== (profileRow?.full_name || "").trim() ||
      (nextRequestFields.requested_birthday || "") !== (profileRow?.birthday || "") ||
      (nextRequestFields.requested_age ?? null) !== (profileRow?.age ?? null) ||
      (nextRequestFields.requested_gender || "") !== (profileRow?.gender || "") ||
      (nextRequestFields.requested_civil_status || "") !== (profileRow?.civil_status || "") ||
      (nextRequestFields.requested_sss || "") !== (profileRow?.sss || "") ||
      (nextRequestFields.requested_philhealth || "") !== (profileRow?.philhealth || "") ||
      (nextRequestFields.requested_pagibig || "") !== (profileRow?.pagibig || "") ||
      (nextRequestFields.requested_tin || "") !== (profileRow?.tin || "");
    const hasAvatarChanged = Boolean(editProfileImageFile);

    if (!hasProfileFieldChanges && !hasAvatarChanged) {
      toast.error("Please update at least one personal detail or choose a new profile picture first.");
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
        requested_avatar_url: requestedAvatarUrl,
        ...nextRequestFields,
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

  const tasks = useMemo(() => {
    const items = [];

    documents.forEach((document) => {
      if (document.review_status === "Missing") {
        items.push({
          id: `task-missing-${document.id}`,
          title: `Upload ${document.document_type}`,
          description: "This requirement is still missing from your employee file.",
          variant: "danger",
          actionLabel: "Upload now",
          action: () => {
            setTasksOpen(false);
            setReplacementFile(null);
            setActiveDocument(document);
          },
        });
      }

      if (document.review_status === "Needs Reupload") {
        items.push({
          id: `task-reupload-${document.id}`,
          title: `Reupload ${document.document_type}`,
          description: "Admin requested a replacement file before this requirement can be verified.",
          variant: "secondary",
          actionLabel: "Open file",
          action: () => {
            setTasksOpen(false);
            setReplacementFile(null);
            setActiveDocument(document);
          },
        });
      }
    });

    if (profileChangeRequest?.status === "Rejected") {
      items.push({
        id: "task-profile-rejected",
        title: "Update your profile request",
        description: "Your last profile update request was rejected. Review it and submit a corrected version.",
        variant: "secondary",
        actionLabel: "Edit profile",
        action: openEditProfileModal,
      });
    }

    if (summary.pendingDtrs > 0) {
      items.push({
        id: "task-pending-dtr",
        title: "Wait for DTR approval",
        description: `${summary.pendingDtrs} DTR submission${summary.pendingDtrs === 1 ? "" : "s"} still waiting in the admin review queue.`,
        variant: "secondary",
        actionLabel: "Close",
        action: () => setTasksOpen(false),
      });
    }

    return items;
  }, [documents, profileChangeRequest?.status, summary.pendingDtrs]);

  const notifications = useMemo(() => {
    const items = [];

    submissions.slice(0, 4).forEach((submission) => {
      items.push({
        id: `notification-dtr-${submission.id}`,
        title:
          submission.status === "Approved"
            ? `DTR approved for ${submission.cutoff}`
            : `DTR submitted for ${submission.cutoff}`,
        description:
          submission.status === "Approved"
            ? `Approved on ${formatDateTime(submission.approved_at)}.`
            : `Submitted on ${formatDateTime(submission.created_at)} and waiting for review.`,
        createdAt: submission.approved_at || submission.created_at,
      });
    });

    documents
      .filter((document) => document.review_status !== "Missing")
      .slice(0, 4)
      .forEach((document) => {
        items.push({
          id: `notification-doc-${document.id}`,
          title: `${document.document_type} is ${document.review_status}`,
          description:
            document.review_status === "Verified"
              ? "This requirement has been cleared by admin."
              : document.review_status === "Needs Reupload"
                ? "Admin requested a replacement upload for this requirement."
                : "This file is still pending review.",
          createdAt: document.created_at,
        });
      });

    if (profileChangeRequest) {
      items.push({
        id: `notification-profile-${profileChangeRequest.id}`,
        title: `Profile request ${profileChangeRequest.status}`,
        description:
          profileChangeRequest.status === "Pending Review"
            ? "Your requested profile updates are still waiting for admin approval."
            : profileChangeRequest.status === "Approved"
              ? "Your profile update request has been approved."
              : "Your profile update request was rejected and may need changes.",
        createdAt: profileChangeRequest.reviewed_at || profileChangeRequest.created_at,
      });
    }

    return items
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 8);
  }, [documents, profileChangeRequest, submissions]);

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter((notification) => !seenNotificationIds.includes(notification.id)).length;
  }, [notifications, seenNotificationIds]);

  const messages = useMemo(() => {
    const items = [
      {
        id: "message-admin-review",
        title: "Admin review support",
        body: "Your DTRs, requirement uploads, and profile update requests are reviewed from the admin dashboard.",
      },
    ];

    if (summary.flaggedDocs > 0) {
      items.push({
        id: "message-doc-attention",
        title: "Requirements need attention",
        body: `You currently have ${summary.flaggedDocs} requirement${summary.flaggedDocs === 1 ? "" : "s"} that still need upload or reupload.`,
      });
    }

    if (profileChangeRequest?.status === "Pending Review") {
      items.push({
        id: "message-profile-pending",
        title: "Profile request in progress",
        body: "Your personal details stay unchanged until the admin approves the pending request.",
      });
    }

    if (items.length === 1) {
      items.push({
        id: "message-clear",
        title: "No urgent employee messages",
        body: "Everything looks steady right now. Keep an eye on notifications for any admin updates.",
      });
    }

    return items;
  }, [profileChangeRequest?.status, summary.flaggedDocs]);

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-slate-100 pb-24">
      <header className="sticky top-0 z-20 glass border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="rounded-xl bg-brand-500 px-3 py-1.5 text-sm font-bold text-white">CGROUP</div>
          <button
            className="relative rounded-full bg-white p-2 shadow"
            onClick={() => {
              setNotificationsOpen(true);
              setSeenNotificationIds((current) => Array.from(new Set([...current, ...notifications.map((item) => item.id)])));
            }}
          >
            <Bell size={18} />
            {unreadNotificationCount > 0 ? (
              <span className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] text-white">
                {Math.min(unreadNotificationCount, 9)}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <main className="space-y-4 p-4">
        <h2 className="text-lg font-semibold">My Profile</h2>
        <Card className="border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xl font-bold text-brand-700">
              {person.avatar_preview_url ? (
                <img src={person.avatar_preview_url} alt={person.full_name} className="h-full w-full object-cover" />
              ) : (
                person.full_name
                  .split(" ")
                  .slice(0, 4)
                  .map((n) => n[0])
                  .join("")
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-800">{person.full_name}</h2>
              <p className="text-sm text-slate-500">{person.role}</p>
            </div>
          </div>

          <div className="my-4 h-px bg-slate-200" />

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <IdCard size={14} className="text-slate-500" />
              <span className="font-medium text-slate-500">Employee ID:</span>
              <span>{person.employee_id}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-500" />
              <span className="font-medium text-slate-500">Location:</span>
              <span>{person.location}</span>
            </span>
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
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Submit only your final and correct DTR image for the selected cutoff. Double-check the file before sending because admin review is based on the uploaded copy.
            </div>
            <Select value={cutoff} onChange={(e) => setCutoff(e.target.value)}>
              {cutoffOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Note for Admin</span>
              <textarea
                className="min-h-[96px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-brand-500"
                placeholder="Optional note about this DTR submission"
                value={employeeNote}
                onChange={(e) => setEmployeeNote(e.target.value)}
              />
            </label>
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
                    {row.employee_note ? <p className="mt-1 text-xs text-slate-500">Note: {row.employee_note}</p> : null}
                    {row.admin_remarks ? <p className="mt-1 text-xs text-brand-700">Admin remarks: {row.admin_remarks}</p> : null}
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
        <Nav icon={ListChecks} label="Tasks" onClick={() => setTasksOpen(true)} />
        <button
          className="-mt-8 rounded-full bg-brand-500 p-4 text-white shadow-lg shadow-brand-500/30"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <UploadCloud size={20} />
        </button>
        <Nav icon={MessageSquareText} label="Messages" onClick={() => setMessagesOpen(true)} />
        <Nav icon={MoreHorizontal} label="More" onClick={() => setMoreOpen(true)} />
      </nav>

      <Modal
        open={Boolean(activeDocument)}
        onClose={() => {
          setActiveDocument(null);
          setReplacementFile(null);
          clearSignaturePad();
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

            {canEditDocument(activeDocument) ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {activeDocument.document_type === "Signature"
                      ? activeDocument.preview_url
                        ? "Update signature"
                        : "Upload missing signature"
                      : activeDocument.preview_url
                        ? "Upload latest requirement"
                      : activeDocument.is_missing
                        ? "Upload missing requirement"
                        : "Upload replacement"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {activeDocument.document_type === "Signature"
                      ? "Draw your signature below or upload a PNG, JPG, or WEBP file."
                      : "Accepted files: PNG, JPG, WEBP, or PDF."}
                  </p>
                </div>

                {activeDocument.document_type === "Signature" ? (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-700">Draw Signature</p>
                      <button
                        type="button"
                        className="text-xs font-medium text-rose-600 hover:underline"
                        onClick={clearSignaturePad}
                      >
                        Clear
                      </button>
                    </div>
                    <canvas
                      ref={signatureCanvasRef}
                      width={800}
                      height={220}
                      className="w-full rounded-xl border border-slate-300 bg-white touch-none"
                      onMouseDown={startSignatureStroke}
                      onMouseMove={drawSignatureStroke}
                      onMouseUp={endSignatureStroke}
                      onMouseLeave={endSignatureStroke}
                      onTouchStart={startSignatureStroke}
                      onTouchMove={drawSignatureStroke}
                      onTouchEnd={endSignatureStroke}
                    />
                    <p className="text-xs text-slate-500">
                      Sign using your mouse, touchpad, or phone screen. You can still upload an image file below if you prefer.
                    </p>
                  </div>
                ) : null}

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
                  {activeDocument.document_type === "Signature" && !replacementFile && hasSignatureDrawing
                    ? activeDocument.preview_url
                      ? "Update With Drawn Signature"
                      : "Submit Drawn Signature"
                    : activeDocument.document_type === "Signature"
                      ? activeDocument.preview_url
                        ? "Upload New Signature"
                        : "Upload Signature"
                      : activeDocument.preview_url
                        ? "Upload Latest File"
                        : activeDocument.is_missing
                          ? "Upload Requirement"
                          : "Upload Replacement"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More Actions">
        <div className="space-y-4">
          <div
            className="relative overflow-hidden rounded-[30px] p-6 text-white shadow-[0_20px_45px_rgba(24,59,120,0.28)] ring-1 ring-white/10"
            style={{
              backgroundImage: `linear-gradient(135deg, rgba(18,49,102,0.88) 0%, rgba(38,86,166,0.72) 55%, rgba(22,57,118,0.9) 100%), url(${employeeCardBackground})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_22%)]" />
            <div className="absolute -left-10 bottom-2 h-24 w-24 rounded-full bg-white/6 blur-[1px]" />
            <div className="absolute -right-7 -top-10 h-28 w-28 rounded-full bg-white/10" />
            <div className="absolute inset-x-0 top-0 h-px bg-white/30" />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[2rem] font-bold leading-tight tracking-[-0.02em]">{person.full_name}</p>
                <p className="mt-1.5 text-sm font-semibold uppercase tracking-[0.22em] text-white/78">
                  {String(person.role || "Employee").toUpperCase()}
                </p>
              </div>

              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-white text-base font-semibold text-[#234b93] shadow-[0_10px_25px_rgba(15,23,42,0.18)]">
                {person.avatar_preview_url ? (
                  <img src={person.avatar_preview_url} alt={person.full_name} className="h-full w-full object-cover" />
                ) : (
                  person.full_name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                )}
              </div>
            </div>

            <div className="relative mt-7 grid grid-cols-2 gap-x-7 gap-y-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/68">Employee ID</p>
                <p className="mt-1.5 text-[2rem] font-bold leading-none">{person.employee_id || "N/A"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/68">TIN Number</p>
                <p className="mt-1.5 text-[2rem] font-bold leading-none">{profileRow?.tin || "N/A"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/68">SSS Number</p>
                <p className="mt-1.5 text-[2rem] font-bold leading-none">{profileRow?.sss || "N/A"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/68">PhilHealth</p>
                <p className="mt-1.5 text-[2rem] font-bold leading-none">{profileRow?.philhealth || "N/A"}</p>
              </div>
            </div>

            <div className="relative mt-6 flex items-center justify-between border-t border-white/15 pt-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/82">Valid Entry</p>
              <div className="rounded-full border border-white/15 bg-white/10 p-2">
                <ShieldCheck size={16} className="text-white/90" />
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/90 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-800">Profile Edit Request</p>
                <p className="mt-1 text-sm text-slate-500">
                  Name and profile picture changes must be approved by admin before they go live.
                </p>
              </div>
              {profileRequestLoading ? null : profileChangeRequest ? <StatusBadge status={profileChangeRequest.status} /> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="justify-start rounded-2xl border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 shadow-sm"
                onClick={openEditProfileModal}
              >
                <PencilLine size={16} />
                {profileChangeRequest?.status === "Pending Review" ? "Update Pending Request" : "Edit Profile"}
              </Button>
            </div>
            {profileRequestLoading ? (
              <p className="mt-3 text-sm text-slate-500">Loading request status...</p>
            ) : profileChangeRequest ? (
              <div className="mt-4 rounded-[20px] bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-4 text-sm text-slate-600 ring-1 ring-slate-100">
                <p className="font-semibold text-slate-700">{getStatusCopy(profileChangeRequest.status)}</p>
                <p className="mt-2">Requested name: {profileChangeRequest.requested_full_name || person.full_name}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Birthday: {profileChangeRequest.requested_birthday || profileRow?.birthday || "Not set"} | Gender:{" "}
                  {profileChangeRequest.requested_gender || profileRow?.gender || "Not set"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Submitted {new Date(profileChangeRequest.created_at).toLocaleString()}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                No profile edit request submitted yet.
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Button
              variant="secondary"
              className="w-full justify-center rounded-2xl border-slate-200 bg-white py-3 text-slate-700 shadow-sm"
              loading={refreshing}
              onClick={refreshDashboard}
            >
              <RefreshCw size={16} />
              Refresh Dashboard
            </Button>
            <Button
              variant="danger"
              className="w-full justify-center rounded-2xl border-0 py-3 shadow-[0_16px_30px_rgba(244,63,94,0.24)]"
              loading={loggingOut}
              onClick={handleLogout}
            >
              <LogOut size={16} />
              Sign Out
            </Button>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white/90 p-4 text-sm text-slate-600 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
            You currently have {summary.flaggedDocs} file{summary.flaggedDocs === 1 ? "" : "s"} that need attention and{" "}
            {summary.pendingDtrs} DTR submission{summary.pendingDtrs === 1 ? "" : "s"} still pending review.
          </div>
        </div>
      </Modal>

      <Modal open={tasksOpen} onClose={() => setTasksOpen(false)} title="My Tasks">
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              You have no urgent employee tasks right now.
            </div>
          ) : null}

          {tasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">{task.title}</p>
              <p className="mt-1 text-sm text-slate-600">{task.description}</p>
              <div className="mt-3">
                <Button className="w-full" variant={task.variant} onClick={task.action}>
                  {task.actionLabel}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifications">
        <div className="space-y-3">
          {notifications.length === 0 ? <p className="text-sm text-slate-500">No notifications yet.</p> : null}

          {notifications.map((notification) => (
            <div key={notification.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
              <p className="mt-1 text-sm text-slate-600">{notification.description}</p>
              <p className="mt-2 text-xs text-slate-400">{formatDateTime(notification.createdAt)}</p>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={messagesOpen} onClose={() => setMessagesOpen(false)} title="Messages">
        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">{message.title}</p>
              <p className="mt-1 text-sm text-slate-600">{message.body}</p>
            </div>
          ))}

          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Need follow-up? Contact your assigned supervisor or the admin team for document, profile, or DTR concerns.
          </div>
        </div>
      </Modal>

      <Modal open={editProfileOpen} onClose={() => setEditProfileOpen(false)} title="Request Profile Update">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-500">
              {activeProfileRequestAvatar ? (
                <img
                  src={activeProfileRequestAvatar}
                  alt={editProfileForm.full_name || person.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound size={24} />
              )}
            </div>
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">Current profile approval flow</p>
              <p>Submit your new name and profile picture here. Admin must approve before your live profile updates.</p>
            </div>
          </div>

          <Input
            label="Full Name"
            value={editProfileForm.full_name}
            onChange={(e) => setEditProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Birthday"
              type="date"
              value={editProfileForm.birthday}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, birthday: e.target.value }))}
            />
            <Input
              label="Age"
              type="number"
              value={editProfileForm.age}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, age: e.target.value }))}
            />
            <Select
              label="Gender"
              value={editProfileForm.gender}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, gender: e.target.value }))}
            >
              {GENDER_OPTIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            <Select
              label="Civil Status"
              value={editProfileForm.civil_status}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, civil_status: e.target.value }))}
            >
              {CIVIL_STATUS_OPTIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            <Input
              label="SSS"
              value={editProfileForm.sss}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, sss: e.target.value }))}
            />
            <Input
              label="PhilHealth"
              value={editProfileForm.philhealth}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, philhealth: e.target.value }))}
            />
            <Input
              label="Pag-IBIG"
              value={editProfileForm.pagibig}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, pagibig: e.target.value }))}
            />
            <Input
              label="TIN"
              value={editProfileForm.tin}
              onChange={(e) => setEditProfileForm((prev) => ({ ...prev, tin: e.target.value }))}
            />
          </div>

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
