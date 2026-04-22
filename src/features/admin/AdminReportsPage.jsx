import { useMemo } from "react";
import { motion } from "framer-motion";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { sortAreas } from "../../lib/areas";
import { getCutoffLabelFromDate } from "../../lib/dtr";
import { useLiveDtrStore } from "../realtime/useLiveDtrStore";
import { useLivePeopleStore } from "../realtime/useLivePeopleStore";
import { useLiveRequirementsStore } from "../realtime/useLiveRequirementsStore";
import "./AdminReportsPage.css";

const statusColors = {
  Approved: "approved",
  "Pending Review": "pending",
  Rejected: "rejected",
};

function csvValue(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export default function AdminReportsPage({ profile }) {
  const { rows, loading: dtrLoading } = useLiveDtrStore({
    currentRole: "admin",
    currentUserId: profile?.id,
    scopeProfile: profile,
  });
  const { profiles, loading: peopleLoading } = useLivePeopleStore({
    currentRole: "admin",
    currentUserId: profile?.id,
    scopeProfile: profile,
  });
  const { rows: requirementRows, loading: requirementsLoading } = useLiveRequirementsStore({
    currentRole: "admin",
    currentUserId: profile?.id,
    scopeProfile: profile,
  });
  const loading = dtrLoading || peopleLoading || requirementsLoading;

  const metrics = useMemo(() => {
    const total = rows.length;
    const approved = rows.filter((row) => row.status === "Approved").length;
    const pending = rows.filter((row) => row.status === "Pending Review").length;
    const rejected = rows.filter((row) => row.status === "Rejected").length;
    const approvalRate = total ? Math.round((approved / total) * 100) : 0;
    return { total, approved, pending, rejected, approvalRate };
  }, [rows]);

  const byStatus = useMemo(() => {
    const grouped = rows.reduce(
      (acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      },
      { Approved: 0, "Pending Review": 0, Rejected: 0 }
    );
    return Object.entries(grouped).map(([label, value]) => ({ label, value }));
  }, [rows]);

  const byLocation = useMemo(() => {
    const grouped = rows.reduce((acc, row) => {
      const key = row.profiles?.location || "Unassigned";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return sortAreas(Object.keys(grouped))
      .map((label) => ({ label, value: grouped[label] }))
      .slice(0, 6);
  }, [rows]);

  const dailyTrend = useMemo(() => {
    const map = new Map();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, 0);
    }
    rows.forEach((row) => {
      const key = new Date(row.created_at).toISOString().slice(0, 10);
      if (map.has(key)) map.set(key, map.get(key) + 1);
    });
    return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
  }, [rows]);

  const maxDaily = Math.max(...dailyTrend.map((point) => point.value), 1);

  const cutoffSummary = useMemo(() => {
    const grouped = rows.reduce((acc, row) => {
      const key = row.cutoff || "No cutoff";
      if (!acc[key]) {
        acc[key] = {
          cutoff: key,
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          locations: new Set(),
          latestApprovedAt: "",
        };
      }

      acc[key].total += 1;
      if (row.status === "Approved") acc[key].approved += 1;
      if (row.status === "Pending Review") acc[key].pending += 1;
      if (row.status === "Rejected") acc[key].rejected += 1;
      if (row.profiles?.location) acc[key].locations.add(row.profiles.location);
      if (row.approved_at && (!acc[key].latestApprovedAt || new Date(row.approved_at) > new Date(acc[key].latestApprovedAt))) {
        acc[key].latestApprovedAt = row.approved_at;
      }

      return acc;
    }, {});

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        locations: Array.from(item.locations).sort().join(", ") || "Unassigned",
      }))
      .sort((left, right) => new Date(right.latestApprovedAt || 0) - new Date(left.latestApprovedAt || 0) || right.total - left.total)
      .slice(0, 10);
  }, [rows]);

  const activeCutoff = rows[0]?.cutoff || getCutoffLabelFromDate(new Date());

  const readinessRows = useMemo(() => {
    const latestDtrByUserId = new Map();
    rows.forEach((row) => {
      if (row.cutoff !== activeCutoff || !row.user_id) return;
      const current = latestDtrByUserId.get(row.user_id);
      if (!current || new Date(row.created_at || 0) > new Date(current.created_at || 0)) {
        latestDtrByUserId.set(row.user_id, row);
      }
    });

    const requirementIssuesByUserId = requirementRows.reduce((map, row) => {
      if (row.status !== "Needs Reupload") return map;
      map.set(row.user_id, (map.get(row.user_id) || 0) + 1);
      return map;
    }, new Map());

    return profiles
      .filter((item) => item.role !== "admin")
      .map((employee) => {
        const dtr = latestDtrByUserId.get(employee.id) || null;
        const fileIssues = requirementIssuesByUserId.get(employee.id) || 0;
        let readiness = "Missing";
        let nextAction = "Follow up with guard or supervisor to submit DTR.";

        if (dtr?.status === "Approved") {
          readiness = fileIssues > 0 ? "Needs Action" : "Submitted";
          nextAction = fileIssues > 0 ? "Open requirements and request replacement files." : "Ready for payroll review.";
        } else if (dtr?.status === "Pending Review") {
          readiness = fileIssues > 0 ? "Needs Action" : "Pending Review";
          nextAction = fileIssues > 0 ? "Review DTR and replacement file issue." : "Wait for admin or supervisor review.";
        } else if (dtr?.status === "Rejected") {
          readiness = "Needs Action";
          nextAction = "Guard must review remarks and reupload corrected DTR.";
        }

        return {
          branch: employee.branch || "No branch",
          cutoff: activeCutoff,
          dtr,
          employee,
          fileIssues,
          location: employee.location || "Unassigned",
          nextAction,
          readiness,
        };
      })
      .sort((left, right) => {
        const rank = { "Needs Action": 0, Missing: 1, "Pending Review": 2, Submitted: 3 };
        const rankDifference = (rank[left.readiness] ?? 9) - (rank[right.readiness] ?? 9);
        if (rankDifference !== 0) return rankDifference;
        return (left.employee.full_name || "").localeCompare(right.employee.full_name || "");
      });
  }, [activeCutoff, profiles, requirementRows, rows]);

  const readinessSummary = useMemo(() => {
    return readinessRows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.dtr) acc.submitted += 1;
        if (row.readiness === "Pending Review") acc.pending += 1;
        if (row.readiness === "Missing") acc.missing += 1;
        if (row.readiness === "Needs Action") acc.needsAction += 1;
        return acc;
      },
      { total: 0, submitted: 0, pending: 0, missing: 0, needsAction: 0 }
    );
  }, [readinessRows]);

  function exportDtrCsv() {
    const headers = [
      "Guard",
      "Employee ID",
      "Location",
      "Branch",
      "Cutoff",
      "Status",
      "Submitted At",
      "Approved At",
      "Submitted By",
      "Admin Remarks",
    ];
    const csvRows = rows.map((row) => [
      row.profiles?.full_name,
      row.profiles?.employee_id,
      row.profiles?.location,
      row.profiles?.branch,
      row.cutoff,
      row.status,
      row.created_at,
      row.approved_at,
      row.submitted_by_role || "employee",
      row.admin_remarks,
    ]);
    const csv = [headers, ...csvRows].map((line) => line.map(csvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dtr-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportCutoffReadinessCsv() {
    const headers = [
      "Guard",
      "Employee ID",
      "Location",
      "Branch",
      "Cutoff",
      "Readiness",
      "DTR Status",
      "Submitted At",
      "File Issues",
      "Next Action",
    ];
    const csvRows = readinessRows.map((row) => [
      row.employee.full_name,
      row.employee.employee_id,
      row.location,
      row.branch,
      row.cutoff,
      row.readiness,
      row.dtr?.status || "Missing",
      row.dtr?.created_at || "",
      row.fileIssues,
      row.nextAction,
    ]);
    const csv = [headers, ...csvRows].map((line) => line.map(csvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cutoff-readiness-${activeCutoff.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p className="admin-loading-copy">Loading report analytics...</p>;
  }

  return (
    <div className="admin-page admin-reports-page">
      <Card>
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title admin-reports-page__section-title">Report Exports</h2>
            <p className="admin-section-copy">Download the live DTR dataset for payroll review, audit checks, or spreadsheet cleanup.</p>
          </div>
          <div className="admin-reports-page__export-actions">
            <Button variant="secondary" onClick={exportCutoffReadinessCsv} disabled={readinessRows.length === 0}>
              Export Cutoff Readiness
            </Button>
            <Button variant="secondary" onClick={exportDtrCsv} disabled={rows.length === 0}>
              Export DTR CSV
            </Button>
          </div>
        </div>
      </Card>

      <div className="admin-metrics-grid admin-metrics-grid--reports">
        <MetricCard label="Total Submissions" value={metrics.total} />
        <MetricCard label="Approved" value={metrics.approved} tone="emerald" />
        <MetricCard label="Pending Review" value={metrics.pending} tone="amber" />
        <MetricCard label="Approval Rate" value={`${metrics.approvalRate}%`} tone="brand" />
      </div>

      <div className="admin-sections-grid admin-sections-grid--analytics">
        <Card>
          <h3 className="admin-section-title admin-reports-page__section-title">Status Distribution</h3>
          <div className="admin-stack-sm">
            {byStatus.map((item) => {
              const ratio = metrics.total ? Math.round((item.value / metrics.total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="admin-stat-row">
                    <span className="admin-stat-label">{item.label}</span>
                    <span className="admin-stat-value">
                      {item.value} ({ratio}%)
                    </span>
                  </div>
                  <div className="admin-stat-track">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${ratio}%` }}
                      transition={{ duration: 0.5 }}
                      className={`admin-stat-fill admin-reports-page__bar--${statusColors[item.label] || "default"}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="admin-section-title admin-reports-page__section-title">Top Locations</h3>
          <div className="admin-stack-sm">
            {byLocation.map((item, idx) => {
              const ratio = byLocation[0]?.value ? Math.round((item.value / byLocation[0].value) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="admin-stat-row">
                    <span className="admin-stat-label">
                      {idx + 1}. {item.label}
                    </span>
                    <span className="admin-stat-value">{item.value}</span>
                  </div>
                  <div className="admin-stat-track">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${ratio}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.05 }}
                      className="admin-stat-fill admin-reports-page__bar--brand"
                    />
                  </div>
                </div>
              );
            })}
            {byLocation.length === 0 ? <p className="admin-empty-copy admin-reports-page__empty">No location data yet.</p> : null}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="admin-section-title admin-reports-page__section-title">Last 7 Days Submission Trend</h3>
        <div className="admin-reports-page__trend-grid">
          {dailyTrend.map((point) => (
            <div key={point.date} className="admin-reports-page__trend-day">
              <div className="admin-reports-page__trend-frame">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max((point.value / maxDaily) * 100, point.value ? 8 : 0)}%` }}
                  transition={{ duration: 0.45 }}
                  className="admin-reports-page__trend-bar"
                />
              </div>
              <span className="admin-reports-page__trend-date">{point.date.slice(5)}</span>
              <span className="admin-reports-page__trend-value">{point.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="admin-section-head">
          <div>
            <h3 className="admin-section-title admin-reports-page__section-title">Cutoff Readiness</h3>
            <p className="admin-section-copy admin-reports-page__summary-copy">
              Active cutoff: {activeCutoff}. Submitted means ready or in review; Needs Action means rejected DTR or files to fix.
            </p>
          </div>
        </div>
        <div className="admin-reports-page__readiness-grid">
          <MetricCard label="Roster" value={readinessSummary.total} />
          <MetricCard label="Submitted" value={readinessSummary.submitted} tone="emerald" />
          <MetricCard label="Pending Review" value={readinessSummary.pending} tone="amber" />
          <MetricCard label="Missing" value={readinessSummary.missing} tone="rose" />
          <MetricCard label="Needs Action" value={readinessSummary.needsAction} tone="rose" />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr className="admin-table-head-row admin-table-head-row--sm">
                <th className="admin-table-head-cell">Guard</th>
                <th className="admin-table-head-cell">Assignment</th>
                <th className="admin-table-head-cell">Readiness</th>
                <th className="admin-table-head-cell">DTR Status</th>
                <th className="admin-table-head-cell">Next Action</th>
              </tr>
            </thead>
            <tbody>
              {readinessRows.slice(0, 12).map((row) => (
                <tr key={row.employee.id} className="admin-table-row">
                  <td className="admin-table-cell">
                    <p className="admin-text-strong">{row.employee.full_name || "Unnamed Employee"}</p>
                    <p className="admin-copy-xs-muted">{row.employee.employee_id || "No employee ID"}</p>
                  </td>
                  <td className="admin-table-cell">{row.location} / {row.branch}</td>
                  <td className="admin-table-cell">{row.readiness}</td>
                  <td className="admin-table-cell">{row.dtr?.status || "Missing"}</td>
                  <td className="admin-table-cell">{row.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {readinessRows.length === 0 ? <p className="admin-empty-copy admin-reports-page__empty">No employee roster data available yet.</p> : null}
      </Card>

      <Card>
        <h3 className="admin-section-title admin-reports-page__section-title">Cutoff Summary</h3>
        <p className="admin-section-copy admin-reports-page__summary-copy">
          Use this as a quick review of DTR progress before exporting the full CSV.
        </p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr className="admin-table-head-row admin-table-head-row--sm">
                <th className="admin-table-head-cell">Cutoff</th>
                <th className="admin-table-head-cell">Locations</th>
                <th className="admin-table-head-cell">Total</th>
                <th className="admin-table-head-cell">Approved</th>
                <th className="admin-table-head-cell">Pending</th>
                <th className="admin-table-head-cell">Rejected</th>
                <th className="admin-table-head-cell">Latest Approval</th>
              </tr>
            </thead>
            <tbody>
              {cutoffSummary.map((item) => (
                <tr key={item.cutoff} className="admin-table-row">
                  <td className="admin-table-cell">{item.cutoff}</td>
                  <td className="admin-table-cell">{item.locations}</td>
                  <td className="admin-table-cell">{item.total}</td>
                  <td className="admin-table-cell">{item.approved}</td>
                  <td className="admin-table-cell">{item.pending}</td>
                  <td className="admin-table-cell">{item.rejected}</td>
                  <td className="admin-table-cell">
                    {item.latestApprovedAt ? new Date(item.latestApprovedAt).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cutoffSummary.length === 0 ? <p className="admin-empty-copy admin-reports-page__empty">No cutoff summary available yet.</p> : null}
      </Card>
    </div>
  );
}

function MetricCard({ label, value, tone = "slate" }) {
  return (
    <Card>
      <p className="admin-metric-label">{label}</p>
      <p className={`admin-metric-value admin-metric-value--md admin-reports-page__metric-value--${tone}`}>{value}</p>
    </Card>
  );
}
