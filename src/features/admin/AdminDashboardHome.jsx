import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, FileText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import { sortAreas } from "../../lib/areas";
import { supabase } from "../../lib/supabase";
import { isEmployeeOnline } from "../../lib/presence";
import "./AdminDashboardHome.css";

const metricCards = [
  { key: "pendingDtr", label: "Pending DTR", icon: Clock3, tone: "amber" },
  { key: "pendingRequirements", label: "Pending Requirements", icon: FileText, tone: "rose" },
  { key: "approvedToday", label: "Approved Today", icon: CheckCircle2, tone: "emerald" },
  { key: "activeEmployees", label: "Active Employees", icon: Users, tone: "brand" },
  { key: "onlineEmployees", label: "Online Now", icon: Activity, tone: "emerald-dark" },
  { key: "totalEmployeeSubmissions", label: "Total Employee Submissions", icon: Activity, tone: "slate" },
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

    return sortAreas(Object.keys(grouped))
      .map((location) => ({ location, count: grouped[location] }))
      .slice(0, 5);
  }, [profiles]);

  if (loading) {
    return <p className="admin-loading-copy">Loading dashboard metrics...</p>;
  }

  return (
    <div className="admin-page admin-dashboard-home">
      <div className="admin-metrics-grid admin-metrics-grid--dashboard">
        {metricCards.map(({ key, label, icon: Icon, tone }) => (
          <Card key={key}>
            <div className="admin-metric-card">
              <div>
                <p className="admin-metric-label">{label}</p>
                <p className={`admin-metric-value admin-metric-value--lg admin-dashboard-home__metric-value--${tone}`}>
                  {metrics[key]}
                </p>
              </div>
              <div className={`admin-dashboard-home__metric-icon-box admin-dashboard-home__metric-icon-box--${tone}`}>
                <Icon className={`admin-dashboard-home__metric-icon--${tone}`} size={20} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="admin-sections-grid admin-sections-grid--analytics">
        <Card>
          <div className="admin-section-head">
            <div>
              <h2 className="admin-section-title admin-dashboard-home__section-title">Recent DTR Activity</h2>
              <p className="admin-section-copy">Last {recentDtrRows.length} submissions</p>
            </div>
            <Link className="admin-link" to="/admin/dtr-submissions">
              Review Queue
            </Link>
          </div>
          <div className="admin-dashboard-home__activity-list">
            {recentDtrRows.map((row) => (
              <div key={row.id} className="admin-list-card admin-dashboard-home__activity-item">
                <div>
                  <p className="admin-dashboard-home__activity-name">{row.profiles?.full_name || "Unknown Employee"}</p>
                  <p className="app-copy-sm">
                    {row.profiles?.employee_id || "No Employee ID"} | {row.cutoff}
                  </p>
                  <p className="app-copy-xs-muted">{new Date(row.created_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
            ))}
            {recentDtrRows.length === 0 ? <p className="admin-empty-copy">No DTR activity yet.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="admin-section-head">
            <div>
              <h2 className="admin-section-title admin-dashboard-home__section-title">Recent Requirement Activity</h2>
              <p className="admin-section-copy">Employee documents and signatures</p>
            </div>
          </div>
          <div className="admin-dashboard-home__activity-list">
            {recentRequirementRows.map((row) => (
              <div key={row.id} className="admin-list-card admin-dashboard-home__activity-item">
                <div>
                  <p className="admin-dashboard-home__activity-name">{row.profiles?.full_name || "Unknown Employee"}</p>
                  <p className="app-copy-sm">
                    {row.profiles?.employee_id || "No Employee ID"} | {getRequirementTypeLabel(row)}
                  </p>
                  <p className="app-copy-xs-muted">{new Date(row.created_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
            ))}
            {recentRequirementRows.length === 0 ? <p className="admin-empty-copy">No employee requirement activity yet.</p> : null}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="admin-section-title admin-dashboard-home__section-title">Employee Distribution</h2>
        <p className="admin-section-copy app-copy-sm app-copy-xs-spaced admin-dashboard-home__distribution-copy">
          Top assigned locations based on onboarding records.
        </p>
        <div className="admin-content-grid admin-content-grid--distribution admin-dashboard-home__distribution-grid">
          {locationSummary.map((item, index) => (
            <div key={item.location} className="admin-dashboard-home__distribution-item">
              <div className="admin-dashboard-home__distribution-row">
                <span className="admin-dashboard-home__distribution-label">
                  {index + 1}. {item.location}
                </span>
                <span className="admin-dashboard-home__distribution-count">{item.count}</span>
              </div>
              <div className="admin-dashboard-home__distribution-bar">
                <div
                  className="admin-dashboard-home__distribution-fill"
                  style={{ width: `${Math.max((item.count / locationSummary[0].count) * 100, 8)}%` }}
                />
              </div>
            </div>
          ))}
          {locationSummary.length === 0 ? <p className="admin-empty-copy">No employee location data available yet.</p> : null}
        </div>
      </Card>
    </div>
  );
}
