import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Card from "../../components/ui/Card";
import { supabase } from "../../lib/supabase";

const statusColors = {
  Approved: "bg-emerald-500",
  "Pending Review": "bg-amber-500",
  Rejected: "bg-rose-500",
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
      .select("status,created_at,profiles:profiles!dtr_submissions_user_id_fkey(location)")
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
    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
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
    return <p className="text-sm text-slate-500">Loading report analytics...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Submissions" value={metrics.total} />
        <MetricCard label="Approved" value={metrics.approved} tone="text-emerald-600" />
        <MetricCard label="Pending Review" value={metrics.pending} tone="text-amber-600" />
        <MetricCard label="Approval Rate" value={`${metrics.approvalRate}%`} tone="text-brand-600" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-base font-semibold text-slate-800">Status Distribution</h3>
          <div className="space-y-3">
            {byStatus.map((item) => {
              const ratio = metrics.total ? Math.round((item.value / metrics.total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-700">{item.label}</span>
                    <span className="font-semibold text-slate-800">
                      {item.value} ({ratio}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${ratio}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-2 rounded-full ${statusColors[item.label] || "bg-slate-500"}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-semibold text-slate-800">Top Locations</h3>
          <div className="space-y-3">
            {byLocation.map((item, idx) => {
              const ratio = byLocation[0]?.value ? Math.round((item.value / byLocation[0].value) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-700">
                      {idx + 1}. {item.label}
                    </span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${ratio}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.05 }}
                      className="h-2 rounded-full bg-brand-500"
                    />
                  </div>
                </div>
              );
            })}
            {byLocation.length === 0 ? <p className="text-sm text-slate-500">No location data yet.</p> : null}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="mb-4 text-base font-semibold text-slate-800">Last 7 Days Submission Trend</h3>
        <div className="grid grid-cols-7 gap-3">
          {dailyTrend.map((point) => (
            <div key={point.date} className="flex flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end rounded-lg bg-slate-50 p-2">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max((point.value / maxDaily) * 100, point.value ? 8 : 0)}%` }}
                  transition={{ duration: 0.45 }}
                  className="w-full rounded-md bg-brand-500"
                />
              </div>
              <span className="text-[11px] text-slate-500">{point.date.slice(5)}</span>
              <span className="text-xs font-semibold text-slate-700">{point.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, tone = "text-slate-800" }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
    </Card>
  );
}
