import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Check, ExternalLink, RotateCcw, Search, X } from "lucide-react";
import Card from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import Modal from "../../components/ui/Modal";
import DtrExtractionPanel from "../dtr/DtrExtractionPanel";
import { getBranchesForArea, sortBranches } from "../../lib/branches";
import { sortAreas } from "../../lib/areas";
import {
  getDtrExtractionStatusLabel,
  getPrimaryDtrExtraction,
  saveDtrExtractionReview,
  triggerDtrExtraction,
} from "../../lib/dtrExtraction";
import { supabase } from "../../lib/supabase";
import { mergeCutoffOptions } from "../../lib/dtr";
import { useLiveDtrStore } from "../realtime/useLiveDtrStore";
import "./AdminDtrPage.css";

const statusOptions = ["All", "Pending Review", "Approved", "Rejected"];
const submitSourceOptions = ["All", "Employee Submitted", "Supervisor Submitted"];
const sortOptions = [
  { value: "oldest-pending", label: "Oldest Pending First" },
  { value: "area-backlog", label: "Highest Backlog Area First" },
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
];

function getSubmitSourceLabel(item) {
  return item.submitted_by_role === "supervisor" ? "Supervisor Submitted" : "Employee Submitted";
}

export default function AdminDtrPage({ profile }) {
  const [filters, setFilters] = useState({ area: "All", branch: "All", cutoff: "All", status: "All", source: "All", q: "", sort: "oldest-pending" });
  const [reviewItem, setReviewItem] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [bulkRemarks, setBulkRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingExtraction, setSavingExtraction] = useState(false);
  const [extractingId, setExtractingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const { rows, loading, patchRowsByIds, syncNow, syncRowById } = useLiveDtrStore({
    currentRole: "admin",
    currentUserId: profile?.id,
    scopeProfile: profile,
  });

  const areas = useMemo(() => {
    const list = Array.from(new Set(rows.map((r) => r.profiles?.location).filter(Boolean)));
    return ["All", ...sortAreas(list)];
  }, [rows]);

  const branches = useMemo(() => {
    const list =
      filters.area !== "All"
        ? getBranchesForArea(filters.area)
        : Array.from(new Set(rows.map((r) => r.profiles?.branch).filter(Boolean)));
    return ["All", ...sortBranches(list)];
  }, [filters.area, rows]);

  const cutoffOptions = useMemo(() => {
    return ["All", ...mergeCutoffOptions(rows.map((row) => row.cutoff), new Date(), 48)];
  }, [rows]);

  function matchesSubmitSource(row) {
    if (filters.source === "Employee Submitted") return (row.submitted_by_role || "employee") === "employee";
    if (filters.source === "Supervisor Submitted") return row.submitted_by_role === "supervisor";
    return true;
  }

  const filtered = useMemo(() => {
    const pendingByArea = rows.reduce((acc, item) => {
      if (item.status === "Pending Review") {
        const key = item.profiles?.location || "Unassigned";
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {});

    const visible = rows.filter((r) => {
      const name = (r.profiles?.full_name || "").toLowerCase();
      const empId = (r.profiles?.employee_id || "").toLowerCase();
      const byArea = filters.area === "All" || r.profiles?.location === filters.area;
      const byBranch = filters.branch === "All" || r.profiles?.branch === filters.branch;
      const byCutoff = filters.cutoff === "All" || r.cutoff === filters.cutoff;
      const byStatus = filters.status === "All" || r.status === filters.status;
      const bySource = matchesSubmitSource(r);
      const byQ = !filters.q || name.includes(filters.q.toLowerCase()) || empId.includes(filters.q.toLowerCase());
      return byArea && byBranch && byCutoff && byStatus && bySource && byQ;
    });

    return [...visible].sort((a, b) => {
      const aCreated = new Date(a.created_at).getTime();
      const bCreated = new Date(b.created_at).getTime();

      if (filters.sort === "newest") return bCreated - aCreated;
      if (filters.sort === "oldest") return aCreated - bCreated;
      if (filters.sort === "area-backlog") {
        const areaDiff = (pendingByArea[b.profiles?.location || "Unassigned"] || 0) - (pendingByArea[a.profiles?.location || "Unassigned"] || 0);
        if (areaDiff !== 0) return areaDiff;
        return aCreated - bCreated;
      }

      const aPending = a.status === "Pending Review" ? 0 : 1;
      const bPending = b.status === "Pending Review" ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return aCreated - bCreated;
    });
  }, [rows, filters]);

  const grouped = useMemo(() => {
    const groupedMap = filtered.reduce((acc, item) => {
      const key = item.profiles?.location || "Unassigned";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const keys =
      filters.sort === "area-backlog"
        ? Object.keys(groupedMap).sort((a, b) => groupedMap[b].length - groupedMap[a].length || sortAreas([a, b]).indexOf(a) - sortAreas([a, b]).indexOf(b))
        : sortAreas(Object.keys(groupedMap));

    return keys.reduce((acc, key) => {
      acc[key] = groupedMap[key];
      return acc;
    }, {});
  }, [filtered, filters.sort]);

  const pendingAreaSummary = useMemo(() => {
    const summaryMap = rows.reduce((acc, item) => {
      if (item.status !== "Pending Review") return acc;
      const key = item.profiles?.location || "Unassigned";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(summaryMap)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return sortAreas([a[0], b[0]]).indexOf(a[0]) - sortAreas([a[0], b[0]]).indexOf(b[0]);
      })
      .slice(0, 6);
  }, [rows]);

  const pendingBranchSummary = useMemo(() => {
    const summaryMap = rows.reduce((acc, item) => {
      if (item.status !== "Pending Review") return acc;
      const area = item.profiles?.location || "Unassigned";
      const branch = item.profiles?.branch || "No branch";

      if (filters.area !== "All" && area !== filters.area) return acc;

      const key = `${area}|||${branch}`;
      if (!acc[key]) {
        acc[key] = { area, branch, count: 0 };
      }
      acc[key].count += 1;
      return acc;
    }, {});

    return Object.values(summaryMap)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return sortBranches([a.branch, b.branch]).indexOf(a.branch) - sortBranches([a.branch, b.branch]).indexOf(b.branch);
      })
      .slice(0, 6);
  }, [rows, filters.area]);

  const pendingQuickChips = useMemo(() => {
    const areaChips = pendingAreaSummary.slice(0, 4).map(([area, count]) => ({
      key: `area-${area}`,
      type: "area",
      label: `${area} (${count})`,
      onClick: () => setFilters((p) => ({ ...p, status: "Pending Review", area, branch: "All", sort: "oldest-pending" })),
      active: filters.status === "Pending Review" && filters.area === area && filters.branch === "All",
    }));

    const branchChips = pendingBranchSummary.slice(0, 4).map(({ area, branch, count }) => ({
      key: `branch-${area}-${branch}`,
      type: "branch",
      label: `${branch} (${count})`,
      onClick: () => setFilters((p) => ({ ...p, status: "Pending Review", area, branch, sort: "oldest-pending" })),
      active: filters.status === "Pending Review" && filters.area === area && filters.branch === branch,
    }));

    return [
      {
        key: "pending-only",
        type: "pending",
        label: "Pending Only",
        onClick: () => setFilters((p) => ({ ...p, status: "Pending Review", sort: "oldest-pending" })),
        active: filters.status === "Pending Review" && filters.area === "All" && filters.branch === "All",
      },
      ...areaChips,
      ...branchChips,
    ];
  }, [pendingAreaSummary, pendingBranchSummary, filters.status, filters.area, filters.branch]);

  const visibleSelectableIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const selectedVisibleIds = useMemo(() => selectedIds.filter((id) => visibleSelectableIds.includes(id)), [selectedIds, visibleSelectableIds]);
  const selectedCount = selectedVisibleIds.length;

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => rows.some((row) => row.id === id)));
    setReviewItem((current) => {
      if (!current) return null;
      return rows.find((row) => row.id === current.id) || null;
    });
  }, [rows]);

  async function updateStatus(status) {
    if (!reviewItem) return;
    setSaving(true);
    const payload = {
      status,
      admin_remarks: adminRemarks.trim() || null,
      approved_at: status === "Approved" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("dtr_submissions").update(payload).eq("id", reviewItem.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      patchRowsByIds([reviewItem.id], payload);
      toast.success(`Marked as ${status}`);
      setAdminRemarks("");
      setReviewItem(null);
    }
  }

  async function updateBulkStatus(status) {
    if (!selectedVisibleIds.length) {
      toast.error("Select at least one DTR submission first.");
      return;
    }

    setSaving(true);
    const payload = {
      status,
      admin_remarks: bulkRemarks.trim() || null,
      approved_at: status === "Approved" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("dtr_submissions").update(payload).in("id", selectedVisibleIds);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    patchRowsByIds(selectedVisibleIds, payload);
    toast.success(`Marked ${selectedVisibleIds.length} submission(s) as ${status}`);
    setSelectedIds([]);
    setBulkRemarks("");
  }

  async function quickUpdateStatus(item, status) {
    setSaving(true);
    const payload = {
      status,
      approved_at: status === "Approved" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("dtr_submissions").update(payload).eq("id", item.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    patchRowsByIds([item.id], payload);
    toast.success(`${item.profiles?.full_name || "Submission"} marked as ${status}`);
    if (reviewItem?.id === item.id) {
      closeReview();
    }
  }

  async function runExtraction(item) {
    if (!item?.id) return;
    setExtractingId(item.id);
    try {
      const result = await triggerDtrExtraction(item.id);
      await syncRowById(item.id);
      if (result?.status === "failed") {
        toast.error(result.error || "DTR extraction failed.");
      } else {
        toast.success("AI payroll draft generated.");
      }
    } catch (error) {
      toast.error(error.message || "Unable to run DTR extraction.");
    } finally {
      setExtractingId(null);
    }
  }

  async function saveExtraction(item, extractedData, status) {
    if (!item?.id) return;
    setSavingExtraction(true);
    try {
      await saveDtrExtractionReview({
        submissionId: item.id,
        extractedData,
        status,
      });
      await syncRowById(item.id);
      toast.success(status === "verified" ? "Payroll data verified." : "Payroll draft saved.");
    } catch (error) {
      toast.error(error.message || "Unable to save payroll draft.");
    } finally {
      setSavingExtraction(false);
    }
  }

  function toggleSelected(id) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSelectAllVisible() {
    if (selectedCount === visibleSelectableIds.length && visibleSelectableIds.length > 0) {
      setSelectedIds((current) => current.filter((id) => !visibleSelectableIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...visibleSelectableIds])));
  }

  function openReview(item) {
    setReviewItem(item);
    setAdminRemarks(item.admin_remarks || "");
  }

  function closeReview() {
    setReviewItem(null);
    setAdminRemarks("");
  }

  function getPendingAge(createdAt) {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    return Math.floor(ageMs / (1000 * 60 * 60 * 24));
  }

  function getStaleLabel(item) {
    if (item.status !== "Pending Review") return null;
    const ageDays = getPendingAge(item.created_at);
    if (ageDays >= 5) return { label: `${ageDays}d overdue`, className: "admin-dtr-page__stale admin-dtr-page__stale--danger" };
    if (ageDays >= 2) return { label: `${ageDays}d pending`, className: "admin-dtr-page__stale admin-dtr-page__stale--warning" };
    return null;
  }

  function getPrimaryRowActionLabel(status) {
    if (status === "Approved") return "View";
    if (status === "Rejected") return "Review Again";
    return "Review";
  }

  return (
    <div className="admin-page admin-dtr-page">
      <Card>
        <div className="admin-section-head">
          <div className="admin-section-intro">
            <h2 className="admin-section-title">Employee DTR Review Queue</h2>
            <p className="admin-section-copy">All DTR submissions sent by employees appear here for admin approval.</p>
          </div>
          <span className="app-pill app-pill--warning">
            {rows.filter((row) => row.status === "Pending Review").length} Pending
          </span>
        </div>

        {pendingAreaSummary.length ? (
          <div className="admin-dtr-page__summary-grid">
            {pendingAreaSummary.map(([area, count]) => (
              <div key={area} className="admin-dtr-page__summary-card">
                <p className="admin-dtr-page__summary-label">{area}</p>
                <p className="admin-dtr-page__summary-value">{count}</p>
                <p className="admin-dtr-page__summary-copy">pending submission(s)</p>
              </div>
            ))}
          </div>
        ) : null}

        {pendingBranchSummary.length ? (
          <div className="admin-dtr-page__summary-grid admin-dtr-page__summary-grid--branches">
            {pendingBranchSummary.map(({ area, branch, count }) => (
              <div key={`${area}-${branch}`} className="admin-dtr-page__summary-card admin-dtr-page__summary-card--branch">
                <p className="admin-dtr-page__summary-label">{branch}</p>
                <p className="admin-dtr-page__summary-value">{count}</p>
                <p className="admin-dtr-page__summary-copy">{area} branch backlog</p>
              </div>
            ))}
          </div>
        ) : null}

        {pendingQuickChips.length ? (
          <div className="admin-dtr-page__quick-chips">
            {pendingQuickChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={`admin-dtr-page__quick-chip${chip.active ? " admin-dtr-page__quick-chip--active" : ""}`}
                onClick={chip.onClick}
              >
                {chip.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="admin-filters-grid admin-filters-grid--queue">
          <Select label="Area" value={filters.area} onChange={(e) => setFilters((p) => ({ ...p, area: e.target.value }))}>
            {areas.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select label="Branch" value={filters.branch} onChange={(e) => setFilters((p) => ({ ...p, branch: e.target.value }))}>
            {branches.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select
            label="Cutoff"
            value={filters.cutoff}
            onChange={(e) => setFilters((p) => ({ ...p, cutoff: e.target.value }))}
          >
            {cutoffOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          >
            {statusOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select
            label="Submit Source"
            value={filters.source}
            onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value }))}
          >
            {submitSourceOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select
            label="Sort"
            value={filters.sort}
            onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value }))}
          >
            {sortOptions.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </Select>
          <label className="admin-search-label admin-search-label--wide">
            <span className="admin-search-label-text">Search</span>
            <div className="admin-search-wrap">
              <Search size={16} className="admin-search-icon" />
              <input
                className="admin-search-input"
                placeholder="Employee name or ID"
                value={filters.q}
                onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
              />
            </div>
          </label>
          <div className="admin-filter-actions">
            <Button className="admin-button-full" onClick={() => syncNow({ showLoading: false })}>
              Refresh
            </Button>
            <Button
              className="admin-button-full"
              variant="secondary"
              onClick={() => setFilters({ area: "All", branch: "All", cutoff: "All", status: "All", source: "All", q: "", sort: "oldest-pending" })}
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="admin-dtr-page__bulk-bar">
          <label className="admin-dtr-page__bulk-check">
            <input
              type="checkbox"
              checked={visibleSelectableIds.length > 0 && selectedCount === visibleSelectableIds.length}
              onChange={toggleSelectAllVisible}
            />
            <span>Select all visible</span>
          </label>
          <p className="admin-dtr-page__bulk-copy">{selectedCount} selected from {filtered.length} visible submission(s)</p>
          <label className="admin-dtr-page__bulk-remarks">
            <span className="admin-search-label-text">Shared Admin Remark</span>
            <textarea
              className="app-textarea admin-dtr-page__bulk-remarks-input"
              placeholder="Apply one remark to all selected DTR submissions"
              value={bulkRemarks}
              onChange={(e) => setBulkRemarks(e.target.value)}
            />
          </label>
          <div className="admin-dtr-page__bulk-actions">
            <Button
              variant="secondary"
              onClick={() => setSelectedIds((current) => current.filter((id) => !visibleSelectableIds.includes(id)))}
              disabled={selectedCount === 0 || saving}
            >
              Clear Selection
            </Button>
            <Button variant="secondary" onClick={() => updateBulkStatus("Pending Review")} loading={saving} disabled={selectedCount === 0}>
              <RotateCcw size={15} />
              Return Pending ({selectedCount})
            </Button>
            <Button variant="danger" onClick={() => updateBulkStatus("Rejected")} loading={saving} disabled={selectedCount === 0}>
              Reject Selected ({selectedCount})
            </Button>
            <Button onClick={() => updateBulkStatus("Approved")} loading={saving} disabled={selectedCount === 0}>
              <Check size={15} />
              Approve Selected ({selectedCount})
            </Button>
          </div>
        </div>
      </Card>

      {Object.entries(grouped).map(([location, items]) => {
        const pendingCount = items.filter((x) => x.status === "Pending Review").length;
        return (
          <Card key={location}>
            <h3 className="admin-dtr-page__group-title">
              {location} ({pendingCount} Pending)
            </h3>
            <div className="admin-table-wrap admin-dtr-page__table-wrap">
              <table className="admin-table admin-dtr-page__table">
                <thead>
                  <tr className="admin-table-head-row admin-table-head-row--sm">
                    <th className="admin-table-head-cell">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && items.every((item) => selectedIds.includes(item.id))}
                        onChange={() => {
                          const groupIds = items.map((item) => item.id);
                          const allSelected = groupIds.every((id) => selectedIds.includes(id));
                          setSelectedIds((current) =>
                            allSelected
                              ? current.filter((id) => !groupIds.includes(id))
                              : Array.from(new Set([...current, ...groupIds]))
                          );
                        }}
                      />
                    </th>
                    <th className="admin-table-head-cell">Employee</th>
                    <th className="admin-table-head-cell">Employee ID</th>
                    <th className="admin-table-head-cell">Selected Cutoff</th>
                    <th className="admin-table-head-cell">Submitted By</th>
                    <th className="admin-table-head-cell">DTR Preview</th>
                    <th className="admin-table-head-cell">Date Submitted</th>
                    <th className="admin-table-head-cell">Date Approved</th>
                    <th className="admin-table-head-cell">Status</th>
                    <th className="admin-table-head-cell">Payroll Draft</th>
                    <th className="admin-table-head-cell">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const staleLabel = getStaleLabel(item);

                    return (
                      <tr key={item.id} className="admin-table-row">
                        <td className="admin-table-cell">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelected(item.id)}
                          />
                        </td>
                        <td className="admin-table-cell">
                          <p className="admin-dtr-page__employee-name">{item.profiles?.full_name || "Unknown"}</p>
                          <p className="admin-dtr-page__employee-role">{item.profiles?.role || "Employee"}</p>
                          <p className="admin-dtr-page__employee-branch">{item.profiles?.branch || "No branch"}</p>
                          <p className="admin-dtr-page__employee-source">
                            {getSubmitSourceLabel(item)}
                          </p>
                        </td>
                        <td className="admin-table-cell">{item.profiles?.employee_id || "-"}</td>
                        <td className="admin-table-cell">{item.cutoff || "-"}</td>
                        <td className="admin-table-cell">
                          <span
                            className={`admin-dtr-page__source-badge${
                              item.submitted_by_role === "supervisor" ? " admin-dtr-page__source-badge--supervisor" : ""
                            }`}
                          >
                            {getSubmitSourceLabel(item)}
                          </span>
                        </td>
                        <td className="admin-table-cell">
                          {item.preview_url ? (
                            <a href={item.preview_url} target="_blank" rel="noreferrer" className="app-preview-thumb-link">
                              <img
                                src={item.preview_url}
                                alt="DTR preview"
                                className="app-preview-thumb"
                              />
                            </a>
                          ) : (
                            <div className="app-preview-thumb-empty">
                              No Preview
                            </div>
                          )}
                        </td>
                        <td className="admin-table-cell">{new Date(item.created_at).toLocaleString()}</td>
                        <td className="admin-table-cell">{item.approved_at ? new Date(item.approved_at).toLocaleString() : "-"}</td>
                        <td className="admin-table-cell">
                          <StatusBadge status={item.status} />
                          {staleLabel ? (
                            <p className={staleLabel.className}>{staleLabel.label}</p>
                          ) : null}
                        </td>
                        <td className="admin-table-cell">
                          <StatusBadge status={getDtrExtractionStatusLabel(getPrimaryDtrExtraction(item)?.status)} />
                        </td>
                        <td className="admin-table-cell">
                          <div className="admin-dtr-page__row-actions">
                            {item.status === "Pending Review" ? (
                              <>
                                <Button
                                  className="app-compact-button"
                                  onClick={() => quickUpdateStatus(item, "Approved")}
                                  loading={saving}
                                >
                                  Approve
                                </Button>
                                <Button
                                  className="app-compact-button"
                                  variant="danger"
                                  onClick={() => quickUpdateStatus(item, "Rejected")}
                                  loading={saving}
                                >
                                  Reject
                                </Button>
                              </>
                            ) : null}
                            <Button
                              className="app-compact-button"
                              variant={item.status === "Pending Review" ? "secondary" : "primary"}
                              onClick={() => openReview(item)}
                            >
                              {getPrimaryRowActionLabel(item.status)}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      {filtered.length === 0 ? <p className="admin-empty-copy admin-dtr-page__empty">No submissions found.</p> : null}

      <div className="admin-section-copy admin-dtr-page__helper">
        Need to review a new employee submission from the dashboard? Open{" "}
        <Link className="app-inline-link" to="/admin">
          Dashboard
        </Link>{" "}
        for the latest activity, then come back here to approve or reject it.
      </div>

      <Modal open={Boolean(reviewItem)} onClose={closeReview} showCloseButton={false} panelClassName="admin-dtr-page__review-modal">

        {reviewItem ? (
          <div className="app-modal-stack">
            <div className="admin-modal-header">
              <p className="app-text-strong-md">Review DTR Submission</p>
              <button
                type="button"
                aria-label="Close message"
                className="app-icon-close"
                onClick={() => closeReview()}
              >
                <X size={18} />
              </button>

            </div>
            <div className="admin-card-panel admin-dtr-page__summary">
              <p className="app-summary-line">
                <span className="app-summary-label">Area / Branch:</span> {reviewItem.profiles?.location || "Unassigned"} / {reviewItem.profiles?.branch || "No branch"}
              </p>
              <p className="app-summary-line">
                <span className="app-summary-label">Selected Cutoff:</span> {reviewItem.cutoff || "Not set"}
              </p>
              <p className="app-summary-line">
                <span className="app-summary-label">Submitted:</span> {new Date(reviewItem.created_at).toLocaleString()}
              </p>
              <p className="app-summary-line admin-dtr-page__submit-note">
                <span className="app-summary-label">Submission Source:</span>{" "}
                {reviewItem.submitted_by_role === "supervisor" ? "Submitted by supervisor on behalf of this employee" : "Submitted directly by employee"}
              </p>
              <p className="app-summary-line">
                <span className="app-summary-label">Approved At:</span>{" "}
                {reviewItem.approved_at ? new Date(reviewItem.approved_at).toLocaleString() : "Not approved yet"}
              </p>
              <p className="app-summary-line">
                <span className="app-summary-label">Employee Note:</span>{" "}
                {reviewItem.employee_note?.trim() || "No note provided"}
              </p>
              <p className="app-summary-line">
                <span className="app-summary-label">Admin Remarks:</span>{" "}
                {reviewItem.admin_remarks?.trim() || "No remarks yet"}
              </p>
            </div>
            <div className="admin-dtr-page__review-workspace">
              <div>
                {reviewItem.preview_url ? (
                  <a
                    href={reviewItem.preview_url}
                    target="_blank"
                    rel="noreferrer"
                    className="app-preview-image-link app-preview-overlay-link"
                    title="Open submitted image"
                  >
                    <div className="app-preview-frame-wrap">
                      <img
                        src={reviewItem.preview_url}
                        alt="DTR full preview"
                        className="app-preview-image admin-dtr-page__modal-preview-image"
                      />
                      <div className="app-preview-chip">
                        <ExternalLink size={14} />
                        View Full Image
                      </div>
                    </div>
                  </a>
                ) : (
                  <div className="app-empty-box">
                    Unable to load preview URL.
                  </div>
                )}
              </div>
              <DtrExtractionPanel
                canReview
                extracting={extractingId === reviewItem.id}
                onSaveExtraction={saveExtraction}
                onStartExtraction={runExtraction}
                saving={savingExtraction}
                submission={reviewItem}
              />
            </div>
            <label className="app-field-block admin-dtr-page__remarks">
              <span className="app-field-label">Admin Remarks</span>
              <textarea
                className="app-textarea"
                placeholder="Add remarks for the employee before approving or rejecting"
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
              />
            </label>
            <div className="app-modal-footer">
              <Button variant="secondary" onClick={() => updateStatus("Pending Review")} loading={saving}>
                Return Pending
              </Button>
              <Button variant="danger" onClick={() => updateStatus("Rejected")} loading={saving}>
                Reject
              </Button>
              <Button onClick={() => updateStatus("Approved")} loading={saving}>
                Approve
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
