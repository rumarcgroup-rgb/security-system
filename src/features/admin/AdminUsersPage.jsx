import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileImage, FileText, Search, ShieldCheck, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import StatusBadge from "../../components/ui/StatusBadge";
import { AREA_OPTIONS, sortAreas } from "../../lib/areas";
import { getBranchesForArea } from "../../lib/branches";
import { supabase } from "../../lib/supabase";
import { attachSignedUrls } from "../../lib/storage";
import { formatLastSeen, isEmployeeOnline } from "../../lib/presence";
import "./AdminUsersPage.css";

const REQUIRED_DOCUMENTS = ["Valid ID", "NBI Clearance", "Medical Certificate", "Barangay Clearance", "Signature"];
const REVIEWABLE_STATUSES = ["Pending Review", "Verified", "Needs Reupload"];
const POSITION_OPTIONS = ["CGroup Access", "Security Guard", "Janitor", "Maintenance Staff"];

function isPdfFile(path = "") {
  return /\.pdf($|\?)/i.test(path);
}

function getDocumentIcon(path = "") {
  return isPdfFile(path) ? FileText : FileImage;
}

function PresenceBadge({ lastSeenAt }) {
  const online = isEmployeeOnline(lastSeenAt);

  return (
    <div className="admin-users-page__presence">
      <span
        className={`app-pill ${
          online ? "app-pill--success" : "app-pill--muted"
        }`}
      >
        <span
          className={`app-pill-dot ${
            online ? "app-pill-dot--success" : "app-pill-dot--muted"
          }`}
        />
        {online ? "Online" : "Offline"}
      </span>
      <p className="admin-copy-xs">Last seen: {formatLastSeen(lastSeenAt)}</p>
    </div>
  );
}

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState([]);
  const [profileRequests, setProfileRequests] = useState([]);
  const [filters, setFilters] = useState({ role: "All", location: "All", q: "" });
  const [savingId, setSavingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewProfile, setReviewProfile] = useState(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [activeDocument, setActiveDocument] = useState(null);
  const [savingDocumentId, setSavingDocumentId] = useState(null);
  const [reviewRequest, setReviewRequest] = useState(null);
  const [savingRequestId, setSavingRequestId] = useState(null);
  const [assignmentProfile, setAssignmentProfile] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({ location: "", branch: "", position: "" });
  const [savingAssignment, setSavingAssignment] = useState(false);
  const assignmentBranchOptions = useMemo(() => getBranchesForArea(assignmentForm.location), [assignmentForm.location]);

  useEffect(() => {
    loadPageData();
    const channel = supabase
      .channel("admin-users-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadPageData)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_documents" }, loadPageData)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_change_requests" }, loadPageData)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_presence" }, loadPageData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadPageData() {
    setLoading(true);
    await Promise.all([loadProfiles(), loadProfileChangeRequests()]);
    setLoading(false);
  }

  async function loadProfiles() {
    const [profilesRes, presenceRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("employee_presence").select("user_id,last_seen_at"),
    ]);

    if (profilesRes.error) {
      toast.error(profilesRes.error.message);
      return;
    }

    if (presenceRes.error) {
      toast.error(presenceRes.error.message);
      return;
    }

    const presenceMap = new Map((presenceRes.data ?? []).map((row) => [row.user_id, row.last_seen_at]));
    const withSignedAvatars = await attachSignedUrls(profilesRes.data ?? [], "documents", "avatar_url");
    setProfiles(
      withSignedAvatars.map((profile) => ({
        ...profile,
        last_seen_at: presenceMap.get(profile.id) ?? null,
      }))
    );
  }

  async function loadProfileChangeRequests() {
    const { data, error } = await supabase
      .from("profile_change_requests")
      .select(
        "id,user_id,requested_full_name,requested_avatar_url,requested_birthday,requested_age,requested_gender,requested_civil_status,requested_sss,requested_philhealth,requested_pagibig,requested_tin,status,created_at,profiles:profiles!profile_change_requests_user_id_profile_fkey(full_name,employee_id,location,avatar_url,birthday,age,gender,civil_status,sss,philhealth,pagibig,tin)"
      )
      .eq("status", "Pending Review")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    const withSignedRequestedAvatars = await attachSignedUrls(data ?? [], "documents", "requested_avatar_url");
    setProfileRequests(withSignedRequestedAvatars);
  }

  async function updateRole(profileId, role) {
    setSavingId(profileId);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
    setSavingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    setProfiles((current) => current.map((profile) => (profile.id === profileId ? { ...profile, role } : profile)));
    toast.success(`Role updated to ${role}.`);
  }

  async function openDocumentReview(profile) {
    setReviewProfile(profile);
    setDocumentsLoading(true);
    setDocuments([]);
    setActiveDocument(null);

    const { data, error } = await supabase
      .from("employee_documents")
      .select("id,document_type,file_url,review_status,created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      setDocumentsLoading(false);
      toast.error(error.message);
      return;
    }

    let docs = await attachSignedUrls(data ?? [], "documents");
    docs = docs.map((document) => ({
      ...document,
      review_status: document.review_status || "Pending Review",
      source_table: "employee_documents",
      is_missing: false,
    }));

    if (profile.signature_url) {
      const signatureRows = await attachSignedUrls(
        [
          {
            id: `signature-${profile.id}`,
            document_type: "Signature",
            file_url: profile.signature_url,
            created_at: profile.created_at,
          },
        ],
        "documents"
      );
      docs = [
        ...signatureRows.map((document) => ({
          ...document,
          review_status: profile.signature_status || "Pending Review",
          source_table: "profiles",
          is_missing: false,
        })),
        ...docs,
      ];
    }

    const byType = new Map(docs.map((document) => [document.document_type, document]));
    const mergedDocs = REQUIRED_DOCUMENTS.map((type) =>
      byType.get(type) || {
        id: `missing-${profile.id}-${type}`,
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
    setActiveDocument(nextDocuments[0] ?? null);
    setDocumentsLoading(false);
  }

  function closeDocumentReview() {
    setReviewProfile(null);
    setDocuments([]);
    setActiveDocument(null);
    setDocumentsLoading(false);
    setSavingDocumentId(null);
  }

  function closeProfileRequestReview() {
    setReviewRequest(null);
    setSavingRequestId(null);
  }

  function openAssignmentEditor(profile) {
    setAssignmentProfile(profile);
    setAssignmentForm({
      location: profile.location || "",
      branch: profile.branch || "",
      position: profile.position || "",
    });
  }

  function closeAssignmentEditor() {
    setAssignmentProfile(null);
    setAssignmentForm({ location: "", branch: "", position: "" });
    setSavingAssignment(false);
  }

  useEffect(() => {
    setAssignmentForm((current) => {
      if (!assignmentProfile) return current;
      if (assignmentBranchOptions.includes(current.branch)) return current;
      return {
        ...current,
        branch: assignmentBranchOptions[0] || "",
      };
    });
  }, [assignmentBranchOptions, assignmentProfile]);

  async function saveAssignment() {
    if (!assignmentProfile?.id) return;

    const payload = {
      location: assignmentForm.location.trim() || null,
      branch: assignmentForm.branch.trim() || null,
      position: assignmentForm.position.trim() || null,
    };

    setSavingAssignment(true);
    const { error } = await supabase.from("profiles").update(payload).eq("id", assignmentProfile.id);
    setSavingAssignment(false);

    if (error) {
      toast.error(error.message || "Unable to update assignment.");
      return;
    }

    setProfiles((current) =>
      current.map((profile) => (profile.id === assignmentProfile.id ? { ...profile, ...payload } : profile))
    );
    toast.success("Employee assignment updated.");
    closeAssignmentEditor();
  }

  async function updateDocumentStatus(document, nextStatus) {
    if (!document || document.is_missing) return;

    setSavingDocumentId(document.id);

    const query =
      document.source_table === "profiles"
        ? supabase.from("profiles").update({ signature_status: nextStatus }).eq("id", reviewProfile.id)
        : supabase.from("employee_documents").update({ review_status: nextStatus }).eq("id", document.id);

    const { error } = await query;
    setSavingDocumentId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    setDocuments((current) =>
      current.map((item) => (item.id === document.id ? { ...item, review_status: nextStatus } : item))
    );
    setActiveDocument((current) => (current?.id === document.id ? { ...current, review_status: nextStatus } : current));
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === reviewProfile.id && document.source_table === "profiles"
          ? { ...profile, signature_status: nextStatus }
          : profile
      )
    );
    toast.success(`Document marked as ${nextStatus}.`);
  }

  async function updateProfileRequestStatus(request, nextStatus) {
    if (!request) return;

    setSavingRequestId(request.id);

    try {
      if (nextStatus === "Approved") {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: request.requested_full_name || request.profiles?.full_name || null,
            avatar_url: request.requested_avatar_url || request.profiles?.avatar_url || null,
            birthday: request.requested_birthday || null,
            age: request.requested_age ?? null,
            gender: request.requested_gender || null,
            civil_status: request.requested_civil_status || null,
            sss: request.requested_sss || null,
            philhealth: request.requested_philhealth || null,
            pagibig: request.requested_pagibig || null,
            tin: request.requested_tin || null,
          })
          .eq("id", request.user_id);
        if (profileError) throw profileError;
      }

      const { error: requestError } = await supabase
        .from("profile_change_requests")
        .update({ status: nextStatus, reviewed_at: new Date().toISOString() })
        .eq("id", request.id);
      if (requestError) throw requestError;

      toast.success(`Profile request ${nextStatus.toLowerCase()}.`);
      closeProfileRequestReview();
      await loadPageData();
    } catch (error) {
      toast.error(error.message || "Unable to update profile request.");
      setSavingRequestId(null);
    }
  }

  const locations = useMemo(() => {
    const uniqueLocations = Array.from(new Set(profiles.map((profile) => profile.location).filter(Boolean)));
    return ["All", ...sortAreas(uniqueLocations)];
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const query = filters.q.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesRole = filters.role === "All" || profile.role === filters.role;
      const matchesLocation = filters.location === "All" || (profile.location || "Unassigned") === filters.location;
      const haystack = [profile.full_name, profile.employee_id, profile.position, profile.location, profile.branch]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query);

      return matchesRole && matchesLocation && matchesQuery;
    });
  }, [filters, profiles]);

  if (loading) {
    return <p className="admin-loading-copy">Loading employee records...</p>;
  }

  return (
    <div className="admin-page admin-users-page">
      <Card>
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title">Pending Profile Changes</h2>
            <p className="admin-section-copy">{profileRequests.length} request(s) waiting for approval</p>
          </div>
        </div>

        <div className="admin-stack-sm">
          {profileRequests.map((request) => (
            <div key={request.id} className="admin-list-card admin-list-card--responsive admin-users-page__request-card">
              <div className="admin-media-row">
                <div className="app-avatar app-avatar--circle app-avatar--md admin-users-page__avatar">
                  {request.preview_url ? (
                    <img src={request.preview_url} alt={request.requested_full_name || "Requested avatar"} className="app-media-cover" />
                  ) : (
                    <UserRound size={18} />
                  )}
                </div>
                <div>
                  <p className="admin-text-strong">{request.profiles?.full_name || "Unknown Employee"}</p>
                  <p className="admin-copy-sm">
                    {request.profiles?.employee_id || "No Employee ID"} | Requested name: {request.requested_full_name || "No change"}
                  </p>
                  <p className="admin-copy-xs-muted">{new Date(request.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="admin-users-page__actions">
                <StatusBadge status={request.status} />
                <Button variant="secondary" onClick={() => setReviewRequest(request)}>
                  Review
                </Button>
              </div>
            </div>
          ))}
          {profileRequests.length === 0 ? <p className="admin-copy-sm">No pending profile update requests.</p> : null}
        </div>
      </Card>

      <Card>
        <div className="admin-filters-grid admin-filters-grid--directory">
          <Select label="Role" value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}>
            <option>All</option>
            <option>employee</option>
            <option>admin</option>
          </Select>
          <Select
            label="Location"
            value={filters.location}
            onChange={(e) => setFilters((prev) => ({ ...prev, location: e.target.value }))}
          >
            {locations.map((location) => (
              <option key={location}>{location}</option>
            ))}
          </Select>
          <label className="admin-search-label admin-search-label--wide">
            <span className="admin-search-label-text">Search</span>
            <div className="admin-search-wrap">
              <Search size={16} className="admin-search-icon" />
              <input
                className="admin-search-input"
                placeholder="Name, employee ID, position, location, branch"
                value={filters.q}
                onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
              />
            </div>
          </label>
        </div>
      </Card>

      <Card>
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title">People Directory</h2>
            <p className="admin-section-copy">{filteredProfiles.length} matching profiles</p>
          </div>
        </div>

        <div className="admin-table-wrap admin-users-page__table-wrap">
          <table className="admin-table admin-users-page__table">
            <thead>
              <tr className="admin-table-head-row admin-table-head-row--caps">
                <th className="admin-table-head-cell admin-table-head-cell--lg">User</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Presence</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Assignment</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Government IDs</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Documents</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Role</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((profile) => (
                <tr key={profile.id} className="admin-table-row admin-table-row--top">
                  <td className="admin-table-cell admin-table-cell--lg">
                    <div className="admin-users-page__user-main">
                      <div className="app-avatar app-avatar--panel app-avatar--sm admin-users-page__avatar">
                        {profile.preview_url ? (
                          <img src={profile.preview_url} alt={profile.full_name || "User"} className="app-media-cover" />
                        ) : profile.role === "admin" ? (
                          <ShieldCheck size={18} />
                        ) : (
                          <UserRound size={18} />
                        )}
                      </div>
                      <div>
                        <p className="admin-text-strong">{profile.full_name || "Unnamed User"}</p>
                        <p className="admin-copy-xs">{profile.employee_id || "No employee ID assigned"}</p>
                        <p className="admin-copy-xs-muted">{profile.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    {profile.role === "employee" ? (
                      <PresenceBadge lastSeenAt={profile.last_seen_at} />
                    ) : (
                      <p className="admin-copy-xs-muted">Admin account</p>
                    )}
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    <p className="admin-text-medium">{profile.position || "No position set"}</p>
                    <p className="admin-copy-xs">
                      {profile.location || "Unassigned location"}{profile.branch ? ` / ${profile.branch}` : ""}
                    </p>
                    <p className="admin-copy-xs-muted">
                      Shift: {profile.shift || "Not set"} | Supervisor: {profile.supervisor || "Not set"}
                    </p>
                    <Button
                      variant="secondary"
                      className="admin-users-page__button-top"
                      onClick={() => openAssignmentEditor(profile)}
                    >
                      Edit Assignment
                    </Button>
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg admin-copy-xs">
                    <p>SSS: {profile.sss || "-"}</p>
                    <p>PhilHealth: {profile.philhealth || "-"}</p>
                    <p>Pag-IBIG: {profile.pagibig || "-"}</p>
                    <p>TIN: {profile.tin || "-"}</p>
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    <Button variant="secondary" className="admin-users-page__button-wide" onClick={() => openDocumentReview(profile)}>
                      Review Files
                    </Button>
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    <div className="admin-users-page__role-controls">
                      <Select
                        value={profile.role}
                        onChange={(e) => updateRole(profile.id, e.target.value)}
                        disabled={savingId === profile.id}
                      >
                        <option value="employee">employee</option>
                        <option value="admin">admin</option>
                      </Select>
                      <Button
                        variant="secondary"
                        className="admin-button-full"
                        loading={savingId === profile.id}
                        onClick={() => updateRole(profile.id, profile.role === "admin" ? "employee" : "admin")}
                      >
                        Toggle Role
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProfiles.length === 0 ? <p className="admin-copy-sm">No profiles match the current filters.</p> : null}
      </Card>

      <Modal
        open={Boolean(reviewProfile)}
        onClose={closeDocumentReview}
        title={reviewProfile ? `${reviewProfile.full_name || "Employee"} Documents` : "Employee Documents"}
      >
        {documentsLoading ? (
          <p className="admin-copy-sm">Loading uploaded files...</p>
        ) : (
          <div className="admin-content-grid admin-content-grid--document-review">
            <div className="admin-users-page__file-list">
              <p className="admin-text-medium">Available Files</p>
              {documents.map((document) => {
                const Icon = getDocumentIcon(document.file_url);
                const selected = activeDocument?.id === document.id;

                return (
                  <button
                    key={document.id}
                    className={`admin-users-page__file-button ${
                      selected ? "admin-users-page__file-button--active" : ""
                    }`}
                    onClick={() => setActiveDocument(document)}
                  >
                    <div className="admin-users-page__file-main">
                      <div className="admin-users-page__file-icon">
                        <Icon size={18} />
                      </div>
                      <div className="admin-users-page__min-w-0">
                        <div className="admin-row admin-row--gap">
                          <p className="admin-users-page__truncate admin-text-strong">{document.document_type}</p>
                          <StatusBadge status={document.review_status} />
                        </div>
                        <p className="admin-users-page__truncate admin-copy-xs">{document.file_url}</p>
                        <p className="admin-copy-xs-muted">
                          {document.created_at ? new Date(document.created_at).toLocaleString() : "No timestamp"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
              {documents.length === 0 ? <p className="admin-copy-sm">No uploaded files were found for this employee.</p> : null}
            </div>

            <div className="admin-stack-sm">
              {activeDocument?.preview_url ? (
                <>
                  <div className="admin-row admin-row--between">
                    <div>
                      <div className="admin-row admin-row--gap">
                        <p className="admin-text-strong">{activeDocument.document_type}</p>
                        <StatusBadge status={activeDocument.review_status} />
                      </div>
                      <p className="admin-copy-xs">{activeDocument.file_url}</p>
                    </div>
                    <a href={activeDocument.preview_url} target="_blank" rel="noreferrer" className="app-link-button">
                      <ExternalLink size={16} />
                      Open File
                    </a>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {REVIEWABLE_STATUSES.map((status) => (
                      <Button
                        key={status}
                        variant={activeDocument.review_status === status ? "primary" : "secondary"}
                        loading={savingDocumentId === activeDocument.id && activeDocument.review_status !== status}
                        disabled={savingDocumentId === activeDocument.id || activeDocument.review_status === status}
                        onClick={() => updateDocumentStatus(activeDocument, status)}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>

                  {isPdfFile(activeDocument.file_url) ? (
                    <iframe
                      title={activeDocument.document_type}
                      src={activeDocument.preview_url}
                      className="app-preview-frame admin-users-page__preview-frame"
                    />
                  ) : (
                    <img
                      src={activeDocument.preview_url}
                      alt={activeDocument.document_type}
                      className="app-preview-image admin-users-page__preview-image"
                    />
                  )}
                </>
              ) : (
                <div className="app-empty-box app-empty-box--center">
                  Select a file to preview it here.
                </div>
              )}

              {activeDocument?.is_missing ? (
                <div className="app-empty-box">
                  This required document has not been uploaded yet, so it is tagged as `Missing`.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(reviewRequest)} onClose={closeProfileRequestReview} title="Review Profile Change Request">
        {reviewRequest ? (
          <div className="app-modal-stack">
            <div className="admin-panel-grid">
              <div className="admin-card-panel">
                <p className="admin-panel-title">Current Profile</p>
                <p className="admin-text-strong admin-panel-copy">{reviewRequest.profiles?.full_name || "No current name"}</p>
                <p className="admin-copy-xs">{reviewRequest.profiles?.employee_id || "No employee ID"}</p>
                <p className="admin-copy-xs-muted">{reviewRequest.profiles?.location || "No location"}</p>
                <p className="admin-copy-xs admin-panel-copy">
                  Birthday: {reviewRequest.profiles?.birthday || "Not set"} | Age: {reviewRequest.profiles?.age ?? "Not set"}
                </p>
                <p className="admin-copy-xs">
                  Gender: {reviewRequest.profiles?.gender || "Not set"} | Civil Status: {reviewRequest.profiles?.civil_status || "Not set"}
                </p>
                <p className="admin-copy-xs">
                  SSS: {reviewRequest.profiles?.sss || "-"} | PhilHealth: {reviewRequest.profiles?.philhealth || "-"}
                </p>
                <p className="admin-copy-xs">
                  Pag-IBIG: {reviewRequest.profiles?.pagibig || "-"} | TIN: {reviewRequest.profiles?.tin || "-"}
                </p>
              </div>

              <div className="admin-card-panel admin-card-panel--brand">
                <p className="admin-panel-title admin-panel-title--brand">Requested Update</p>
                <p className="admin-text-strong admin-panel-copy">{reviewRequest.requested_full_name || "No requested name"}</p>
                <p className="admin-copy-xs">{new Date(reviewRequest.created_at).toLocaleString()}</p>
                <p className="admin-copy-xs admin-panel-copy">
                  Birthday: {reviewRequest.requested_birthday || "Not set"} | Age: {reviewRequest.requested_age ?? "Not set"}
                </p>
                <p className="admin-copy-xs">
                  Gender: {reviewRequest.requested_gender || "Not set"} | Civil Status:{" "}
                  {reviewRequest.requested_civil_status || "Not set"}
                </p>
                <p className="admin-copy-xs">
                  SSS: {reviewRequest.requested_sss || "-"} | PhilHealth: {reviewRequest.requested_philhealth || "-"}
                </p>
                <p className="admin-copy-xs">
                  Pag-IBIG: {reviewRequest.requested_pagibig || "-"} | TIN: {reviewRequest.requested_tin || "-"}
                </p>
                <StatusBadge status={reviewRequest.status} />
              </div>
            </div>

            <div className="admin-stack-sm">
              <div className="admin-row admin-row--between">
                <div>
                  <p className="admin-text-strong">Requested Profile Picture</p>
                  <p className="admin-copy-xs">Approve this to update the employee avatar on the live profile.</p>
                </div>
                {reviewRequest.preview_url ? (
                  <a href={reviewRequest.preview_url} target="_blank" rel="noreferrer" className="app-link-button">
                    <ExternalLink size={16} />
                    Open File
                  </a>
                ) : null}
              </div>

              {reviewRequest.preview_url ? (
                <img
                  src={reviewRequest.preview_url}
                  alt={reviewRequest.requested_full_name || "Requested profile picture"}
                  className="app-preview-image admin-users-page__preview-image"
                />
              ) : (
                <div className="app-empty-box">
                  No profile picture was attached to this request.
                </div>
              )}
            </div>

            <div className="app-modal-footer">
              <Button
                variant="danger"
                loading={savingRequestId === reviewRequest.id}
                disabled={savingRequestId === reviewRequest.id}
                onClick={() => updateProfileRequestStatus(reviewRequest, "Rejected")}
              >
                Reject
              </Button>
              <Button
                loading={savingRequestId === reviewRequest.id}
                disabled={savingRequestId === reviewRequest.id}
                onClick={() => updateProfileRequestStatus(reviewRequest, "Approved")}
              >
                Approve
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(assignmentProfile)}
        onClose={closeAssignmentEditor}
        title={assignmentProfile ? `Edit Assignment for ${assignmentProfile.full_name || "Employee"}` : "Edit Assignment"}
      >
        <div className="app-modal-stack">
          <div className="app-empty-box">
            Update the employee's assigned location and job description here. This saves directly to their live profile.
          </div>

          <Select
            label="Assigned Location"
            value={assignmentForm.location}
            onChange={(e) => setAssignmentForm((current) => ({ ...current, location: e.target.value }))}
          >
            <option value="">Select area</option>
            {AREA_OPTIONS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </Select>

          <Select
            label="Branch"
            value={assignmentForm.branch}
            onChange={(e) => setAssignmentForm((current) => ({ ...current, branch: e.target.value }))}
          >
            {assignmentBranchOptions.length === 0 ? <option value="">No branches for this area</option> : null}
            {assignmentBranchOptions.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </Select>

          <Select
            label="Position"
            value={assignmentForm.position}
            onChange={(e) => setAssignmentForm((current) => ({ ...current, position: e.target.value }))}
          >
            <option value="">Select position</option>
            {POSITION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>

          <div className="app-modal-footer">
            <Button variant="secondary" onClick={closeAssignmentEditor} disabled={savingAssignment}>
              Cancel
            </Button>
            <Button loading={savingAssignment} onClick={saveAssignment}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
