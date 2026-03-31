import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, FileText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import { supabase } from "../../lib/supabase";
import { isEmployeeOnline } from "../../lib/presence";

const metricCards = [
  { key: "pendingDtr", label: "Pending DTR", icon: Clock3, tone: "text-amber-600", bg: "bg-amber-50" },
  { key: "pendingRequirements", label: "Pending Requirements", icon: FileText, tone: "text-rose-600", bg: "bg-rose-50" },
  { key: "approvedToday", label: "Approved Today", icon: CheckCircle2, tone: "text-emerald-600", bg: "bg-emerald-50" },
  { key: "activeEmployees", label: "Active Employees", icon: Users, tone: "text-brand-600", bg: "bg-brand-50" },
  { key: "onlineEmployees", label: "Online Now", icon: Activity, tone: "text-emerald-700", bg: "bg-emerald-50" },
  { key: "totalEmployeeSubmissions", label: "Total Employee Submissions", icon: Activity, tone: "text-slate-800", bg: "bg-slate-100" },
];

function getRequirementTypeLabel(row) {
  return row.requirement_type === "Signature" ? "Signature" : row.document_type || "Requirement";
}

export default function AdminDashboardHome() {
  const [recentDtrRows, setRecentDtrRows] = useState([]);
  const [allDtrRows, setAllDtrRows] = useState([]);
  const [recentRequirementRows, setRecentRequirementRows] = useState([]);
  const [allRequirementRows, setAllRequirementRows] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    const dtrChannel = supabase
      .channel("admin-dashboard-dtr")
      .on("postgres_changes", { event: "*", schema: "public", table: "dtr_submissions" }, loadData)
      .subscribe();

    const documentsChannel = supabase
      .channel("admin-dashboard-documents")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_documents" }, loadData)
      .subscribe();

    const profilesChannel = supabase
      .channel("admin-dashboard-profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadData)
      .subscribe();

    const presenceChannel = supabase
      .channel("admin-dashboard-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_presence" }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(dtrChannel);
      supabase.removeChannel(documentsChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  async function loadData() {
    setLoading(true);

    const [recentDtrRes, allDtrRes, documentsRes, profilesRes, presenceRes] = await Promise.all([
      supabase
        .from("dtr_submissions")
        .select("id,status,created_at,cutoff,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,employee_id,location)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("dtr_submissions").select("id,status,created_at").order("created_at", { ascending: false }),
      supabase
        .from("employee_documents")
        .select(
          "id,document_type,review_status,created_at,profiles:profiles!employee_documents_user_id_fkey(full_name,employee_id,location)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id,role,full_name,location,employee_id,created_at,signature_url,signature_status")
        .order("created_at", { ascending: false }),
      supabase.from("employee_presence").select("user_id,last_seen_at"),
    ]);

    if (!recentDtrRes.error) {
      setRecentDtrRows(recentDtrRes.data ?? []);
    }

    if (!allDtrRes.error) {
      setAllDtrRows(allDtrRes.data ?? []);
    }

    if (!profilesRes.error && !presenceRes.error) {
      const presenceMap = new Map((presenceRes.data ?? []).map((row) => [row.user_id, row.last_seen_at]));
      setProfiles(
        (profilesRes.data ?? []).map((profile) => ({
          ...profile,
          last_seen_at: presenceMap.get(profile.id) ?? null,
        }))
      );
    }

    if (!documentsRes.error && !profilesRes.error) {
      const documentRows = (documentsRes.data ?? []).map((row) => ({
        ...row,
        requirement_type: row.document_type,
        status: row.review_status || "Pending Review",
        source: "employee_documents",
      }));

      const signatureRows = (profilesRes.data ?? [])
        .filter((profile) => profile.signature_url)
        .map((profile) => ({
          id: `signature-${profile.id}`,
          document_type: "Signature",
          requirement_type: "Signature",
          created_at: profile.created_at,
          status: profile.signature_status || "Pending Review",
          profiles: {
            full_name: profile.full_name,
            employee_id: profile.employee_id,
            location: profile.location,
          },
          source: "profiles",
        }));

      const combinedRequirements = [...documentRows, ...signatureRows].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      setAllRequirementRows(combinedRequirements);
      setRecentRequirementRows(combinedRequirements.slice(0, 8));
    }

    setLoading(false);
  }

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const activeEmployees = profiles.filter((profile) => profile.role !== "admin").length;
    const onlineEmployees = profiles.filter((profile) => profile.role !== "admin" && isEmployeeOnline(profile.last_seen_at)).length;
    const pendingDtr = allDtrRows.filter((row) => row.status === "Pending Review").length;
    const approvedToday = allDtrRows.filter(
      (row) => row.status === "Approved" && new Date(row.created_at).toISOString().slice(0, 10) === today
    ).length;
    const pendingRequirements = allRequirementRows.filter((row) => row.status === "Pending Review").length;

    return {
      pendingDtr,
      pendingRequirements,
      approvedToday,
      activeEmployees,
      onlineEmployees,
      totalEmployeeSubmissions: allDtrRows.length + allRequirementRows.length,
    };
  }, [allDtrRows, allRequirementRows, profiles]);

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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Recent DTR Activity</h2>
              <p className="text-xs text-slate-500">Last {recentDtrRows.length} submissions</p>
            </div>
            <Link className="text-sm font-medium text-brand-600 hover:underline" to="/admin/dtr-submissions">
              Review Queue
            </Link>
          </div>
          <div className="space-y-3">
            {recentDtrRows.map((row) => (
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
            {recentDtrRows.length === 0 ? <p className="text-sm text-slate-500">No DTR activity yet.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Recent Requirement Activity</h2>
            <p className="text-xs text-slate-500">Employee documents and signatures</p>
          </div>
          <div className="space-y-3">
            {recentRequirementRows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-800">{row.profiles?.full_name || "Unknown Employee"}</p>
                  <p className="text-sm text-slate-500">
                    {row.profiles?.employee_id || "No Employee ID"} | {getRequirementTypeLabel(row)}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(row.created_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
            ))}
            {recentRequirementRows.length === 0 ? (
              <p className="text-sm text-slate-500">No employee requirement activity yet.</p>
            ) : null}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-800">Employee Distribution</h2>
        <p className="mt-1 text-sm text-slate-500">Top assigned locations based on onboarding records.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
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
  );
}
