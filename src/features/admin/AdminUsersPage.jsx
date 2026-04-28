import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import { AREA_OPTIONS, sortAreas } from "../../lib/areas";
import { getBranchesForArea } from "../../lib/branches";
import { supabase } from "../../lib/supabase";
import AssignmentEditorModal from "./users/AssignmentEditorModal";
import PendingProfileRequestsList from "./users/PendingProfileRequestsList";
import PeopleDirectoryTable from "./users/PeopleDirectoryTable";
import ProfileRequestReviewModal from "./users/ProfileRequestReviewModal";
import { useLivePeopleStore } from "../realtime/useLivePeopleStore";
import { isAdminRole, isSuperAdminRole } from "../../lib/roles";
import "./AdminUsersPage.css";

const POSITION_OPTIONS = ["CGroup Access", "Security Guard", "Janitor", "Area Supervisor"];
const SUPERVISOR_POSITION = "Area Supervisor";

export default function AdminUsersPage({ profile }) {
  const canManageUsers = isSuperAdminRole(profile?.role);
  const [filters, setFilters] = useState({ role: "All", location: "All", q: "" });
  const [requestFilters, setRequestFilters] = useState({ status: "Pending Review", q: "" });
  const [savingId, setSavingId] = useState(null);
  const [reviewRequest, setReviewRequest] = useState(null);
  const [savingRequestId, setSavingRequestId] = useState(null);
  const [assignmentProfile, setAssignmentProfile] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({ location: "", branch: "", position: "", supervisor_user_id: "" });
  const [savingAssignment, setSavingAssignment] = useState(false);
  const {
    profiles,
    profileRequests,
    loading,
    patchProfilesByIds,
    patchProfileRequestsByIds,
  } = useLivePeopleStore({
    currentRole: canManageUsers ? "admin" : "employee",
    currentUserId: profile?.id,
    scopeProfile: profile,
  });
  const assignmentBranchOptions = useMemo(() => getBranchesForArea(assignmentForm.location), [assignmentForm.location]);
  const isSupervisorAssignment = assignmentProfile?.role === "supervisor";
  const isEmployeeAssignment = assignmentProfile?.role === "employee";
  const supervisorOptions = useMemo(() => {
    return profiles
      .filter((profile) => profile.role === "supervisor")
      .filter((profile) => !assignmentForm.location || profile.location === assignmentForm.location)
      .filter((profile) => profile.id !== assignmentProfile?.id)
      .sort((left, right) => (left.full_name || "").localeCompare(right.full_name || ""));
  }, [assignmentForm.location, assignmentProfile?.id, profiles]);

  async function updateRole(profileId, role) {
    setSavingId(profileId);
    const payload = {
      role,
      ...(role === "supervisor"
        ? { position: SUPERVISOR_POSITION, branch: null, supervisor_user_id: null, supervisor: null }
        : isAdminRole(role)
          ? { supervisor_user_id: null, supervisor: null }
          : {}),
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", profileId);
    setSavingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    patchProfilesByIds([profileId], payload);
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
      supervisor_user_id: profile.supervisor_user_id || "",
    });
  }

  function closeAssignmentEditor() {
    setAssignmentProfile(null);
    setAssignmentForm({ location: "", branch: "", position: "", supervisor_user_id: "" });
    setSavingAssignment(false);
  }

  function setAssignmentField(key, value) {
    setAssignmentForm((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    setAssignmentForm((current) => {
      if (!assignmentProfile) return current;
      if (isSupervisorAssignment) {
        if (!current.branch && current.position === SUPERVISOR_POSITION && !current.supervisor_user_id) return current;
        return {
          ...current,
          position: SUPERVISOR_POSITION,
          branch: "",
          supervisor_user_id: "",
        };
      }
      if (assignmentBranchOptions.includes(current.branch)) return current;
      return {
        ...current,
        branch: assignmentBranchOptions[0] || "",
      };
    });
  }, [assignmentBranchOptions, assignmentProfile, isSupervisorAssignment]);

  useEffect(() => {
    setAssignmentForm((current) => {
      if (!isEmployeeAssignment || !current.supervisor_user_id) return current;
      if (supervisorOptions.some((profile) => profile.id === current.supervisor_user_id)) return current;
      return {
        ...current,
        supervisor_user_id: "",
      };
    });
  }, [isEmployeeAssignment, supervisorOptions]);

  async function saveAssignment() {
    if (!assignmentProfile?.id) return;

    const selectedSupervisor =
      isEmployeeAssignment && assignmentForm.supervisor_user_id
        ? supervisorOptions.find((profile) => profile.id === assignmentForm.supervisor_user_id) || null
        : null;

    const payload = {
      location: assignmentForm.location.trim() || null,
      branch: isSupervisorAssignment ? null : assignmentForm.branch.trim() || null,
      position: isSupervisorAssignment ? SUPERVISOR_POSITION : assignmentForm.position.trim() || null,
      ...(isEmployeeAssignment
        ? {
            supervisor_user_id: assignmentForm.supervisor_user_id || null,
            supervisor: selectedSupervisor?.full_name || null,
          }
        : {}),
    };

    setSavingAssignment(true);
    const { error } = await supabase.from("profiles").update(payload).eq("id", assignmentProfile.id);
    setSavingAssignment(false);

    if (error) {
      toast.error(error.message || "Unable to update assignment.");
      return;
    }

    patchProfilesByIds([assignmentProfile.id], payload);
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

      if (nextStatus === "Approved") {
        patchProfilesByIds([request.user_id], {
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
        });
      }

      patchProfileRequestsByIds([request.id], {
        status: nextStatus,
        reviewed_at: new Date().toISOString(),
      });
      toast.success(`Profile request ${nextStatus.toLowerCase()}.`);
      closeProfileRequestReview();
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

  if (!canManageUsers) {
    return <Navigate to="/admin" replace />;
  }

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
            <option>super_admin</option>
            <option>admin_ops</option>
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
        isEmployeeAssignment={isEmployeeAssignment}
        isSupervisorAssignment={isSupervisorAssignment}
        positionOptions={POSITION_OPTIONS}
        savingAssignment={savingAssignment}
        supervisorOptions={supervisorOptions}
        onClose={closeAssignmentEditor}
        onSave={saveAssignment}
        onChange={setAssignmentField}
      />
    </div>
  );
}
