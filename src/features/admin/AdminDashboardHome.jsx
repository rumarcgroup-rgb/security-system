import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, Users } from "lucide-react";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import { supabase } from "../../lib/supabase";

const metricCards = [
  { key: "pending", label: "Pending DTR", icon: Clock3, tone: "text-amber-600", bg: "bg-amber-50" },
  { key: "approvedToday", label: "Approved Today", icon: CheckCircle2, tone: "text-emerald-600", bg: "bg-emerald-50" },
  { key: "activeEmployees", label: "Active Employees", icon: Users, tone: "text-brand-600", bg: "bg-brand-50" },
  { key: "totalSubmissions", label: "Total Submissions", icon: Activity, tone: "text-slate-800", bg: "bg-slate-100" },
];

export default function AdminDashboardHome() {
  const [recentRows, setRecentRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    const submissionsChannel = supabase
      .channel("admin-dashboard-dtr")
      .on("postgres_changes", { event: "*", schema: "public", table: "dtr_submissions" }, loadData)
      .subscribe();

    const profilesChannel = supabase
      .channel("admin-dashboard-profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(submissionsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, []);

  async function loadData() {
    setLoading(true);

    const [recentRes, totalsRes, profilesRes] = await Promise.all([
      supabase
        .from("dtr_submissions")
        .select("id,status,created_at,cutoff,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,employee_id,location)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("dtr_submissions").select("id,status,created_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,role,full_name,location").order("created_at", { ascending: false }),
    ]);

    if (!recentRes.error) {
      setRecentRows(recentRes.data ?? []);
    }

    if (!totalsRes.error) {
      setAllRows(totalsRes.data ?? []);
    }

    if (!profilesRes.error) {
      setProfiles(profilesRes.data ?? []);
    }

    setLoading(false);
  }

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const activeEmployees = profiles.filter((profile) => profile.role !== "admin").length;
    const pending = allRows.filter((row) => row.status === "Pending Review").length;
    const approvedToday = allRows.filter(
      (row) => row.status === "Approved" && new Date(row.created_at).toISOString().slice(0, 10) === today
    ).length;

    return {
      pending,
      approvedToday,
      activeEmployees,
      totalSubmissions: allRows.length,
    };
  }, [allRows, profiles]);

  const locationSummary = useMemo(() => {
    const grouped = profiles.reduce((acc, profile) => {
      if (profile.role === "admin") return acc;
      const key = profile.location || "Unassigned";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [profiles]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading dashboard metrics...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ key, label, icon: Icon, tone, bg }) => (
          <Card key={key}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className={`mt-1 text-3xl font-bold ${tone}`}>{metrics[key]}</p>
              </div>
              <div className={`rounded-2xl p-3 ${bg}`}>
                <Icon className={tone} size={20} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr,1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Recent DTR Activity</h2>
            <p className="text-xs text-slate-500">Last {recentRows.length} submissions</p>
          </div>
          <div className="space-y-3">
            {recentRows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-800">{row.profiles?.full_name || "Unknown Employee"}</p>
                  <p className="text-sm text-slate-500">
                    {row.profiles?.employee_id || "No Employee ID"} | {row.cutoff}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(row.created_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
            ))}
            {recentRows.length === 0 ? <p className="text-sm text-slate-500">No DTR activity yet.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800">Employee Distribution</h2>
          <p className="mt-1 text-sm text-slate-500">Top assigned locations based on onboarding records.</p>
          <div className="mt-4 space-y-3">
            {locationSummary.map((item, index) => (
              <div key={item.location}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {index + 1}. {item.location}
                  </span>
                  <span className="font-semibold text-slate-800">{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-brand-500"
                    style={{ width: `${Math.max((item.count / locationSummary[0].count) * 100, 8)}%` }}
                  />
                </div>
              </div>
            ))}
            {locationSummary.length === 0 ? (
              <p className="text-sm text-slate-500">No employee location data available yet.</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
