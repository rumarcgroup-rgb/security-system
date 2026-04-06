import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ExternalLink, Search, X } from "lucide-react";
import Card from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import Modal from "../../components/ui/Modal";
import { getBranchesForArea, sortBranches } from "../../lib/branches";
import { sortAreas } from "../../lib/areas";
import { supabase } from "../../lib/supabase";
import { attachSignedUrls } from "../../lib/storage";
import { mergeCutoffOptions } from "../../lib/dtr";
import "./AdminDtrPage.css";

const statusOptions = ["All", "Pending Review", "Approved", "Rejected"];

export default function AdminDtrPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ area: "All", branch: "All", cutoff: "All", status: "All", q: "" });
  const [reviewItem, setReviewItem] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRows();
    const channel = supabase
      .channel("admin-dtr-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "dtr_submissions" }, loadRows)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function loadRows() {
    const { data, error } = await supabase
      .from("dtr_submissions")
      .select("id,user_id,cutoff,employee_note,admin_remarks,file_url,status,approved_at,created_at,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,role,employee_id,location,branch)")
      .order("created_at", { ascending: false });
    if (!error) {
      const withSignedUrls = await attachSignedUrls(data || [], "dtr-images");
      setRows(withSignedUrls);
    }
  }

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

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const name = (r.profiles?.full_name || "").toLowerCase();
      const empId = (r.profiles?.employee_id || "").toLowerCase();
      const byArea = filters.area === "All" || r.profiles?.location === filters.area;
      const byBranch = filters.branch === "All" || r.profiles?.branch === filters.branch;
      const byCutoff = filters.cutoff === "All" || r.cutoff === filters.cutoff;
      const byStatus = filters.status === "All" || r.status === filters.status;
      const byQ = !filters.q || name.includes(filters.q.toLowerCase()) || empId.includes(filters.q.toLowerCase());
      return byArea && byBranch && byCutoff && byStatus && byQ;
    });
  }, [rows, filters]);

  const grouped = useMemo(() => {
    const groupedMap = filtered.reduce((acc, item) => {
      const key = item.profiles?.location || "Unassigned";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
    return sortAreas(Object.keys(groupedMap)).reduce((acc, key) => {
      acc[key] = groupedMap[key];
      return acc;
    }, {});
  }, [filtered]);

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
    } else {
      toast.success(`Marked as ${status}`);
      setAdminRemarks("");
      setReviewItem(null);
      loadRows();
    }
  }

  function openReview(item) {
    setReviewItem(item);
    setAdminRemarks(item.admin_remarks || "");
  }

  function closeReview() {
    setReviewItem(null);
    setAdminRemarks("");
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
            <Button className="admin-button-full" onClick={loadRows}>
              Filter
            </Button>
            <Button
              className="admin-button-full"
              variant="secondary"
              onClick={() => setFilters({ area: "All", branch: "All", cutoff: "All", status: "All", q: "" })}
            >
              Reset
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
                    <th className="admin-table-head-cell">Employee</th>
                    <th className="admin-table-head-cell">Employee ID</th>
                    <th className="admin-table-head-cell">Selected Cutoff</th>
                    <th className="admin-table-head-cell">DTR Preview</th>
                    <th className="admin-table-head-cell">Date Submitted</th>
                    <th className="admin-table-head-cell">Date Approved</th>
                    <th className="admin-table-head-cell">Status</th>
                    <th className="admin-table-head-cell">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="admin-table-row">
                      <td className="admin-table-cell">
                        <p className="admin-dtr-page__employee-name">{item.profiles?.full_name || "Unknown"}</p>
                        <p className="admin-dtr-page__employee-role">{item.profiles?.role || "Employee"}</p>
                        <p className="admin-dtr-page__employee-branch">{item.profiles?.branch || "No branch"}</p>
                      </td>
                      <td className="admin-table-cell">{item.profiles?.employee_id || "-"}</td>
                      <td className="admin-table-cell">{item.cutoff || "-"}</td>
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
                      </td>
                      <td className="admin-table-cell">
                        <Button className="app-compact-button" onClick={() => openReview(item)}>
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
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

      <Modal open={Boolean(reviewItem)} onClose={closeReview}>

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
    </div>
  );
}
