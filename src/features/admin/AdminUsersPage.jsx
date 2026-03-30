import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileImage, FileText, Search, ShieldCheck, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import StatusBadge from "../../components/ui/StatusBadge";
import { supabase } from "../../lib/supabase";
import { attachSignedUrls } from "../../lib/storage";

const REQUIRED_DOCUMENTS = ["Valid ID", "NBI Clearance", "Medical Certificate", "Barangay Clearance", "Signature"];
const REVIEWABLE_STATUSES = ["Pending Review", "Verified", "Needs Reupload"];

function isPdfFile(path = "") {
  return /\.pdf($|\?)/i.test(path);
}

function getDocumentIcon(path = "") {
  return isPdfFile(path) ? FileText : FileImage;
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

  useEffect(() => {
    loadPageData();
    const channel = supabase
      .channel("admin-users-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadPageData)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_documents" }, loadPageData)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_change_requests" }, loadPageData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadPageData() {
    setLoading(true);
    await Promise.all([loadProfiles(), loadProfileChangeRequests()]);
    setLoading(false);
  }

  async function loadProfiles() {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
    } else {
      const withSignedAvatars = await attachSignedUrls(data ?? [], "documents", "avatar_url");
      setProfiles(withSignedAvatars);
    }
  }

  async function loadProfileChangeRequests() {
    const { data, error } = await supabase
      .from("profile_change_requests")
      .select(
        "id,user_id,requested_full_name,requested_avatar_url,status,created_at,profiles:profiles!profile_change_requests_user_id_profile_fkey(full_name,employee_id,location,avatar_url)"
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
    return ["All", ...uniqueLocations];
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const query = filters.q.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesRole = filters.role === "All" || profile.role === filters.role;
      const matchesLocation = filters.location === "All" || (profile.location || "Unassigned") === filters.location;
      const haystack = [profile.full_name, profile.employee_id, profile.position, profile.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query);

      return matchesRole && matchesLocation && matchesQuery;
    });
  }, [filters, profiles]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading employee records...</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Pending Profile Changes</h2>
            <p className="text-sm text-slate-500">{profileRequests.length} request(s) waiting for approval</p>
          </div>
        </div>

        <div className="space-y-3">
          {profileRequests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-500">
                  {request.preview_url ? (
                    <img src={request.preview_url} alt={request.requested_full_name || "Requested avatar"} className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={18} />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{request.profiles?.full_name || "Unknown Employee"}</p>
                  <p className="text-sm text-slate-500">
                    {request.profiles?.employee_id || "No Employee ID"} | Requested name: {request.requested_full_name || "No change"}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(request.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={request.status} />
                <Button variant="secondary" onClick={() => setReviewRequest(request)}>
                  Review
                </Button>
              </div>
            </div>
          ))}
          {profileRequests.length === 0 ? <p className="text-sm text-slate-500">No pending profile update requests.</p> : null}
        </div>
      </Card>

      <Card>
        <div className="grid gap-3 md:grid-cols-4">
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
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Search</span>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-brand-500"
                placeholder="Name, employee ID, position, location"
                value={filters.q}
                onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
              />
            </div>
          </label>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">People Directory</h2>
            <p className="text-sm text-slate-500">{filteredProfiles.length} matching profiles</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-3">User</th>
                <th className="pb-3">Assignment</th>
                <th className="pb-3">Government IDs</th>
                <th className="pb-3">Documents</th>
                <th className="pb-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((profile) => (
                <tr key={profile.id} className="border-b border-slate-100 align-top">
                  <td className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-600">
                        {profile.preview_url ? (
                          <img src={profile.preview_url} alt={profile.full_name || "User"} className="h-full w-full object-cover" />
                        ) : profile.role === "admin" ? (
                          <ShieldCheck size={18} />
                        ) : (
                          <UserRound size={18} />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{profile.full_name || "Unnamed User"}</p>
                        <p className="text-xs text-slate-500">{profile.employee_id || "No employee ID assigned"}</p>
                        <p className="mt-1 text-xs text-slate-400">{profile.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <p className="font-medium text-slate-700">{profile.position || "No position set"}</p>
                    <p className="text-xs text-slate-500">{profile.location || "Unassigned location"}</p>
                    <p className="text-xs text-slate-400">
                      Shift: {profile.shift || "Not set"} | Supervisor: {profile.supervisor || "Not set"}
                    </p>
                  </td>
                  <td className="py-4 text-xs text-slate-500">
                    <p>SSS: {profile.sss || "-"}</p>
                    <p>PhilHealth: {profile.philhealth || "-"}</p>
                    <p>Pag-IBIG: {profile.pagibig || "-"}</p>
                    <p>TIN: {profile.tin || "-"}</p>
                  </td>
                  <td className="py-4">
                    <Button variant="secondary" className="w-full min-w-[150px]" onClick={() => openDocumentReview(profile)}>
                      Review Files
                    </Button>
                  </td>
                  <td className="py-4">
                    <div className="flex max-w-[180px] flex-col gap-2">
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
                        className="w-full"
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

        {filteredProfiles.length === 0 ? <p className="mt-4 text-sm text-slate-500">No profiles match the current filters.</p> : null}
      </Card>

      <Modal
        open={Boolean(reviewProfile)}
        onClose={closeDocumentReview}
        title={reviewProfile ? `${reviewProfile.full_name || "Employee"} Documents` : "Employee Documents"}
      >
        {documentsLoading ? (
          <p className="text-sm text-slate-500">Loading uploaded files...</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Available Files</p>
              {documents.map((document) => {
                const Icon = getDocumentIcon(document.file_url);
                const selected = activeDocument?.id === document.id;

                return (
                  <button
                    key={document.id}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      selected ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                    onClick={() => setActiveDocument(document)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-white p-2 text-slate-600 shadow-sm">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-800">{document.document_type}</p>
                          <StatusBadge status={document.review_status} />
                        </div>
                        <p className="truncate text-xs text-slate-500">{document.file_url}</p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {document.created_at ? new Date(document.created_at).toLocaleString() : "No timestamp"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
              {documents.length === 0 ? <p className="text-sm text-slate-500">No uploaded files were found for this employee.</p> : null}
            </div>

            <div className="space-y-3">
              {activeDocument?.preview_url ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{activeDocument.document_type}</p>
                        <StatusBadge status={activeDocument.review_status} />
                      </div>
                      <p className="text-xs text-slate-500">{activeDocument.file_url}</p>
                    </div>
                    <a
                      href={activeDocument.preview_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
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
                      className="h-[65vh] w-full rounded-2xl border border-slate-200"
                    />
                  ) : (
                    <img
                      src={activeDocument.preview_url}
                      alt={activeDocument.document_type}
                      className="max-h-[65vh] w-full rounded-2xl border border-slate-200 object-contain"
                    />
                  )}
                </>
              ) : (
                <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500">
                  Select a file to preview it here.
                </div>
              )}

              {activeDocument?.is_missing ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  This required document has not been uploaded yet, so it is tagged as `Missing`.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(reviewRequest)} onClose={closeProfileRequestReview} title="Review Profile Change Request">
        {reviewRequest ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Profile</p>
                <p className="mt-3 text-sm font-semibold text-slate-800">{reviewRequest.profiles?.full_name || "No current name"}</p>
                <p className="text-xs text-slate-500">{reviewRequest.profiles?.employee_id || "No employee ID"}</p>
                <p className="mt-1 text-xs text-slate-400">{reviewRequest.profiles?.location || "No location"}</p>
              </div>

              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Requested Update</p>
                <p className="mt-3 text-sm font-semibold text-slate-800">{reviewRequest.requested_full_name || "No requested name"}</p>
                <p className="text-xs text-slate-500">{new Date(reviewRequest.created_at).toLocaleString()}</p>
                <StatusBadge status={reviewRequest.status} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Requested Profile Picture</p>
                  <p className="text-xs text-slate-500">Approve this to update the employee avatar on the live profile.</p>
                </div>
                {reviewRequest.preview_url ? (
                  <a
                    href={reviewRequest.preview_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ExternalLink size={16} />
                    Open File
                  </a>
                ) : null}
              </div>

              {reviewRequest.preview_url ? (
                <img
                  src={reviewRequest.preview_url}
                  alt={reviewRequest.requested_full_name || "Requested profile picture"}
                  className="max-h-[50vh] w-full rounded-2xl border border-slate-200 object-contain"
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                  No profile picture was attached to this request.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
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
    </div>
  );
}
