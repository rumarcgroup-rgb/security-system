import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { clearStoredEmployeePortalType } from "../../lib/employeePortal";
import {
  CIVIL_STATUS_OPTIONS,
  GENDER_OPTIONS,
  IMAGE_TYPES,
  REQUIRED_DOCUMENTS,
  getDashboardVariant,
} from "./employeeDashboardConfig";
import {
  buildStoragePath,
  formatDateTime,
  validateAvatarFile,
  validateRequirementFile,
} from "./employeeDashboardUtils";
import { useEmployeePresence } from "./hooks/useEmployeePresence";
import { useEmployeeCutoffPicker } from "./hooks/useEmployeeCutoffPicker";
import { useEmployeeSignaturePad } from "./hooks/useEmployeeSignaturePad";
import { useMessageThreadInbox } from "../messaging/useMessageThreadInbox";
import { useLiveDtrStore } from "../realtime/useLiveDtrStore";
import { useLiveRequirementsStore } from "../realtime/useLiveRequirementsStore";
import { useLivePeopleStore } from "../realtime/useLivePeopleStore";

export function useEmployeeDashboard({ user, profile, refreshProfile }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [employeeNote, setEmployeeNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeDtrReview, setActiveDtrReview] = useState(null);
  const [dtrReviewLoadingId, setDtrReviewLoadingId] = useState(null);
  const [dtrReuploadFile, setDtrReuploadFile] = useState(null);
  const [dtrReuploadNote, setDtrReuploadNote] = useState("");
  const [reuploadingDtr, setReuploadingDtr] = useState(false);
  const [activeDocument, setActiveDocument] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState([]);
  const [readMessageIds, setReadMessageIds] = useState([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [replacementFile, setReplacementFile] = useState(null);
  const [uploadingRequirement, setUploadingRequirement] = useState(false);
  const [submittingProfileRequest, setSubmittingProfileRequest] = useState(false);
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

  useEmployeePresence(user.id);
  const dtrStore = useLiveDtrStore({
    currentRole: "employee",
    currentUserId: user.id,
    scopeProfile: profile,
  });
  const requirementsStore = useLiveRequirementsStore({
    currentRole: "employee",
    currentUserId: user.id,
    scopeProfile: profile,
  });
  const peopleStore = useLivePeopleStore({
    currentRole: "employee",
    currentUserId: user.id,
    scopeProfile: profile,
  });
  const profileRow = useMemo(
    () => peopleStore.profiles.find((item) => item.id === user.id) || profile || null,
    [peopleStore.profiles, profile, user.id]
  );
  const profileChangeRequest = useMemo(() => peopleStore.profileRequests[0] || null, [peopleStore.profileRequests]);
  const submissions = dtrStore.rows;
  const documentsLoading = requirementsStore.loading;
  const profileRequestLoading = peopleStore.loading;

  useEffect(() => {
    if (!editProfileImageFile) {
      setEditProfileImagePreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(editProfileImageFile);
    setEditProfileImagePreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [editProfileImageFile]);

  const {
    activeCutoffIndex,
    cutoff,
    cutoffOptionRefs,
    cutoffPickerOpen,
    cutoffPickerRef,
    cutoffSearch,
    cutoffSearchInputRef,
    filteredCutoffOptions,
    handleCutoffSearchKeyDown,
    setActiveCutoffIndex,
    setCutoff,
    setCutoffPickerOpen,
    setCutoffSearch,
  } = useEmployeeCutoffPicker();

  const {
    clearSignaturePad,
    drawSignatureStroke,
    endSignatureStroke,
    hasSignatureDrawing,
    signatureCanvasRef,
    startSignatureStroke,
  } = useEmployeeSignaturePad(activeDocument);

  const chatInbox = useMessageThreadInbox({
    currentRole: "employee",
    currentUserId: user.id,
    preferredSupervisorUserId: profileRow?.supervisor_user_id || null,
  });
  const documents = useMemo(() => {
    const uploadedDocuments = requirementsStore.rows.map((document) => ({
      ...document,
      review_status: document.status || "Pending Review",
      is_missing: false,
    }));
    const byType = new Map(uploadedDocuments.map((document) => [document.document_type, document]));
    const mergedDocs = REQUIRED_DOCUMENTS.map(
      (type) =>
        byType.get(type) || {
          id: `missing-${user.id}-${type}`,
          document_type: type,
          requirement_type: type,
          file_url: "",
          created_at: null,
          review_status: "Missing",
          preview_url: null,
          source_table: "virtual",
          is_missing: true,
        }
    );
    const extraDocs = uploadedDocuments.filter((document) => !REQUIRED_DOCUMENTS.includes(document.document_type));
    return [...mergedDocs, ...extraDocs];
  }, [requirementsStore.rows, user.id]);

  useEffect(() => {
    setActiveDocument((current) => {
      if (!current) return null;
      return documents.find((item) => item.id === current.id) || null;
    });
  }, [documents]);

  useEffect(() => {
    setActiveDtrReview((current) => {
      if (!current?.id) return current;
      const nextSubmission = submissions.find((item) => item.id === current.id);
      return nextSubmission || current;
    });
  }, [submissions]);

  async function openDtrReview(submission) {
    if (!submission?.id) return;

    setDtrReviewLoadingId(submission.id);
    setDtrReuploadFile(null);

    try {
      const refreshedSubmission = await dtrStore.syncRowById(submission.id);
      const nextSubmission = refreshedSubmission || submission;
      setActiveDtrReview(nextSubmission);
      setDtrReuploadNote(nextSubmission.employee_note || "");
    } catch (err) {
      toast.error(err.message || "Unable to load DTR review.");
      setActiveDtrReview(submission);
      setDtrReuploadNote(submission.employee_note || "");
    } finally {
      setDtrReviewLoadingId(null);
    }
  }

  function closeDtrReview() {
    setActiveDtrReview(null);
    setDtrReuploadFile(null);
    setDtrReuploadNote("");
  }

  async function reuploadDtrSubmission() {
    if (!activeDtrReview?.id) return;

    if (!dtrReuploadFile) {
      toast.error("Please choose a replacement DTR image.");
      return;
    }

    if (dtrReuploadFile.type && !IMAGE_TYPES.includes(dtrReuploadFile.type)) {
      toast.error("DTR replacement must be PNG, JPG, or WEBP.");
      return;
    }

    setReuploadingDtr(true);
    let path = "";

    try {
      const ext = dtrReuploadFile.name.split(".").pop()?.toLowerCase() || "jpg";
      path = `${user.id}/dtr-reupload-${Date.now()}.${ext}`;
      const upload = await supabase.storage.from("dtr-images").upload(path, dtrReuploadFile, {
        cacheControl: "3600",
        contentType: dtrReuploadFile.type || undefined,
        upsert: false,
      });
      if (upload.error) throw upload.error;

      const { error: rpcError } = await supabase.rpc("employee_reupload_dtr_submission", {
        target_submission_id: activeDtrReview.id,
        next_file_url: path,
        next_employee_note: dtrReuploadNote.trim() || null,
      });

      if (rpcError) {
        await supabase.storage.from("dtr-images").remove([path]);
        throw rpcError;
      }

      const refreshedSubmission = await dtrStore.syncRowById(activeDtrReview.id);
      setActiveDtrReview(refreshedSubmission || {
        ...activeDtrReview,
        file_url: path,
        preview_url: "",
        employee_note: dtrReuploadNote.trim() || null,
        admin_remarks: null,
        status: "Pending Review",
        approved_at: null,
      });
      setDtrReuploadFile(null);
      toast.success("DTR replacement submitted for review.");
    } catch (err) {
      toast.error(err.message || "Unable to reupload DTR.");
    } finally {
      setReuploadingDtr(false);
    }
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

      const { data: insertedSubmission, error: insertError } = await supabase
        .from("dtr_submissions")
        .insert({
          user_id: user.id,
          cutoff,
          employee_note: employeeNote.trim() || null,
          file_url: path,
          status: "Pending Review",
          submitted_by_role: "employee",
          submitted_by_user_id: user.id,
          approved_at: null,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      setFile(null);
      setEmployeeNote("");
      await dtrStore.syncRowById(insertedSubmission.id);
      toast.success("DTR submitted successfully.");
    } catch (err) {
      toast.error(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshDashboard() {
    setRefreshing(true);
    try {
      const refreshTasks = [
        dtrStore.syncNow({ showLoading: false }),
        requirementsStore.syncNow({ showLoading: false }),
        peopleStore.syncNow({ showLoading: false }),
      ];

      if (refreshProfile) {
        refreshTasks.push(refreshProfile());
      }

      await Promise.all(refreshTasks);
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

        await Promise.all([
          peopleStore.syncProfileById(user.id),
          requirementsStore.syncSignatureByUserId(user.id),
        ]);
      } else {
        const { data: insertedDocument, error: insertError } = await supabase
          .from("employee_documents")
          .insert({
            user_id: user.id,
            document_type: document.document_type,
            file_url: path,
            review_status: "Pending Review",
          })
          .select("id")
          .single();
        if (insertError) throw insertError;

        await requirementsStore.syncDocumentById(insertedDocument.id);
      }

      setReplacementFile(null);
      clearSignaturePad();
      toast.success(`${document.document_type} uploaded successfully.`);
    } catch (err) {
      toast.error(err.message || "Upload failed.");
    } finally {
      setUploadingRequirement(false);
    }
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
      let requestId = profileChangeRequest?.id || null;

      if (hasPendingRequest) {
        const { data: updatedRequest, error } = await supabase
          .from("profile_change_requests")
          .update(payload)
          .eq("id", profileChangeRequest.id)
          .select("id")
          .single();
        if (error) throw error;
        requestId = updatedRequest.id;
      } else {
        const { data: insertedRequest, error } = await supabase
          .from("profile_change_requests")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        requestId = insertedRequest.id;
      }

      await peopleStore.syncProfileRequestById(requestId);
      toast.success(hasPendingRequest ? "Pending profile request updated." : "Profile edit request sent to admin.");
      setEditProfileOpen(false);
      setEditProfileImageFile(null);
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

    clearStoredEmployeePortalType();
    setMoreOpen(false);
    navigate("/login", { replace: true });
  }

  const person = useMemo(() => ({
    full_name: profileRow?.full_name ?? "John Dela Cruz",
    role: profileRow?.position ?? profileRow?.role ?? "Janitor",
    employee_id: profileRow?.employee_id ?? "EMP-00124",
    location: profileRow?.location ?? "ABC Building",
    branch: profileRow?.branch ?? "",
    avatar_url: profileRow?.avatar_url ?? "",
    avatar_preview_url: profileRow?.preview_url ?? "",
  }), [profileRow]);

  const dashboardVariant = useMemo(() => getDashboardVariant(profileRow), [profileRow]);

  const assignment = useMemo(() => ({
    position: profileRow?.position || profileRow?.role || dashboardVariant.roleLabel,
    shift: profileRow?.shift || "Not set",
    location: profileRow?.location || "Not set",
    branch: profileRow?.branch || "Not set",
    supervisor: profileRow?.supervisor || "Not assigned",
  }), [dashboardVariant.roleLabel, profileRow]);

  const activeProfileRequestAvatar =
    editProfileImagePreview ||
    (profileChangeRequest?.status === "Pending Review" ? profileChangeRequest.preview_url : "") ||
    person.avatar_preview_url;

  const summary = useMemo(() => {
    const pendingDtrs = submissions.filter((item) => item.status === "Pending Review").length;
    const approvedDtrs = submissions.filter((item) => item.status === "Approved").length;
    const rejectedDtrs = submissions.filter((item) => item.status === "Rejected").length;
    const verifiedDocs = documents.filter((item) => item.review_status === "Verified").length;
    const flaggedDocs = documents.filter(
      (item) => item.review_status === "Needs Reupload" || item.review_status === "Missing"
    ).length;
    const needsActionTotal = rejectedDtrs + flaggedDocs;

    return { pendingDtrs, approvedDtrs, rejectedDtrs, verifiedDocs, flaggedDocs, needsActionTotal };
  }, [documents, submissions]);

  const complianceSummary = useMemo(() => {
    const requiredDocuments = documents.filter((item) => REQUIRED_DOCUMENTS.includes(item.document_type));
    const completedCount = requiredDocuments.filter((item) => {
      if (item.document_type === "Signature") {
        return item.review_status === "Verified" || item.review_status === "Approved";
      }
      return item.review_status === "Verified";
    }).length;
    const missingCount = requiredDocuments.filter((item) => item.review_status === "Missing").length;
    const needsReuploadCount = requiredDocuments.filter((item) => item.review_status === "Needs Reupload").length;
    const pendingCount = requiredDocuments.filter((item) => item.review_status === "Pending Review").length;
    const totalRequired = REQUIRED_DOCUMENTS.length;
    const completionPercent = totalRequired ? Math.round((completedCount / totalRequired) * 100) : 0;

    return {
      completedCount,
      completionPercent,
      missingCount,
      needsReuploadCount,
      pendingCount,
      totalRequired,
    };
  }, [documents]);

  const profileCompletenessSummary = useMemo(() => {
    const hasAnySupervisor = Boolean(profileRow?.supervisor_user_id || profileRow?.supervisor);
    const signatureDocument = documents.find((item) => item.document_type === "Signature");
    const checks = [
      {
        id: "personal",
        label: "Personal info",
        done: Boolean(profileRow?.full_name && profileRow?.birthday && profileRow?.gender && profileRow?.civil_status),
      },
      {
        id: "government",
        label: "Government IDs",
        done: Boolean(profileRow?.sss && profileRow?.philhealth && profileRow?.pagibig && profileRow?.tin),
      },
      {
        id: "employment",
        label: "Employment details",
        done: Boolean(profileRow?.employee_id && profileRow?.location && profileRow?.position && profileRow?.shift && hasAnySupervisor),
      },
      {
        id: "documents",
        label: "Required documents",
        done: complianceSummary.completedCount === complianceSummary.totalRequired && complianceSummary.totalRequired > 0,
      },
      {
        id: "signature",
        label: "Verified signature",
        done: signatureDocument?.review_status === "Verified" || signatureDocument?.review_status === "Approved",
      },
    ];
    const completeCount = checks.filter((item) => item.done).length;
    const percent = checks.length ? Math.round((completeCount / checks.length) * 100) : 0;

    return {
      checks,
      completeCount,
      percent,
      totalCount: checks.length,
    };
  }, [complianceSummary.completedCount, complianceSummary.totalRequired, documents, profileRow]);

  const adminFeedback = useMemo(() => {
    return submissions
      .filter((item) => item.admin_remarks || item.status === "Approved" || item.status === "Rejected")
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        cutoff: item.cutoff,
        status: item.status,
        createdAt: item.approved_at || item.created_at,
        remarks:
          item.admin_remarks ||
          (item.status === "Approved"
            ? "Your DTR was approved without additional remarks."
            : "This submission status changed. Open your recent submissions for more context."),
      }));
  }, [submissions]);

  const actions = useMemo(() => {
    const items = [];

    if (profileChangeRequest?.status === "Rejected") {
      items.push({
        id: "action-profile-rejected",
        kind: "profile",
        title: "Update your profile request",
        description: "Your last profile update request was rejected. Review it and submit a corrected version.",
        status: "Rejected",
        variant: "secondary",
        actionLabel: "Edit profile",
        action: openEditProfileModal,
      });
    }

    if (summary.pendingDtrs > 0) {
      items.push({
        id: "action-pending-dtr",
        kind: "dtr",
        title: "Wait for DTR approval",
        description: `${summary.pendingDtrs} DTR submission${summary.pendingDtrs === 1 ? "" : "s"} still waiting in the admin review queue.`,
        status: "Pending Review",
        variant: "secondary",
        actionLabel: "Review submissions",
        action: null,
      });
    }

    return items;
  }, [profileChangeRequest?.status, summary.pendingDtrs]);

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

  const statusMessages = useMemo(() => {
    const items = [];
    const priorityRank = { high: 0, medium: 1, low: 2 };

    submissions.slice(0, 4).forEach((submission) => {
      let title = `DTR submitted for ${submission.cutoff}`;
      let body = `Submitted on ${formatDateTime(submission.created_at)} and waiting for review.`;
      let priority = "medium";

      if (submission.status === "Rejected") {
        title = `${submission.cutoff} DTR needs attention`;
        body = submission.admin_remarks
          ? `Admin remarks: ${submission.admin_remarks}`
          : "Your submission was rejected. Review the latest notes and prepare any required corrections.";
        priority = "high";
      } else if (submission.status === "Approved") {
        title = `${submission.cutoff} DTR approved`;
        body = submission.admin_remarks
          ? `Approved with notes: ${submission.admin_remarks}`
          : `Approved on ${formatDateTime(submission.approved_at || submission.created_at)}.`;
        priority = submission.admin_remarks ? "medium" : "low";
      } else if (submission.admin_remarks) {
        title = `${submission.cutoff} DTR has admin notes`;
        body = `Admin remarks: ${submission.admin_remarks}`;
        priority = "high";
      }

      items.push({
        id: `message-dtr-${submission.id}`,
        category: "dtr",
        priority,
        title,
        body,
        createdAt: submission.approved_at || submission.created_at,
        actionLabel: "View Submission",
        actionTarget: "submissions",
      });
    });

    const documentMessages = [
      ...documents.filter((document) => document.review_status === "Missing"),
      ...documents.filter((document) => document.review_status === "Needs Reupload"),
      ...documents.filter((document) => document.review_status === "Pending Review"),
      ...documents
        .filter((document) => document.review_status === "Verified" && document.created_at)
        .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))
        .slice(0, 2),
    ];

    const seenDocumentMessageIds = new Set();
    documentMessages.forEach((document) => {
      const messageId = `message-document-${document.id}`;
      if (seenDocumentMessageIds.has(messageId)) return;
      seenDocumentMessageIds.add(messageId);

      let title = `${document.document_type} update available`;
      let body = "Open your documents page to review the latest requirement status.";
      let priority = "medium";

      if (document.review_status === "Missing") {
        title = `${document.document_type} is still missing`;
        body = "Upload this requirement so admin can continue your document review.";
        priority = "high";
      } else if (document.review_status === "Needs Reupload") {
        title = `${document.document_type} needs reupload`;
        body = "Admin requested a clearer or updated file for this requirement.";
        priority = "high";
      } else if (document.review_status === "Pending Review") {
        title = `${document.document_type} is pending review`;
        body = document.created_at
          ? `Uploaded on ${formatDateTime(document.created_at)} and waiting for admin review.`
          : "This requirement is waiting for admin review.";
        priority = "medium";
      } else if (document.review_status === "Verified") {
        title = `${document.document_type} verified`;
        body = "This requirement has been cleared by admin.";
        priority = "low";
      }

      items.push({
        id: messageId,
        category: "documents",
        priority,
        title,
        body,
        createdAt: document.created_at,
        actionLabel: "Open Documents",
        actionTarget: "documents",
      });
    });

    if (profileChangeRequest) {
      let title = "Profile request update";
      let body = "Review the latest admin status for your profile update request.";
      let priority = "medium";
      let actionLabel = "View Request";
      let actionTarget = "profile-request";

      if (profileChangeRequest.status === "Rejected") {
        title = "Profile request needs changes";
        body = "Your last profile update request was rejected. Review the request details and submit corrections.";
        priority = "high";
        actionLabel = "Edit Profile";
        actionTarget = "profile-edit";
      } else if (profileChangeRequest.status === "Approved") {
        title = "Profile request approved";
        body = "Your latest profile update request has been approved by admin.";
        priority = "low";
      } else if (profileChangeRequest.status === "Pending Review") {
        title = "Profile request in progress";
        body = "Your requested profile details are still waiting for admin approval.";
        priority = "medium";
      }

      items.push({
        id: `message-profile-${profileChangeRequest.id}`,
        category: "profile",
        priority,
        title,
        body,
        createdAt: profileChangeRequest.reviewed_at || profileChangeRequest.created_at,
        actionLabel,
        actionTarget,
      });
    }

    if (items.length === 0) {
      items.push({
        id: "message-admin-clear",
        category: "admin",
        priority: "low",
        title: dashboardVariant.clearMessageTitle,
        body: dashboardVariant.clearMessageBody,
        createdAt: null,
        actionLabel: null,
        actionTarget: null,
      });
    }

    return items
      .sort((left, right) => {
        const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority];
        if (priorityDifference !== 0) return priorityDifference;
        return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
      })
      .slice(0, 10)
      .map((message) => ({
        ...message,
        isUnread: !readMessageIds.includes(message.id),
      }));
  }, [
    dashboardVariant.clearMessageBody,
    dashboardVariant.clearMessageTitle,
    documents,
    profileChangeRequest,
    readMessageIds,
    submissions,
  ]);

  const unreadStatusMessagesCount = useMemo(() => {
    return statusMessages.filter((message) => message.isUnread).length;
  }, [statusMessages]);

  function markStatusMessageRead(messageId) {
    setReadMessageIds((current) => (current.includes(messageId) ? current : [...current, messageId]));
  }

  function markAllStatusMessagesRead() {
    setReadMessageIds((current) => Array.from(new Set([...current, ...statusMessages.map((message) => message.id)])));
  }

  const unreadMessagesCount = useMemo(() => {
    return unreadStatusMessagesCount + chatInbox.unreadCount;
  }, [chatInbox.unreadCount, unreadStatusMessagesCount]);

  function openNotifications() {
    setNotificationsOpen(true);
    setSeenNotificationIds((current) => Array.from(new Set([...current, ...notifications.map((item) => item.id)])));
  }

  function closeActiveDocument() {
    setActiveDocument(null);
    setReplacementFile(null);
    clearSignaturePad();
  }

  return {
    CIVIL_STATUS_OPTIONS,
    GENDER_OPTIONS,
    activeCutoffIndex,
    activeDocument,
    activeDtrReview,
    activeProfileRequestAvatar,
    clearSignaturePad,
    closeActiveDocument,
    cutoff,
    cutoffOptionRefs,
    cutoffPickerOpen,
    cutoffPickerRef,
    cutoffSearch,
    cutoffSearchInputRef,
    dashboardVariant,
    documents,
    documentsLoading,
    assignment,
    adminFeedback,
    complianceSummary,
    profileCompletenessSummary,
    drawSignatureStroke,
    editProfileForm,
    editProfileImageFile,
    editProfileOpen,
    dtrReviewLoadingId,
    dtrReuploadFile,
    dtrReuploadNote,
    employeeNote,
    endSignatureStroke,
    file,
    filteredCutoffOptions,
    handleCutoffSearchKeyDown,
    handleLogout,
    hasSignatureDrawing,
    loggingOut,
    markNotificationsSeenAndOpen: openNotifications,
    chatInbox,
    markAllStatusMessagesRead,
    markStatusMessageRead,
    statusMessages,
    moreOpen,
    notifications,
    notificationsOpen,
    closeDtrReview,
    openEditProfileModal,
    openDtrReview,
    person,
    profileChangeRequest,
    profileRequestLoading,
    profileRow,
    refreshing,
    refreshDashboard,
    replacementFile,
    reuploadingDtr,
    setActiveCutoffIndex,
    setActiveDocument,
    setCutoff,
    setCutoffPickerOpen,
    setCutoffSearch,
    setEditProfileForm,
    setEditProfileImageFile,
    setEditProfileOpen,
    setEmployeeNote,
    setFile,
    setDtrReuploadFile,
    setDtrReuploadNote,
    setMoreOpen,
    setNotificationsOpen,
    setReplacementFile,
    signatureCanvasRef,
    startSignatureStroke,
    submitDtr,
    submitting,
    reuploadDtrSubmission,
    submittingProfileRequest,
    submitProfileChangeRequest,
    submissions,
    summary,
    actions,
    unreadMessagesCount,
    unreadStatusMessagesCount,
    unreadNotificationCount,
    uploadingRequirement,
    uploadRequirement,
  };
}
