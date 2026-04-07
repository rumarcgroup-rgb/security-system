import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, FileText, Users } from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import { sortBranches } from "../../lib/branches";
import { isEmployeeOnline } from "../../lib/presence";
import { supabase } from "../../lib/supabase";
import { getSupervisorScopeLabel, isScopedEmployee, matchesSupervisorScope } from "../../lib/supervisorScope";
import "../admin/AdminDashboardHome.css";

const metricCards = [
  { key: "teamMembers", label: "Team Members", icon: Users, tone: "brand" },
  { key: "pendingDtr", label: "Pending DTR", icon: Clock3, tone: "amber" },
  { key: "pendingRequirements", label: "Pending Requirements", icon: FileText, tone: "rose" },
  { key: "onlineEmployees", label: "Online Now", icon: Activity, tone: "emerald-dark" },
  { key: "approvedToday", label: "Approved Today", icon: CheckCircle2, tone: "emerald" },
];

export default function SupervisorDashboardHome({ profile }) {
  const [dtrRows, setDtrRows] = useState([]);
  const [requirementRows, setRequirementRows] = useState([]);
  const [teamProfiles, setTeamProfiles] = useState([]);
  const [highlightedDtrId, setHighlightedDtrId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    const dtrChannel = supabase
      .channel("supervisor-dashboard-dtr")
      .on("postgres_changes", { event: "*", schema: "public", table: "dtr_submissions" }, handleDtrChange)
      .subscribe();

    const documentsChannel = supabase
      .channel("supervisor-dashboard-documents")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_documents" }, handleRequirementChange)
      .subscribe();

    const profilesChannel = supabase
      .channel("supervisor-dashboard-profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadData)
      .subscribe();

    const presenceChannel = supabase
      .channel("supervisor-dashboard-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_presence" }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(dtrChannel);
      supabase.removeChannel(documentsChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [profile?.location, profile?.branch]);

  function upsertScopedDtrRow(nextRow) {
    setDtrRows((current) =>
      [nextRow, ...current.filter((row) => row.id !== nextRow.id)].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )
    );
  }

  function upsertScopedRequirementRow(nextRow) {
    setRequirementRows((current) =>
      [nextRow, ...current.filter((row) => row.id !== nextRow.id)].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )
    );
  }

  function flashNewDtr(id) {
    setHighlightedDtrId(id);
    window.setTimeout(() => {
      setHighlightedDtrId((current) => (current === id ? null : current));
    }, 2200);
  }

  async function handleDtrChange(payload) {
    if (payload.eventType === "DELETE") {
      setDtrRows((current) => current.filter((row) => row.id !== payload.old.id));
      return;
    }

    const { data, error } = await supabase
      .from("dtr_submissions")
      .select("id,status,cutoff,created_at,approved_at,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,employee_id,location,branch)")
      .eq("id", payload.new.id)
      .maybeSingle();

    if (error || !data) {
      loadData();
      return;
    }

    if (!matchesSupervisorScope(data, profile)) {
      setDtrRows((current) => current.filter((row) => row.id !== data.id));
      return;
    }

    upsertScopedDtrRow(data);

    if (payload.eventType === "INSERT") {
      flashNewDtr(data.id);
      toast.success("New DTR received.");
    }
  }

  async function handleRequirementChange(payload) {
    if (payload.eventType === "DELETE") {
      setRequirementRows((current) => current.filter((row) => row.id !== payload.old.id));
      return;
    }

    const { data, error } = await supabase
      .from("employee_documents")
      .select("id,document_type,review_status,created_at,profiles:profiles!employee_documents_user_id_profile_fkey(full_name,employee_id,location,branch)")
      .eq("id", payload.new.id)
      .maybeSingle();

    if (error || !data) {
      loadData();
      return;
    }

    if (!matchesSupervisorScope(data, profile)) {
      setRequirementRows((current) => current.filter((row) => row.id !== data.id));
      return;
    }

    upsertScopedRequirementRow(data);

    if (payload.eventType === "INSERT") {
      toast("New requirement received.", {
        duration: 2200,
        icon: "📄",
        style: {
          border: "1px solid #dcfce7",
          background: "#f0fdf4",
          color: "#166534",
        },
      });
    }
  }

  async function loadData() {
    setLoading(true);

    const [dtrRes, documentsRes, profilesRes, presenceRes] = await Promise.all([
      supabase
        .from("dtr_submissions")
        .select("id,status,cutoff,created_at,approved_at,profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name,employee_id,location,branch)")
        .order("created_at", { ascending: false }),
      supabase
        .from("employee_documents")
        .select("id,document_type,review_status,created_at,profiles:profiles!employee_documents_user_id_profile_fkey(full_name,employee_id,location,branch)")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id,role,full_name,employee_id,position,location,branch,created_at")
        .order("created_at", { ascending: false }),
      supabase.from("employee_presence").select("user_id,last_seen_at"),
    ]);

    if (!dtrRes.error) {
      setDtrRows((dtrRes.data ?? []).filter((row) => matchesSupervisorScope(row, profile)));
    }

    if (!documentsRes.error) {
      setRequirementRows((documentsRes.data ?? []).filter((row) => matchesSupervisorScope(row, profile)));
    }

    if (!profilesRes.error && !presenceRes.error) {
      const presenceMap = new Map((presenceRes.data ?? []).map((row) => [row.user_id, row.last_seen_at]));
      setTeamProfiles(
        (profilesRes.data ?? [])
          .filter((item) => isScopedEmployee(item, profile))
          .map((item) => ({
            ...item,
            last_seen_at: presenceMap.get(item.id) ?? null,
          }))
      );
    }

    setLoading(false);
  }

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return {
      teamMembers: teamProfiles.length,
      pendingDtr: dtrRows.filter((row) => row.status === "Pending Review").length,
      pendingRequirements: requirementRows.filter((row) => row.review_status === "Pending Review").length,
      onlineEmployees: teamProfiles.filter((item) => isEmployeeOnline(item.last_seen_at)).length,
      approvedToday: dtrRows.filter(
        (row) => row.status === "Approved" && row.approved_at && new Date(row.approved_at).toISOString().slice(0, 10) === today
      ).length,
    };
  }, [dtrRows, requirementRows, teamProfiles]);

  const branchSummary = useMemo(() => {
    const grouped = dtrRows.reduce((acc, row) => {
      if (row.status !== "Pending Review") return acc;
      const key = row.profiles?.branch || "Unassigned";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return sortBranches(Object.keys(grouped)).map((branch) => ({ branch, count: grouped[branch] })).slice(0, 5);
  }, [dtrRows]);

  if (!profile?.location) {
    return <p className="admin-empty-copy">This supervisor account needs an assigned area before the dashboard can load team data.</p>;
  }

  if (loading) {
    return <p className="admin-loading-copy">Loading supervisor dashboard...</p>;
  }

  return (
    <div className="admin-page admin-dashboard-home supervisor-dashboard-home">
      <Card>
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title admin-dashboard-home__section-title">Supervisor Scope</h2>
            <p className="admin-section-copy">You are currently managing {getSupervisorScopeLabel(profile)}.</p>
          </div>
        </div>
        <div className="admin-dashboard-home__quick-actions">
          <Link to="/supervisor/dtr" className="admin-dashboard-home__quick-action">
            <p className="admin-dashboard-home__quick-action-title">Review Team DTR</p>
            <p className="app-copy-sm">Approve or reject daily submissions from your assigned team.</p>
          </Link>
          <Link to="/supervisor/team" className="admin-dashboard-home__quick-action">
            <p className="admin-dashboard-home__quick-action-title">Open Team Directory</p>
            <p className="app-copy-sm">See presence, assignment, and branch details for your people.</p>
          </Link>
        </div>
      </Card>

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
              <h2 className="admin-section-title admin-dashboard-home__section-title">Recent Team DTR Activity</h2>
              <p className="admin-section-copy">Latest submissions inside your scope</p>
            </div>
            <Link className="admin-link" to="/supervisor/dtr">
              Open DTR Queue
            </Link>
          </div>
          <div className="admin-dashboard-home__activity-list">
            {dtrRows.slice(0, 6).map((row) => (
              <div
                key={row.id}
                className={`admin-list-card admin-dashboard-home__activity-item${
                  highlightedDtrId === row.id ? " admin-dashboard-home__activity-item--new" : ""
                }`}
              >
                <div>
                  <p className="admin-dashboard-home__activity-name">{row.profiles?.full_name || "Unknown Employee"}</p>
                  <p className="app-copy-sm">{row.profiles?.employee_id || "No Employee ID"} | {row.cutoff || "No cutoff"}</p>
                  <p className="app-copy-xs-muted">{row.profiles?.branch || profile.location}</p>
                  <p className="app-copy-xs-muted">{new Date(row.created_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
            ))}
            {dtrRows.length === 0 ? <p className="admin-empty-copy">No team DTR activity yet.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="admin-section-title admin-dashboard-home__section-title">Pending DTR by Branch</h2>
          <p className="admin-section-copy app-copy-sm app-copy-xs-spaced admin-dashboard-home__distribution-copy">
            Quick look at where your backlog is building.
          </p>
          <div className="admin-dashboard-home__distribution-grid">
            {branchSummary.map((item, index) => (
              <div key={item.branch} className="admin-dashboard-home__distribution-item">
                <div className="admin-dashboard-home__distribution-row">
                  <span className="admin-dashboard-home__distribution-label">{index + 1}. {item.branch}</span>
                  <span className="admin-dashboard-home__distribution-count">{item.count}</span>
                </div>
                <div className="admin-dashboard-home__distribution-bar">
                  <div
                    className="admin-dashboard-home__distribution-fill admin-dashboard-home__distribution-fill--branch"
                    style={{ width: `${Math.max((item.count / branchSummary[0].count) * 100, 8)}%` }}
                  />
                </div>
              </div>
            ))}
            {branchSummary.length === 0 ? <p className="admin-empty-copy">No pending branch backlog right now.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
