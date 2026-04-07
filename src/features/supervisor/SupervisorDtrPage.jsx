import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Search, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import StatusBadge from "../../components/ui/StatusBadge";
import { buildCutoffOptions, mergeCutoffOptions } from "../../lib/dtr";
import { getSupervisorScopeLabel, isScopedEmployee, matchesSupervisorScope } from "../../lib/supervisorScope";
import { supabase } from "../../lib/supabase";
import { attachSignedUrls } from "../../lib/storage";
import "./SupervisorDtrPage.css";

const statusOptions = ["All", "Pending Review", "Approved", "Rejected"];
const submitSourceOptions = ["All", "Employee Submitted", "Supervisor Submitted"];
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

function getSubmitSourceLabel(row) {
  return row.submitted_by_role === "supervisor" ? "Supervisor Submitted" : "Employee Submitted";
}

function buildStoragePath(userId, file) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  return `${userId}/${Date.now()}.${ext}`;
}

export default function SupervisorDtrPage({ profile }) {
  const [rows, setRows] = useState([]);
  const [teamProfiles, setTeamProfiles] = useState([]);
  const [filters, setFilters] = useState({ branch: "All", cutoff: "All", status: "All", source: "All", q: "" });
  const [reviewItem, setReviewItem] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const [branchSelection, setBranchSelection] = useState("All");
  const [skipExistingRows, setSkipExistingRows] = useState(true);
  const supervisorCutoffOptions = useMemo(() => buildCutoffOptions(new Date(), 48), []);
  const [submitForm, setSubmitForm] = useState({
    user_ids: [],
    cutoff: supervisorCutoffOptions[0] || "",
    employee_note: "",
  });
  const [submitFile, setSubmitFile] = useState(null);

  useEffect(() => {
    loadRows();
    const channel = supabase
      .channel("supervisor-dtr-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "dtr_submissions" }, loadRows)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile?.location, profile?.branch]);

  async function loadRows() {
    const [dtrRes, profilesRes] = await Promise.all([
      supabase
        .from("dtr_submissions")
        .select("id,user_id,cutoff,employee_note,admin_remarks,file_url,status,approved_at,created_at,submitted_by_role,submitted_by_user_id,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,employee_id,location,branch)")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id,full_name,employee_id,location,branch,role,position")
        .order("full_name", { ascending: true }),
    ]);

    if (dtrRes.error) {
      toast.error(dtrRes.error.message);
      return;
    }

    if (profilesRes.error) {
      toast.error(profilesRes.error.message);
      return;
    }

    const scopedRows = (dtrRes.data ?? []).filter((row) => matchesSupervisorScope(row, profile));
    const withSignedUrls = await attachSignedUrls(scopedRows, "dtr-images");
    setRows(withSignedUrls);

    const scopedTeam = (profilesRes.data ?? []).filter((item) => isScopedEmployee(item, profile));
    setTeamProfiles(scopedTeam);
    setSubmitForm((current) => ({
      ...current,
      user_ids: current.user_ids?.length ? current.user_ids.filter((id) => scopedTeam.some((member) => member.id === id)) : scopedTeam[0] ? [scopedTeam[0].id] : [],
      cutoff: current.cutoff || supervisorCutoffOptions[0] || "",
    }));
  }

  const branches = useMemo(() => ["All", ...Array.from(new Set(rows.map((row) => row.profiles?.branch).filter(Boolean)))], [rows]);
  const cutoffOptions = useMemo(() => ["All", ...mergeCutoffOptions(rows.map((row) => row.cutoff), new Date(), 48)], [rows]);
  const teamOptions = useMemo(
    () =>
      [...teamProfiles]
        .sort((a, b) => {
          const branchCompare = (a.branch || "").localeCompare(b.branch || "");
          if (branchCompare !== 0) return branchCompare;
          return (a.full_name || "").localeCompare(b.full_name || "");
        })
        .map((item) => ({
          id: item.id,
          label: `${item.full_name || "Unnamed Employee"}${item.employee_id ? ` (${item.employee_id})` : ""}`,
          copy: [item.location, item.branch].filter(Boolean).join(" / ") || "No assignment",
          branch: item.branch || "",
        })),
    [teamProfiles]
  );
  const teamBranches = useMemo(
    () => ["All", ...Array.from(new Set(teamProfiles.map((item) => item.branch).filter(Boolean)))],
    [teamProfiles]
  );
  const branchOptionCounts = useMemo(
    () =>
      teamBranches.reduce((acc, branch) => {
        acc[branch] =
          branch === "All" ? teamProfiles.length : teamProfiles.filter((item) => (item.branch || "") === branch).length;
        return acc;
      }, {}),
    [teamBranches, teamProfiles]
  );
  const filteredTeamOptions = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    return teamOptions.filter((item) => {
      const byBranch = branchSelection === "All" || item.branch === branchSelection;
      const byQuery = !query || `${item.label} ${item.copy}`.toLowerCase().includes(query);
      return byBranch && byQuery;
    });
  }, [teamOptions, teamSearch, branchSelection]);
  const existingCutoffKeys = useMemo(
    () =>
      new Set(
        rows
          .filter((row) => row.cutoff === submitForm.cutoff)
          .map((row) => `${row.user_id}:::${row.cutoff}`)
      ),
    [rows, submitForm.cutoff]
  );

  function matchesSubmitSource(row) {
    if (filters.source === "Employee Submitted") return (row.submitted_by_role || "employee") === "employee";
    if (filters.source === "Supervisor Submitted") return row.submitted_by_role === "supervisor";
    return true;
  }

  const filtered = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = [row.profiles?.full_name, row.profiles?.employee_id, row.cutoff, row.profiles?.branch]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (filters.branch === "All" || row.profiles?.branch === filters.branch) &&
        (filters.cutoff === "All" || row.cutoff === filters.cutoff) &&
        (filters.status === "All" || row.status === filters.status) &&
        matchesSubmitSource(row) &&
        (!query || haystack.includes(query))
      );
    });
  }, [rows, filters]);

  const pendingByBranch = useMemo(() => {
    const grouped = filtered.reduce((acc, row) => {
      if (row.status !== "Pending Review") return acc;
      const key = row.profiles?.branch || "Unassigned";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filtered]);

  function openReview(item) {
    setReviewItem(item);
    setAdminRemarks(item.admin_remarks || "");
  }

  function closeReview() {
    setReviewItem(null);
    setAdminRemarks("");
  }

  async function updateStatus(status) {
    if (!reviewItem) return;
    setLoading(true);
    const payload = {
      status,
      admin_remarks: adminRemarks.trim() || null,
      approved_at: status === "Approved" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("dtr_submissions").update(payload).eq("id", reviewItem.id);
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Marked as ${status}`);
    closeReview();
    loadRows();
  }

  function closeSubmitModal() {
    setSubmitOpen(false);
    setConfirmingSubmit(false);
    setTeamSearch("");
    setBranchSelection("All");
    setSkipExistingRows(true);
    setSubmitFile(null);
    setSubmitForm((current) => ({
      user_ids: teamProfiles[0]?.id ? [teamProfiles[0].id] : [],
      cutoff: current.cutoff || supervisorCutoffOptions[0] || "",
      employee_note: "",
    }));
  }

  async function submitTeamDtr() {
    if (!submitForm.user_ids.length) {
      toast.error("Please select at least one team member first.");
      return;
    }

    if (!submitForm.cutoff) {
      toast.error("Please choose a cutoff first.");
      return;
    }

    if (!submitFile) {
      toast.error("Please upload a DTR image first.");
      return;
    }

    if (submitFile.type && !IMAGE_TYPES.includes(submitFile.type)) {
      toast.error("DTR must be uploaded as PNG, JPG, or WEBP.");
      return;
    }

    setSubmitting(true);
    try {
      const selectedUserIds = submitForm.user_ids.filter(Boolean);
      const targetUserIds = skipExistingRows
        ? selectedUserIds.filter((userId) => !existingCutoffKeys.has(`${userId}:::${submitForm.cutoff}`))
        : selectedUserIds;

      if (!targetUserIds.length) {
        toast.error("All selected team members already have a DTR for this cutoff.");
        return;
      }

      let submittedCount = 0;
      for (const userId of targetUserIds) {
        const path = buildStoragePath(userId, submitFile);
        const upload = await supabase.storage.from("dtr-images").upload(path, submitFile, {
          cacheControl: "3600",
          contentType: submitFile.type || undefined,
          upsert: false,
        });
        if (upload.error) throw upload.error;

        const { error } = await supabase.from("dtr_submissions").insert({
          user_id: userId,
          cutoff: submitForm.cutoff,
          employee_note: submitForm.employee_note.trim() || null,
          file_url: path,
          status: "Pending Review",
          submitted_by_role: "supervisor",
          submitted_by_user_id: profile?.id || null,
          approved_at: null,
        });
        if (error) throw error;
        submittedCount += 1;
      }

      const skippedCount = skipExistingRows ? selectedUserIds.length - targetUserIds.length : 0;
      toast.success(
        skippedCount > 0
          ? `Submitted ${submittedCount} team DTR(s). Skipped ${skippedCount} existing cutoff match(es).`
          : `Submitted ${submittedCount} team DTR(s) successfully.`
      );
      closeSubmitModal();
      await loadRows();
    } catch (error) {
      toast.error(error.message || "Unable to submit team DTR.");
    } finally {
      setSubmitting(false);
    }
  }

  function openSubmitConfirmation() {
    if (!submitForm.user_ids.length) {
      toast.error("Please select at least one team member first.");
      return;
    }
    if (!submitForm.cutoff) {
      toast.error("Please choose a cutoff first.");
      return;
    }
    if (!submitFile) {
      toast.error("Please upload a DTR image first.");
      return;
    }
    setConfirmingSubmit(true);
  }

  if (!profile?.location) {
    return <p className="admin-empty-copy">This supervisor account needs an area assignment before the team DTR queue can load.</p>;
  }

  const selectedTeamMembers = teamOptions.filter((item) => submitForm.user_ids.includes(item.id));
  const selectedBranchCount = filteredTeamOptions.filter((item) => submitForm.user_ids.includes(item.id)).length;
  const skippedTeamIds = new Set(
    selectedTeamMembers
      .filter((item) => existingCutoffKeys.has(`${item.id}:::${submitForm.cutoff}`))
      .map((item) => item.id)
  );
  const skippedTeamMembers = selectedTeamMembers.filter((item) => skippedTeamIds.has(item.id));
  const submitReadyMembers = skipExistingRows
    ? selectedTeamMembers.filter((item) => !skippedTeamIds.has(item.id))
    : selectedTeamMembers;

  return (
    <div className="admin-page supervisor-dtr-page">
      <Card>
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title">Team DTR Review Queue</h2>
            <p className="admin-section-copy">Review submissions for {getSupervisorScopeLabel(profile)} only.</p>
          </div>
          <div className="supervisor-dtr-page__header-actions">
            <span className="app-pill app-pill--warning">
              {rows.filter((row) => row.status === "Pending Review").length} Pending
            </span>
            <Button className="supervisor-dtr-page__submit-button" onClick={() => setSubmitOpen(true)}>
              <Plus size={16} />
              Submit Team DTR
            </Button>
          </div>
        </div>

        {pendingByBranch.length ? (
          <div className="supervisor-dtr-page__summary-grid">
            {pendingByBranch.map(([branch, count]) => (
              <div key={branch} className="supervisor-dtr-page__summary-card">
                <p className="supervisor-dtr-page__summary-label">{branch}</p>
                <p className="supervisor-dtr-page__summary-value">{count}</p>
                <p className="supervisor-dtr-page__summary-copy">pending submission(s)</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="admin-filters-grid admin-filters-grid--queue">
          <Select label="Branch" value={filters.branch} onChange={(e) => setFilters((prev) => ({ ...prev, branch: e.target.value }))}>
            {branches.map((branch) => (
              <option key={branch}>{branch}</option>
            ))}
          </Select>
          <Select label="Cutoff" value={filters.cutoff} onChange={(e) => setFilters((prev) => ({ ...prev, cutoff: e.target.value }))}>
            {cutoffOptions.map((cutoff) => (
              <option key={cutoff}>{cutoff}</option>
            ))}
          </Select>
          <Select label="Status" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            {statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </Select>
          <Select label="Submit Source" value={filters.source} onChange={(e) => setFilters((prev) => ({ ...prev, source: e.target.value }))}>
            {submitSourceOptions.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </Select>
          <label className="admin-search-label admin-search-label--wide">
            <span className="admin-search-label-text">Search</span>
            <div className="admin-search-wrap">
              <Search size={16} className="admin-search-icon" />
              <input
                className="admin-search-input"
                placeholder="Employee name, employee ID, branch, cutoff"
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
            <h2 className="admin-section-title">Scoped DTR Submissions</h2>
            <p className="admin-section-copy">{filtered.length} matching submission(s)</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr className="admin-table-head-row admin-table-head-row--sm">
                <th className="admin-table-head-cell">Employee</th>
                <th className="admin-table-head-cell">Employee ID</th>
                <th className="admin-table-head-cell">Branch</th>
                <th className="admin-table-head-cell">Cutoff</th>
                <th className="admin-table-head-cell">Submitted By</th>
                <th className="admin-table-head-cell">Preview</th>
                <th className="admin-table-head-cell">Submitted</th>
                <th className="admin-table-head-cell">Status</th>
                <th className="admin-table-head-cell">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="admin-table-row">
                  <td className="admin-table-cell">{item.profiles?.full_name || "Unknown Employee"}</td>
                  <td className="admin-table-cell">{item.profiles?.employee_id || "-"}</td>
                  <td className="admin-table-cell">{item.profiles?.branch || "No branch"}</td>
                  <td className="admin-table-cell">{item.cutoff || "-"}</td>
                  <td className="admin-table-cell">
                    <span
                      className={`supervisor-dtr-page__source-badge${
                        item.submitted_by_role === "supervisor" ? " supervisor-dtr-page__source-badge--supervisor" : ""
                      }`}
                    >
                      {getSubmitSourceLabel(item)}
                    </span>
                  </td>
                  <td className="admin-table-cell">
                    {item.preview_url ? (
                      <a href={item.preview_url} target="_blank" rel="noreferrer" className="app-preview-thumb-link">
                        <img src={item.preview_url} alt="DTR preview" className="app-preview-thumb" />
                      </a>
                    ) : (
                      <div className="app-preview-thumb-empty">No Preview</div>
                    )}
                  </td>
                  <td className="admin-table-cell">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="admin-table-cell">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="admin-table-cell">
                    <Button className="app-compact-button" onClick={() => openReview(item)}>
                      {item.status === "Pending Review" ? "Review" : "View"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <p className="admin-empty-copy">No DTR submissions match this supervisor scope right now.</p> : null}
      </Card>

      <Modal open={Boolean(reviewItem)} onClose={closeReview} title="Review Team DTR">
        {reviewItem ? (
          <div className="app-modal-stack">
            <div className="admin-card-panel">
              <p className="app-summary-line"><span className="app-summary-label">Employee:</span> {reviewItem.profiles?.full_name || "Unknown Employee"}</p>
              <p className="app-summary-line"><span className="app-summary-label">Branch:</span> {reviewItem.profiles?.branch || "No branch"}</p>
              <p className="app-summary-line"><span className="app-summary-label">Cutoff:</span> {reviewItem.cutoff || "Not set"}</p>
              <p className="app-summary-line">
                <span className="app-summary-label">Submitted By:</span>{" "}
                {reviewItem.submitted_by_role === "supervisor" ? "Supervisor on behalf of team member" : "Employee"}
              </p>
              <p className="app-summary-line"><span className="app-summary-label">Employee Note:</span> {reviewItem.employee_note?.trim() || "No note provided"}</p>
            </div>
            {reviewItem.preview_url ? (
              <a href={reviewItem.preview_url} target="_blank" rel="noreferrer" className="app-preview-image-link app-preview-overlay-link">
                <div className="app-preview-frame-wrap">
                  <img src={reviewItem.preview_url} alt="DTR full preview" className="app-preview-image supervisor-dtr-page__modal-preview" />
                  <div className="app-preview-chip">
                    <ExternalLink size={14} />
                    View Full Image
                  </div>
                </div>
              </a>
            ) : (
              <div className="app-empty-box">Unable to load preview URL.</div>
            )}
            <label className="app-field-block">
              <span className="app-field-label">Supervisor Remarks</span>
              <textarea
                className="app-textarea"
                placeholder="Add team-level review notes before approving or rejecting"
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
              />
            </label>
            <div className="app-modal-footer">
              <Button variant="secondary" onClick={() => updateStatus("Pending Review")} loading={loading}>
                Return Pending
              </Button>
              <Button variant="danger" onClick={() => updateStatus("Rejected")} loading={loading}>
                Reject
              </Button>
              <Button onClick={() => updateStatus("Approved")} loading={loading}>
                Approve
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={submitOpen} onClose={closeSubmitModal} title="Submit Team DTR">
        <div className="app-modal-stack">
          <div className="app-field-block">
            <div className="supervisor-dtr-page__selection-head">
              <span className="app-field-label">Team Members</span>
              <div className="supervisor-dtr-page__selection-actions">
                <button
                  type="button"
                  className="supervisor-dtr-page__selection-link"
                  onClick={() => setSubmitForm((current) => ({ ...current, user_ids: teamProfiles.map((item) => item.id) }))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="supervisor-dtr-page__selection-link"
                  onClick={() =>
                    setSubmitForm((current) => ({
                      ...current,
                      user_ids: Array.from(new Set([...current.user_ids, ...filteredTeamOptions.map((item) => item.id)])),
                    }))
                  }
                >
                  Select Visible
                </button>
                <button
                  type="button"
                  className="supervisor-dtr-page__selection-link"
                  onClick={() => setSubmitForm((current) => ({ ...current, user_ids: [] }))}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="supervisor-dtr-page__selection-link"
                  onClick={() =>
                    setSubmitForm((current) => ({
                      ...current,
                      user_ids: current.user_ids.filter((id) => !filteredTeamOptions.some((item) => item.id === id)),
                    }))
                  }
                >
                  Deselect Visible
                </button>
              </div>
            </div>
            <div className="supervisor-dtr-page__selection-toolbar">
              <label className="admin-search-label admin-search-label--wide">
                <span className="admin-search-label-text">Search Team</span>
                <div className="admin-search-wrap">
                  <Search size={16} className="admin-search-icon" />
                  <input
                    className="admin-search-input"
                    placeholder="Name, employee ID, branch"
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                  />
                </div>
              </label>
              <Select label="Select By Branch" value={branchSelection} onChange={(e) => setBranchSelection(e.target.value)}>
                {teamBranches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch} ({branchOptionCounts[branch] || 0})
                  </option>
                ))}
              </Select>
              <Button
                variant="secondary"
                className="supervisor-dtr-page__branch-select-button"
                onClick={() =>
                  setSubmitForm((current) => ({
                    ...current,
                    user_ids: Array.from(new Set([...current.user_ids, ...filteredTeamOptions.map((item) => item.id)])),
                  }))
                }
                disabled={!filteredTeamOptions.length}
              >
                Select Branch ({filteredTeamOptions.length})
              </Button>
            </div>
            <div className="supervisor-dtr-page__team-list">
              {teamOptions.length === 0 ? (
                <p className="admin-empty-copy">No team members in scope.</p>
              ) : filteredTeamOptions.length === 0 ? (
                <p className="admin-empty-copy">No team members match the current search or branch filter.</p>
              ) : (
                filteredTeamOptions.map((item) => {
                  const checked = submitForm.user_ids.includes(item.id);
                  const willSkip = existingCutoffKeys.has(`${item.id}:::${submitForm.cutoff}`);
                  return (
                    <label
                      key={item.id}
                      className={`supervisor-dtr-page__team-item${checked ? " supervisor-dtr-page__team-item--selected" : ""}${
                        willSkip ? " supervisor-dtr-page__team-item--skip" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSubmitForm((current) => ({
                            ...current,
                            user_ids: checked
                              ? current.user_ids.filter((id) => id !== item.id)
                              : [...current.user_ids, item.id],
                          }))
                        }
                      />
                      <div>
                        <p className="supervisor-dtr-page__team-name">{item.label}</p>
                        <p className="supervisor-dtr-page__team-copy">{item.copy}</p>
                        {willSkip ? <p className="supervisor-dtr-page__team-warning">Already has a DTR for this cutoff. Will be skipped.</p> : null}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
          {selectedTeamMembers.length ? (
            <div className="app-info-panel">
              Ready to apply this submission to {submitReadyMembers.length} team member(s):{" "}
              {submitReadyMembers
                .slice(0, 3)
                .map((item) => item.label)
                .join(", ")}
              {submitReadyMembers.length > 3 ? ` and ${submitReadyMembers.length - 3} more` : ""}
            </div>
          ) : null}
          {skippedTeamMembers.length ? (
            <p className="supervisor-dtr-page__skip-summary">
              {skipExistingRows
                ? `${skippedTeamMembers.length} selected team member(s) already have this cutoff and will be skipped.`
                : `${skippedTeamMembers.length} selected team member(s) already have this cutoff, but they will still be included.`}
            </p>
          ) : null}
          <label className="supervisor-dtr-page__toggle">
            <input
              type="checkbox"
              checked={skipExistingRows}
              onChange={(e) => setSkipExistingRows(e.target.checked)}
            />
            <span>Skip existing cutoff rows</span>
          </label>
          {branchSelection !== "All" ? (
            <p className="app-copy-sm">
              {selectedBranchCount} selected in the current branch-filtered view.
            </p>
          ) : null}
          <Select
            label="Cutoff"
            value={submitForm.cutoff}
            onChange={(e) => setSubmitForm((current) => ({ ...current, cutoff: e.target.value }))}
          >
            {supervisorCutoffOptions.map((cutoff) => (
              <option key={cutoff} value={cutoff}>
                {cutoff}
              </option>
            ))}
          </Select>
          <label className="app-field-block">
            <span className="app-field-label">DTR Image</span>
            <label className="supervisor-dtr-page__upload-field">
              <UploadCloud size={16} />
              <span>{submitFile ? submitFile.name : "Upload DTR file"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="supervisor-dtr-page__hidden-input"
                onChange={(e) => setSubmitFile(e.target.files?.[0] || null)}
              />
            </label>
          </label>
          <label className="app-field-block">
            <span className="app-field-label">Submission Note</span>
            <textarea
              className="app-textarea"
              placeholder="Add context for this team submission if needed"
              value={submitForm.employee_note}
              onChange={(e) => setSubmitForm((current) => ({ ...current, employee_note: e.target.value }))}
            />
          </label>
          <div className="app-modal-footer">
            <Button variant="secondary" onClick={closeSubmitModal}>
              Cancel
            </Button>
            <Button onClick={openSubmitConfirmation} disabled={!teamProfiles.length}>
              Review Submission
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmingSubmit} onClose={() => setConfirmingSubmit(false)} title="Confirm Bulk Team DTR">
        <div className="app-modal-stack">
          <div className="supervisor-dtr-page__confirm-head">
            <span className="supervisor-dtr-page__confirm-pill">{selectedTeamMembers.length} selected</span>
            <span className="supervisor-dtr-page__confirm-pill supervisor-dtr-page__confirm-pill--ready">{submitReadyMembers.length} ready</span>
            <span className="supervisor-dtr-page__confirm-pill supervisor-dtr-page__confirm-pill--skip">
              {skipExistingRows ? skippedTeamMembers.length : 0} skipped
            </span>
          </div>
          <div className="admin-card-panel">
            <p className="app-summary-line">
              <span className="app-summary-label">Selected Team Members:</span> {selectedTeamMembers.length}
            </p>
            <p className="app-summary-line">
              <span className="app-summary-label">Ready To Submit:</span> {submitReadyMembers.length}
            </p>
            <p className="app-summary-line">
              <span className="app-summary-label">Will Be Skipped:</span> {skippedTeamMembers.length}
            </p>
            <p className="app-summary-line">
              <span className="app-summary-label">Cutoff:</span> {submitForm.cutoff || "Not set"}
            </p>
            <p className="app-summary-line">
              <span className="app-summary-label">File:</span> {submitFile?.name || "No file selected"}
            </p>
            <p className="app-summary-line">
              <span className="app-summary-label">Submission Note:</span> {submitForm.employee_note?.trim() || "No note provided"}
            </p>
          </div>
          <div className="supervisor-dtr-page__confirm-list">
            {selectedTeamMembers.map((item) => (
              <div
                key={item.id}
                className={`supervisor-dtr-page__confirm-item${skippedTeamIds.has(item.id) ? " supervisor-dtr-page__confirm-item--skip" : ""}`}
              >
                <p className="supervisor-dtr-page__team-name">{item.label}</p>
                <p className="supervisor-dtr-page__team-copy">{item.copy}</p>
                {skippedTeamIds.has(item.id) ? (
                  <p className="supervisor-dtr-page__team-warning">Skipped: existing DTR already found for this cutoff.</p>
                ) : (
                  <p className="supervisor-dtr-page__team-ready">Ready for submission.</p>
                )}
              </div>
            ))}
          </div>
          <div className="app-modal-footer">
            <Button variant="secondary" onClick={() => setConfirmingSubmit(false)}>
              Back
            </Button>
            <Button onClick={submitTeamDtr} loading={submitting} disabled={!submitReadyMembers.length}>
              Confirm Submit
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
