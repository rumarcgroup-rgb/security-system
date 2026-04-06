import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Card from "../../components/ui/Card";
import { sortAreas } from "../../lib/areas";
import { supabase } from "../../lib/supabase";
import "./AdminReportsPage.css";

const statusColors = {
  Approved: "approved",
  "Pending Review": "pending",
  Rejected: "rejected",
};

export default function AdminReportsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("admin-reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "dtr_submissions" }, loadData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("dtr_submissions")
      .select("status,created_at,profiles:profiles!dtr_submissions_user_id_profile_fkey(location)")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  }

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

  if (loading) {
    return <p className="admin-loading-copy">Loading report analytics...</p>;
  }

  return (
    <div className="admin-page admin-reports-page">
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
