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
  X,
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
import { EMPLOYEE_PRESENCE_HEARTBEAT_MS } from "../../lib/presence";
import employeeCardBackground from "../../assets/employee-card-bg.jpg";
import "./EmployeeDashboard.css";

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
    let cancelled = false;

    async function updatePresence() {
      if (cancelled) return;
      await supabase.from("employee_presence").upsert(
        {
          user_id: user.id,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    void updatePresence();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void updatePresence();
      }
    }, EMPLOYEE_PRESENCE_HEARTBEAT_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void updatePresence();
      }
    };

    window.addEventListener("focus", updatePresence);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", updatePresence);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user.id]);

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
    await supabase.from("employee_presence").upsert(
      {
        user_id: user.id,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
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
    <div className="employee-dashboard">
      <header className="employee-dashboard__header glass">
        <div className="employee-dashboard__header-inner">
          <div className="employee-dashboard__brand">CGROUP</div>
          <button
            className="employee-dashboard__icon-button"
            onClick={() => {
              setNotificationsOpen(true);
              setSeenNotificationIds((current) => Array.from(new Set([...current, ...notifications.map((item) => item.id)])));
            }}
          >
            <Bell size={18} />
            {unreadNotificationCount > 0 ? (
              <span className="employee-dashboard__badge">
                {Math.min(unreadNotificationCount, 9)}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <main className="employee-dashboard__content employee-dashboard__stack-lg">
        <h2 className="employee-dashboard__section-title">My Profile</h2>
        <Card className="employee-dashboard__profile-card">
          <div className="employee-dashboard__profile-header">
            <div className="employee-dashboard__profile-avatar">
              {person.avatar_preview_url ? (
                <img src={person.avatar_preview_url} alt={person.full_name} className="employee-dashboard__img-cover" />
              ) : (
                person.full_name
                  .split(" ")
                  .slice(0, 4)
                  .map((n) => n[0])
                  .join("")
              )}
            </div>

            <div>
              <h2 className="employee-dashboard__profile-name">{person.full_name}</h2>
              <p className="employee-dashboard__profile-role">{person.role}</p>
            </div>
          </div>

          <div className="employee-dashboard__profile-divider" />

          <div className="employee-dashboard__profile-meta">
            <span className="employee-dashboard__profile-meta-item">
              <IdCard size={14} className="text-slate-500" />
              <span className="employee-dashboard__label-strong">Employee ID:</span>
              <span>{person.employee_id}</span>
            </span>
            <span className="employee-dashboard__profile-meta-item">
              <MapPin size={14} className="text-slate-500" />
              <span className="employee-dashboard__label-strong">Location:</span>
              <span>{person.location}</span>
            </span>
          </div>
        </Card>

        <div className="employee-dashboard__stats-grid">
          <Card className="employee-dashboard__stat-card--dark">
            <p className="employee-dashboard__stat-label employee-dashboard__stat-label--dark">Pending DTR</p>
            <p className="employee-dashboard__stat-value">{summary.pendingDtrs}</p>
            <p className="employee-dashboard__stat-copy employee-dashboard__stat-copy--dark">Waiting for payroll review</p>
          </Card>
          <Card className="employee-dashboard__stat-card--light">
            <p className="employee-dashboard__stat-label employee-dashboard__stat-label--light">Approved DTR</p>
            <p className="employee-dashboard__stat-value employee-dashboard__stat-value--light">{summary.approvedDtrs}</p>
            <p className="employee-dashboard__stat-copy employee-dashboard__stat-copy--light">Recent approved cutoffs</p>
          </Card>
          <Card className="employee-dashboard__stat-card--light">
            <p className="employee-dashboard__stat-label employee-dashboard__stat-label--light">Verified Files</p>
            <p className="employee-dashboard__stat-value employee-dashboard__stat-value--success">{summary.verifiedDocs}</p>
            <p className="employee-dashboard__stat-copy employee-dashboard__stat-copy--light">Docs cleared by admin</p>
          </Card>
          <Card className="employee-dashboard__stat-card--alert">
            <p className="employee-dashboard__stat-label employee-dashboard__stat-label--alert">Needs Action</p>
            <p className="employee-dashboard__stat-value employee-dashboard__stat-value--alert">{summary.flaggedDocs}</p>
            <p className="employee-dashboard__stat-copy employee-dashboard__stat-copy--alert">Missing or for reupload</p>
          </Card>
        </div>

        <Card>
          <h3 className="employee-dashboard__subsection-title employee-dashboard__subsection-title--with-margin">Submit DTR</h3>
          <div className="employee-dashboard__stack-md">
            <div className="employee-dashboard__info-banner">
              Submit only your final and correct DTR image for the selected cutoff. Double-check the file before sending because admin review is based on the uploaded copy.
            </div>
            <Select value={cutoff} onChange={(e) => setCutoff(e.target.value)}>
              {cutoffOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
            <label className="employee-dashboard__textarea-label">
              <span className="employee-dashboard__textarea-label-text">Note for Admin</span>
              <textarea
                className="employee-dashboard__textarea"
                placeholder="Optional note about this DTR submission"
                value={employeeNote}
                onChange={(e) => setEmployeeNote(e.target.value)}
              />
            </label>
            <label className="employee-dashboard__upload-card">
              <div className="employee-dashboard__upload-icons">
                <Camera size={18} />
                <ImageUp size={18} />
              </div>
              <p className="employee-dashboard__copy-sm">{file ? file.name : "Tap to upload DTR image"}</p>
              <input type="file" accept="image/*" className="employee-dashboard__hidden-input" onChange={(e) => setFile(e.target.files?.[0])} />
            </label>
            <Button className="employee-dashboard__btn-full" loading={submitting} onClick={submitDtr}>
              Submit DTR
            </Button>
          </div>
        </Card>

        <div>
          <h3 className="employee-dashboard__subsection-title employee-dashboard__subsection-title--tight">Recent Submissions</h3>
          <div className="employee-dashboard__recent-list">
            {submissions.map((row) => (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="employee-dashboard__recent-item"
              >
                <div className="employee-dashboard__recent-item-header">
                  <div>
                    <p className="employee-dashboard__copy-xs">{new Date(row.created_at).toLocaleString()}</p>
                    <p className="employee-dashboard__text-strong">{row.cutoff}</p>
                    {row.employee_note ? <p className="employee-dashboard__copy-xs-spaced">Note: {row.employee_note}</p> : null}
                    {row.admin_remarks ? <p className="employee-dashboard__copy-xs-spaced-brand">Admin remarks: {row.admin_remarks}</p> : null}
                    {row.approved_at ? (
                      <p className="employee-dashboard__copy-xs-success">Approved: {new Date(row.approved_at).toLocaleString()}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              </motion.div>
            ))}
            {submissions.length === 0 ? <p className="employee-dashboard__copy-sm">No submissions yet.</p> : null}
          </div>
        </div>

        <Card>
          <div className="employee-dashboard__section-head">
            <div>
              <h3 className="employee-dashboard__subsection-title">Document Status</h3>
              <p className="employee-dashboard__copy-sm">Track uploaded requirements and signature review.</p>
            </div>
            <div className="employee-dashboard__section-icon">
              <ShieldCheck size={18} />
            </div>
          </div>

          <div className="employee-dashboard__stack">
            {documentsLoading ? <p className="employee-dashboard__copy-sm">Loading documents...</p> : null}
            {!documentsLoading
              ? documents.map((document) => {
                const Icon = getDocumentIcon(document.file_url);

                return (
                  <button
                    key={document.id}
                    className="employee-dashboard__doc-row"
                    onClick={() => {
                      setReplacementFile(null);
                      setActiveDocument(document);
                    }}
                  >
                    <div className="employee-dashboard__doc-row-main">
                      <div className="employee-dashboard__doc-row-icon">
                        <Icon size={18} />
                      </div>
                      <div className="employee-dashboard__min-w-0">
                        <p className="employee-dashboard__truncate employee-dashboard__text-strong-dark">{document.document_type}</p>
                        <p className="employee-dashboard__truncate employee-dashboard__copy-xs">
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
              <p className="employee-dashboard__copy-sm">No uploaded documents found yet.</p>
            ) : null}
          </div>
        </Card>
      </main>

      <nav className="employee-dashboard__bottom-nav">
        <Nav icon={LayoutDashboard} label="Dashboard" />
        <Nav icon={ListChecks} label="Tasks" onClick={() => setTasksOpen(true)} />
        <button
          className="employee-dashboard__nav-center"
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
          <div className="employee-dashboard__stack-lg">
            <div className="employee-dashboard__preview-head">
              <div>
                <div className="employee-dashboard__row-between employee-dashboard__row-gap-sm">
                  <p className="employee-dashboard__text-strong-dark">{activeDocument.document_type}</p>
                  <StatusBadge status={activeDocument.review_status} />
                </div>
                <p className="employee-dashboard__preview-meta">
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
                  className="employee-dashboard__preview-link"
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
                  className="employee-dashboard__preview-frame"
                />
              ) : (
                <img
                  src={activeDocument.preview_url}
                  alt={activeDocument.document_type}
                  className="employee-dashboard__preview-image"
                />
              )
            ) : (
              <div className="employee-dashboard__preview-empty">
                {activeDocument.is_missing
                  ? "This requirement has not been uploaded yet."
                  : "Preview is currently unavailable for this file."}
              </div>
            )}

            {activeDocument.review_status === "Needs Reupload" ? (
              <div className="employee-dashboard__warning-panel">
                This file was flagged for reupload. Upload a replacement below to send it back for review.
              </div>
            ) : null}

            {canEditDocument(activeDocument) ? (
              <div className="employee-dashboard__editor-panel">
                <div>
                  <p className="employee-dashboard__text-strong-dark">
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
                  <p className="employee-dashboard__copy-xs">
                    {activeDocument.document_type === "Signature"
                      ? "Draw your signature below or upload a PNG, JPG, or WEBP file."
                      : "Accepted files: PNG, JPG, WEBP, or PDF."}
                  </p>
                </div>

                {activeDocument.document_type === "Signature" ? (
                  <div className="employee-dashboard__signature-panel">
                    <div className="employee-dashboard__signature-head">
                      <p className="employee-dashboard__text-strong-md">Draw Signature</p>
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
                    <p className="employee-dashboard__copy-xs">
                      Sign using your mouse, touchpad, or phone screen. You can still upload an image file below if you prefer.
                    </p>
                  </div>
                ) : null}

                <label className="employee-dashboard__upload-card employee-dashboard__upload-card--compact">
                  <div className="employee-dashboard__upload-icons">
                    <Camera size={18} />
                    <ImageUp size={18} />
                  </div>
                  <p className="employee-dashboard__copy-sm">
                    {replacementFile ? replacementFile.name : `Choose ${activeDocument.document_type} file`}
                  </p>
                  <input
                    type="file"
                    accept={activeDocument.document_type === "Signature" ? "image/png,image/jpeg,image/webp" : "image/*,.pdf"}
                    className="employee-dashboard__hidden-input"
                    onChange={(e) => setReplacementFile(e.target.files?.[0] ?? null)}
                  />
                </label>

                <Button className="employee-dashboard__btn-full" loading={uploadingRequirement} onClick={() => uploadRequirement(activeDocument)}>
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
        <div className="employee-dashboard__stack-lg">
          <div className="employee-dashboard__actions-end">
            <button
              type="button"
              aria-label="Close more actions"
              className="employee-dashboard__modal-close"
              onClick={() => setMoreOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <div
            className="employee-dashboard__identity-card"
            style={{
              "--employee-card-image": `url(${employeeCardBackground})`,
            }}
          >
            <div className="employee-dashboard__identity-overlay" />
            <div className="employee-dashboard__identity-bubble-left" />
            <div className="employee-dashboard__identity-bubble-right" />
            <div className="employee-dashboard__identity-topline" />

            <div className="employee-dashboard__identity-content employee-dashboard__identity-header">
              <div>
                <p className="employee-dashboard__identity-name">{person.full_name}</p>
                <p className="employee-dashboard__identity-role">
                  {String(person.role || "Employee").toUpperCase()}
                </p>
              </div>

              <div className="employee-dashboard__identity-avatar">
                {person.avatar_preview_url ? (
                  <img src={person.avatar_preview_url} alt={person.full_name} className="employee-dashboard__img-cover" />
                ) : (
                  person.full_name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                )}
              </div>
            </div>

            <div className="employee-dashboard__identity-content employee-dashboard__identity-grid">
              <div>
                <p className="employee-dashboard__identity-label">Employee ID</p>
                <p className="employee-dashboard__identity-value">{person.employee_id || "N/A"}</p>
              </div>
              <div>
                <p className="employee-dashboard__identity-label">TIN Number</p>
                <p className="employee-dashboard__identity-value">{profileRow?.tin || "N/A"}</p>
              </div>
              <div>
                <p className="employee-dashboard__identity-label">SSS Number</p>
                <p className="employee-dashboard__identity-value">{profileRow?.sss || "N/A"}</p>
              </div>
              <div>
                <p className="employee-dashboard__identity-label">PhilHealth</p>
                <p className="employee-dashboard__identity-value">{profileRow?.philhealth || "N/A"}</p>
              </div>
            </div>

            <div className="employee-dashboard__identity-content employee-dashboard__identity-footer">
              <p className="employee-dashboard__identity-footer-copy">Valid Entry</p>
              <div className="employee-dashboard__identity-footer-icon">
                <ShieldCheck size={16} className="text-white/90" />
              </div>
            </div>
          </div>

          <div className="employee-dashboard__status-card">
            <div className="employee-dashboard__section-head">
              <div>
                <p className="employee-dashboard__subsection-title">Profile Edit Request</p>
                <p className="employee-dashboard__copy-sm">
                  Name and profile picture changes must be approved by admin before they go live.
                </p>
              </div>
              {profileRequestLoading ? null : profileChangeRequest ? <StatusBadge status={profileChangeRequest.status} /> : null}
            </div>
            <div className="employee-dashboard__actions-wrap" style={{ marginTop: "0.75rem" }}>
              <Button
                variant="secondary"
                className="employee-dashboard__button-secondary"
                onClick={openEditProfileModal}
              >
                <PencilLine size={16} />
                {profileChangeRequest?.status === "Pending Review" ? "Update Pending Request" : "Edit Profile"}
              </Button>
            </div>
            {profileRequestLoading ? (
              <p className="employee-dashboard__copy-sm">Loading request status...</p>
            ) : profileChangeRequest ? (
              <div className="employee-dashboard__request-summary">
                <p className="employee-dashboard__text-strong-dark">{getStatusCopy(profileChangeRequest.status)}</p>
                <p className="mt-2">Requested name: {profileChangeRequest.requested_full_name || person.full_name}</p>
                <p className="employee-dashboard__copy-xs-spaced">
                  Birthday: {profileChangeRequest.requested_birthday || profileRow?.birthday || "Not set"} | Gender:{" "}
                  {profileChangeRequest.requested_gender || profileRow?.gender || "Not set"}
                </p>
                <p className="employee-dashboard__copy-xs-spaced">
                  Submitted {new Date(profileChangeRequest.created_at).toLocaleString()}
                </p>
              </div>
            ) : (
              <div className="employee-dashboard__request-empty">
                No profile edit request submitted yet.
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Button
              variant="secondary"
              className="employee-dashboard__button-full-secondary"
              loading={refreshing}
              onClick={refreshDashboard}
            >
              <RefreshCw size={16} />
              Refresh Dashboard
            </Button>
            <Button
              variant="danger"
              className="employee-dashboard__button-full-danger"
              loading={loggingOut}
              onClick={handleLogout}
            >
              <LogOut size={16} />
              Sign Out
            </Button>
          </div>

          <div className="employee-dashboard__support-card">
            You currently have {summary.flaggedDocs} file{summary.flaggedDocs === 1 ? "" : "s"} that need attention and{" "}
            {summary.pendingDtrs} DTR submission{summary.pendingDtrs === 1 ? "" : "s"} still pending review.
          </div>
        </div>
      </Modal>

      <Modal open={tasksOpen} onClose={() => setTasksOpen(false)} title="My Tasks">
        <div className="employee-dashboard__stack">
          {tasks.length === 0 ? (
            <div className="employee-dashboard__notice-card">
              You have no urgent employee tasks right now.
            </div>
          ) : null}

          {tasks.map((task) => (
            <div key={task.id} className="employee-dashboard__list-card">
              <p className="employee-dashboard__text-strong-dark">{task.title}</p>
              <p className="employee-dashboard__list-card-copy">{task.description}</p>
              <div className="employee-dashboard__btn-top">
                <Button className="employee-dashboard__btn-full" variant={task.variant} onClick={task.action}>
                  {task.actionLabel}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifications">
        <div className="employee-dashboard__stack">
          {notifications.length === 0 ? <p className="employee-dashboard__copy-sm">No notifications yet.</p> : null}

          {notifications.map((notification) => (
            <div key={notification.id} className="employee-dashboard__list-card">
              <p className="employee-dashboard__text-strong-dark">{notification.title}</p>
              <p className="employee-dashboard__list-card-copy">{notification.description}</p>
              <p className="employee-dashboard__copy-xs-muted">{formatDateTime(notification.createdAt)}</p>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={messagesOpen} onClose={() => setMessagesOpen(false)} title="Messages">
        <div className="employee-dashboard__stack">
          {messages.map((message) => (
            <div key={message.id} className="employee-dashboard__list-card">
              <p className="employee-dashboard__text-strong-dark">{message.title}</p>
              <p className="employee-dashboard__list-card-copy">{message.body}</p>
            </div>
          ))}

          <div className="employee-dashboard__helper-panel">
            Need follow-up? Contact your assigned supervisor or the admin team for document, profile, or DTR concerns.
          </div>
        </div>
      </Modal>

      <Modal open={editProfileOpen} onClose={() => setEditProfileOpen(false)} title="Request Profile Update">
        <div className="employee-dashboard__stack-lg">
          <div className="employee-dashboard__profile-flow">
            <div className="employee-dashboard__profile-flow-avatar">
              {activeProfileRequestAvatar ? (
                <img
                  src={activeProfileRequestAvatar}
                  alt={editProfileForm.full_name || person.full_name}
                  className="employee-dashboard__img-cover"
                />
              ) : (
                <UserRound size={24} />
              )}
            </div>
            <div className="employee-dashboard__copy-sm">
              <p className="employee-dashboard__text-strong-md">Current profile approval flow</p>
              <p>Submit your new name and profile picture here. Admin must approve before your live profile updates.</p>
            </div>
          </div>

          <Input
            label="Full Name"
            value={editProfileForm.full_name}
            onChange={(e) => setEditProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
          />

          <div className="employee-dashboard__grid-two">
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

          <label className="employee-dashboard__textarea-label">
            <span className="employee-dashboard__textarea-label-text">Profile Picture</span>
            <label className="employee-dashboard__upload-card">
              <div className="employee-dashboard__upload-icons">
                <Camera size={18} />
                <ImageUp size={18} />
              </div>
              <p className="employee-dashboard__copy-sm">
                {editProfileImageFile ? editProfileImageFile.name : "Choose a new profile picture"}
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="employee-dashboard__hidden-input"
                onChange={(e) => setEditProfileImageFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="employee-dashboard__copy-xs-spaced">Accepted files: PNG, JPG, or WEBP.</p>
          </label>

          <div className="employee-dashboard__helper-panel">
            {profileChangeRequest?.status === "Pending Review"
              ? "A pending request already exists. Submitting again will update the pending request."
              : "Your current profile will stay the same until an admin approves this request."}
          </div>

          <Button className="employee-dashboard__btn-full" loading={submittingProfileRequest} onClick={submitProfileChangeRequest}>
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
      className="employee-dashboard__nav-button"
      onClick={onClick}
    >
      <Icon size={17} />
      {label}
    </button>
  );
}
