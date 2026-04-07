import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import { AREA_OPTIONS, sortAreas } from "../../lib/areas";
import { getBranchesForArea } from "../../lib/branches";
import { supabase } from "../../lib/supabase";
import { attachSignedUrls } from "../../lib/storage";
import AssignmentEditorModal from "./users/AssignmentEditorModal";
import PendingProfileRequestsList from "./users/PendingProfileRequestsList";
import PeopleDirectoryTable from "./users/PeopleDirectoryTable";
import ProfileRequestReviewModal from "./users/ProfileRequestReviewModal";
import "./AdminUsersPage.css";

const POSITION_OPTIONS = ["CGroup Access", "Security Guard", "Janitor", "Area Supervisor"];
const SUPERVISOR_POSITION = "Area Supervisor";

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState([]);
  const [profileRequests, setProfileRequests] = useState([]);
  const [filters, setFilters] = useState({ role: "All", location: "All", q: "" });
  const [requestFilters, setRequestFilters] = useState({ status: "Pending Review", q: "" });
  const [savingId, setSavingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewRequest, setReviewRequest] = useState(null);
  const [savingRequestId, setSavingRequestId] = useState(null);
  const [assignmentProfile, setAssignmentProfile] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({ location: "", branch: "", position: "" });
  const [savingAssignment, setSavingAssignment] = useState(false);
  const assignmentBranchOptions = useMemo(() => getBranchesForArea(assignmentForm.location), [assignmentForm.location]);
  const isSupervisorAssignment = assignmentProfile?.role === "supervisor";

  useEffect(() => {
    loadPageData();
    const channel = supabase
      .channel("admin-users-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadPageData)
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
        "id,user_id,requested_full_name,requested_avatar_url,requested_birthday,requested_age,requested_gender,requested_civil_status,requested_sss,requested_philhealth,requested_pagibig,requested_tin,status,created_at,reviewed_at,profiles:profiles!profile_change_requests_user_id_profile_fkey(full_name,employee_id,location,avatar_url,birthday,age,gender,civil_status,sss,philhealth,pagibig,tin)"
      )
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
    const payload = {
      role,
      ...(role === "supervisor" ? { position: SUPERVISOR_POSITION, branch: null } : {}),
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", profileId);
    setSavingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === profileId
          ? {
              ...profile,
              ...payload,
            }
          : profile
      )
    );
    toast.success(`Role updated to ${role}.`);
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
      position: profile.role === "supervisor" ? SUPERVISOR_POSITION : profile.position || "",
    });
  }

  function closeAssignmentEditor() {
    setAssignmentProfile(null);
    setAssignmentForm({ location: "", branch: "", position: "" });
    setSavingAssignment(false);
  }

  function setAssignmentField(key, value) {
    setAssignmentForm((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    setAssignmentForm((current) => {
      if (!assignmentProfile) return current;
      if (isSupervisorAssignment) {
        if (!current.branch && current.position === SUPERVISOR_POSITION) return current;
        return {
          ...current,
          position: SUPERVISOR_POSITION,
          branch: "",
        };
      }
      if (assignmentBranchOptions.includes(current.branch)) return current;
      return {
        ...current,
        branch: assignmentBranchOptions[0] || "",
      };
    });
  }, [assignmentBranchOptions, assignmentProfile, isSupervisorAssignment]);

  async function saveAssignment() {
    if (!assignmentProfile?.id) return;

    const payload = {
      location: assignmentForm.location.trim() || null,
      branch: isSupervisorAssignment ? null : assignmentForm.branch.trim() || null,
      position: isSupervisorAssignment ? SUPERVISOR_POSITION : assignmentForm.position.trim() || null,
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

  const filteredProfileRequests = useMemo(() => {
    const query = requestFilters.q.trim().toLowerCase();

    return profileRequests.filter((request) => {
      const matchesStatus = requestFilters.status === "All" || request.status === requestFilters.status;
      const haystack = [
        request.profiles?.full_name,
        request.profiles?.employee_id,
        request.profiles?.location,
        request.requested_full_name,
        request.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [profileRequests, requestFilters]);

  const pendingRequestCount = useMemo(
    () => profileRequests.filter((request) => request.status === "Pending Review").length,
    [profileRequests]
  );

  if (loading) {
    return <p className="admin-loading-copy">Loading employee records...</p>;
  }

  return (
    <div className="admin-page admin-users-page">
      <Card>
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title">Profile Change Request Queue</h2>
            <p className="admin-section-copy">
              {pendingRequestCount} pending of {profileRequests.length} total request(s). Use the filter to open request history.
            </p>
          </div>
        </div>
        <div className="admin-filters-grid admin-filters-grid--directory admin-users-page__request-filters">
          <Select
            label="Request Status"
            value={requestFilters.status}
            onChange={(e) => setRequestFilters((current) => ({ ...current, status: e.target.value }))}
          >
            <option value="Pending Review">Pending Review</option>
            <option value="All">All</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </Select>
          <label className="admin-search-label admin-search-label--wide">
            <span className="admin-search-label-text">Search Requests</span>
            <div className="admin-search-wrap">
              <Search size={16} className="admin-search-icon" />
              <input
                className="admin-search-input"
                placeholder="Employee, requested name, status, location"
                value={requestFilters.q}
                onChange={(e) => setRequestFilters((current) => ({ ...current, q: e.target.value }))}
              />
            </div>
          </label>
        </div>
        <PendingProfileRequestsList requests={filteredProfileRequests} onReview={setReviewRequest} />
      </Card>

      <Card>
        <div className="admin-filters-grid admin-filters-grid--directory">
          <Select label="Role" value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}>
            <option>All</option>
            <option>employee</option>
            <option>supervisor</option>
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
        <PeopleDirectoryTable
          profiles={filteredProfiles}
          savingId={savingId}
          onUpdateRole={updateRole}
          onOpenAssignmentEditor={openAssignmentEditor}
        />
      </Card>

      <ProfileRequestReviewModal
        reviewRequest={reviewRequest}
        savingRequestId={savingRequestId}
        onClose={closeProfileRequestReview}
        onUpdateProfileRequestStatus={updateProfileRequestStatus}
      />

      <AssignmentEditorModal
        assignmentProfile={assignmentProfile}
        assignmentForm={assignmentForm}
        assignmentBranchOptions={assignmentBranchOptions}
        areaOptions={AREA_OPTIONS}
        isSupervisorAssignment={isSupervisorAssignment}
        positionOptions={POSITION_OPTIONS}
        savingAssignment={savingAssignment}
        onClose={closeAssignmentEditor}
        onSave={saveAssignment}
        onChange={setAssignmentField}
      />
    </div>
  );
}
