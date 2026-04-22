import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, FileText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import { sortBranches } from "../../lib/branches";
import { isEmployeeOnline } from "../../lib/presence";
import { getSupervisorScopeLabel } from "../../lib/supervisorScope";
import PresenceBadge from "../admin/users/PresenceBadge";
import { useLiveDtrStore } from "../realtime/useLiveDtrStore";
import { useLiveRequirementsStore } from "../realtime/useLiveRequirementsStore";
import { useLivePeopleStore } from "../realtime/useLivePeopleStore";
import "../admin/AdminDashboardHome.css";

const metricCards = [
  { key: "teamMembers", label: "Team Members", icon: Users, tone: "brand" },
  { key: "pendingDtr", label: "Pending DTR", icon: Clock3, tone: "amber" },
  { key: "pendingRequirements", label: "Pending Requirements", icon: FileText, tone: "rose" },
  { key: "onlineEmployees", label: "Online Now", icon: Activity, tone: "emerald-dark" },
  { key: "approvedToday", label: "Approved Today", icon: CheckCircle2, tone: "emerald" },
];

const actionFilters = [
  { value: "all", label: "All Actions" },
  { value: "direct", label: "My Direct Guards" },
  { value: "missing", label: "Missing DTR" },
  { value: "pending", label: "Pending Review" },
  { value: "follow-up", label: "Needs Follow-up" },
];

const actionRank = {
  "follow-up": 0,
  missing: 1,
  pending: 2,
  watch: 3,
  clear: 4,
};

export default function SupervisorDashboardHome({ profile }) {
  const [highlightedDtrId, setHighlightedDtrId] = useState(null);
  const [actionFilter, setActionFilter] = useState("all");
  const { rows: dtrRows, loading: dtrLoading, lastEvent: lastDtrEvent } = useLiveDtrStore({
    currentRole: "supervisor",
    currentUserId: profile?.id,
    scopeProfile: profile,
  });
  const { rows: requirementRows, loading: requirementsLoading } = useLiveRequirementsStore({
    currentRole: "supervisor",
    currentUserId: profile?.id,
    scopeProfile: profile,
  });
  const { profiles: teamProfiles, loading: peopleLoading } = useLivePeopleStore({
    currentRole: "supervisor",
    currentUserId: profile?.id,
    scopeProfile: profile,
  });

  useEffect(() => {
    if (lastDtrEvent?.eventType !== "INSERT" || !lastDtrEvent.row?.id) {
      return;
    }

    setHighlightedDtrId(lastDtrEvent.row.id);
    window.setTimeout(() => {
      setHighlightedDtrId((current) => (current === lastDtrEvent.row.id ? null : current));
    }, 2200);
  }, [lastDtrEvent]);

  const loading = dtrLoading || requirementsLoading || peopleLoading;

  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return {
      teamMembers: teamProfiles.length,
      pendingDtr: dtrRows.filter((row) => row.status === "Pending Review").length,
      pendingRequirements: requirementRows.filter((row) => row.status === "Pending Review").length,
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

  const teamPreviewProfiles = useMemo(() => {
    return [...teamProfiles]
      .sort((left, right) => {
        const onlineDifference = Number(isEmployeeOnline(right.last_seen_at)) - Number(isEmployeeOnline(left.last_seen_at));
        if (onlineDifference !== 0) return onlineDifference;

        const branchDifference = (left.branch || left.location || "").localeCompare(right.branch || right.location || "");
        if (branchDifference !== 0) return branchDifference;

        return (left.full_name || "").localeCompare(right.full_name || "");
      })
      .slice(0, 6);
  }, [teamProfiles]);

  const latestCutoff = useMemo(() => {
    return dtrRows[0]?.cutoff || "";
  }, [dtrRows]);

  const latestDtrByUserId = useMemo(() => {
    const map = new Map();
    dtrRows.forEach((row) => {
      if (!row.user_id) return;
      const current = map.get(row.user_id);
      if (!current || new Date(row.created_at || 0) > new Date(current.created_at || 0)) {
        map.set(row.user_id, row);
      }
    });
    return map;
  }, [dtrRows]);

  const latestCutoffDtrByUserId = useMemo(() => {
    const map = new Map();
    if (!latestCutoff) return map;

    dtrRows.forEach((row) => {
      if (row.cutoff !== latestCutoff || !row.user_id) return;
      const current = map.get(row.user_id);
      if (!current || new Date(row.created_at || 0) > new Date(current.created_at || 0)) {
        map.set(row.user_id, row);
      }
    });

    return map;
  }, [dtrRows, latestCutoff]);

  const requirementIssueCountByUserId = useMemo(() => {
    return requirementRows.reduce((map, row) => {
      if (row.status !== "Needs Reupload") return map;
      map.set(row.user_id, (map.get(row.user_id) || 0) + 1);
      return map;
    }, new Map());
  }, [requirementRows]);

  const teamActionQueue = useMemo(() => {
    return teamProfiles
      .map((member) => {
        const latestDtr = latestDtrByUserId.get(member.id) || null;
        const cutoffDtr = latestCutoffDtrByUserId.get(member.id) || null;
        const issueCount = requirementIssueCountByUserId.get(member.id) || 0;
        const isDirect = member.supervisor_user_id === profile?.id;
        const isOnline = isEmployeeOnline(member.last_seen_at);
        let type = "clear";
        let label = "Clear";
        let copy = latestCutoff ? `No action needed for ${latestCutoff}.` : "Waiting for active cutoff activity.";

        if (cutoffDtr?.status === "Rejected" || latestDtr?.status === "Rejected") {
          type = "follow-up";
          label = "Needs Follow-up";
          copy = "Rejected DTR needs remarks review and correction.";
        } else if (issueCount > 0) {
          type = "follow-up";
          label = "Needs Follow-up";
          copy = `${issueCount} requirement${issueCount === 1 ? "" : "s"} need reupload.`;
        } else if (latestCutoff && !cutoffDtr) {
          type = "missing";
          label = "Missing DTR";
          copy = `No DTR submitted for ${latestCutoff}.`;
        } else if (cutoffDtr?.status === "Pending Review") {
          type = "pending";
          label = "Pending Review";
          copy = "DTR is waiting for review, not correction.";
        } else if (!isOnline) {
          type = "watch";
          label = "Offline";
          copy = "No urgent DTR issue, but guard is currently offline.";
        }

        return {
          copy,
          cutoffDtr,
          isDirect,
          isOnline,
          label,
          latestDtr,
          member,
          type,
        };
      })
      .filter((item) => {
        if (actionFilter === "all") return true;
        if (actionFilter === "direct") return item.isDirect;
        return item.type === actionFilter;
      })
      .sort((left, right) => {
        const rankDifference = (actionRank[left.type] ?? 9) - (actionRank[right.type] ?? 9);
        if (rankDifference !== 0) return rankDifference;
        return (left.member.full_name || "").localeCompare(right.member.full_name || "");
      })
      .slice(0, 10);
  }, [actionFilter, latestCutoff, latestCutoffDtrByUserId, latestDtrByUserId, profile?.id, requirementIssueCountByUserId, teamProfiles]);

  const attendanceBoard = useMemo(() => {
    return teamProfiles
      .map((member) => ({
        member,
        latestDtr: latestDtrByUserId.get(member.id) || null,
      }))
      .sort((left, right) => {
        const statusRank = { "Pending Review": 0, Rejected: 1, Approved: 2 };
        const leftRank = left.latestDtr ? statusRank[left.latestDtr.status] ?? 3 : -1;
        const rightRank = right.latestDtr ? statusRank[right.latestDtr.status] ?? 3 : -1;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return (left.member.full_name || "").localeCompare(right.member.full_name || "");
      })
      .slice(0, 8);
  }, [latestDtrByUserId, teamProfiles]);

  const missingDtrTeam = useMemo(() => {
    if (!latestCutoff) return [];

    return teamProfiles
      .filter((member) => !dtrRows.some((row) => row.user_id === member.id && row.cutoff === latestCutoff))
      .sort((left, right) => (left.full_name || "").localeCompare(right.full_name || ""))
      .slice(0, 8);
  }, [dtrRows, latestCutoff, teamProfiles]);

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

      <Card>
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title admin-dashboard-home__section-title">Team Action Queue</h2>
            <p className="admin-section-copy">
              {latestCutoff
                ? `Prioritized guard follow-ups for ${latestCutoff}. Pending Review means wait; Needs Follow-up means fix something.`
                : "Team actions appear after the first active cutoff submission."}
            </p>
          </div>
          <Link className="admin-link" to="/supervisor/dtr">
            Open Team DTR
          </Link>
        </div>
        <div className="supervisor-dashboard-home__action-filters">
          {actionFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`supervisor-dashboard-home__action-filter${
                actionFilter === filter.value ? " supervisor-dashboard-home__action-filter--active" : ""
              }`}
              onClick={() => setActionFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="supervisor-dashboard-home__action-list">
          {teamActionQueue.map((item) => (
            <div key={item.member.id} className={`admin-list-card supervisor-dashboard-home__action-item supervisor-dashboard-home__action-item--${item.type}`}>
              <div className="supervisor-dashboard-home__team-main">
                <div className="supervisor-dashboard-home__action-title-row">
                  <p className="admin-dashboard-home__activity-name">{item.member.full_name || "Unnamed Guard"}</p>
                  {item.isDirect ? <span className="app-pill app-pill--success">Direct</span> : null}
                </div>
                <p className="app-copy-sm">
                  {item.member.employee_id || "No employee ID"} | {item.member.branch || item.member.location || "No assignment"}
                </p>
                <p className="app-copy-xs-muted">{item.copy}</p>
              </div>
              <div className="supervisor-dashboard-home__action-status">
                <span className={`app-pill supervisor-dashboard-home__action-pill supervisor-dashboard-home__action-pill--${item.type}`}>{item.label}</span>
                <PresenceBadge lastSeenAt={item.member.last_seen_at} />
              </div>
            </div>
          ))}
          {teamActionQueue.length === 0 ? <p className="admin-empty-copy">No guards match this action filter.</p> : null}
        </div>
      </Card>

      <div className="admin-sections-grid admin-sections-grid--analytics">
        <Card>
          <div className="admin-section-head">
            <div>
              <h2 className="admin-section-title admin-dashboard-home__section-title">Team Preview</h2>
              <p className="admin-section-copy">
                {teamProfiles.length > 0
                  ? `Showing ${Math.min(teamPreviewProfiles.length, teamProfiles.length)} of ${teamProfiles.length} guard${teamProfiles.length === 1 ? "" : "s"} in your scope.`
                  : "Live guard roster for your assigned supervisor scope."}
              </p>
            </div>
            <Link className="admin-link" to="/supervisor/team">
              Open Team Directory
            </Link>
          </div>

          {teamPreviewProfiles.length === 0 ? (
            <div className="app-empty-box">No guards are currently assigned under this supervisor scope.</div>
          ) : (
            <div className="supervisor-dashboard-home__team-list">
              {teamPreviewProfiles.map((item) => (
                <div key={item.id} className="admin-list-card supervisor-dashboard-home__team-item">
                  <div className="supervisor-dashboard-home__team-main">
                    <p className="admin-dashboard-home__activity-name">{item.full_name || "Unnamed Guard"}</p>
                    <p className="app-copy-sm">{item.employee_id || "No employee ID assigned"}</p>
                    <p className="app-copy-xs-muted">
                      {(item.branch || item.location || "No branch assigned")}{item.shift ? ` | ${item.shift}` : " | Shift not set"}
                    </p>
                  </div>
                  <PresenceBadge lastSeenAt={item.last_seen_at} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="admin-section-head">
            <div>
              <h2 className="admin-section-title admin-dashboard-home__section-title">Team Attendance Board</h2>
              <p className="admin-section-copy">
                Latest DTR status for your guards{latestCutoff ? `, using ${latestCutoff} as the active cutoff.` : "."}
              </p>
            </div>
            <Link className="admin-link" to="/supervisor/dtr">
              Open Team DTR
            </Link>
          </div>
          <div className="supervisor-dashboard-home__attendance-list">
            {attendanceBoard.map(({ member, latestDtr }) => (
              <div key={member.id} className="admin-list-card supervisor-dashboard-home__attendance-item">
                <div>
                  <p className="admin-dashboard-home__activity-name">{member.full_name || "Unnamed Guard"}</p>
                  <p className="app-copy-sm">{member.employee_id || "No employee ID"} | {member.branch || member.location || "No assignment"}</p>
                  <p className="app-copy-xs-muted">
                    {latestDtr ? `${latestDtr.cutoff || "No cutoff"} submitted ${new Date(latestDtr.created_at).toLocaleString()}` : "No DTR submitted yet"}
                  </p>
                </div>
                {latestDtr ? <StatusBadge status={latestDtr.status} /> : <span className="app-pill app-pill--danger">Missing</span>}
              </div>
            ))}
            {attendanceBoard.length === 0 ? <p className="admin-empty-copy">No guards are currently assigned under this supervisor scope.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="admin-section-head">
            <div>
              <h2 className="admin-section-title admin-dashboard-home__section-title">Missing DTR Follow-Up</h2>
              <p className="admin-section-copy">
                {latestCutoff ? `Guards without a DTR for ${latestCutoff}.` : "A cutoff appears here after the first team DTR is submitted."}
              </p>
            </div>
            <Link className="admin-link" to="/supervisor/dtr">
              Submit Team DTR
            </Link>
          </div>
          <div className="supervisor-dashboard-home__team-list">
            {missingDtrTeam.map((item) => (
              <div key={item.id} className="admin-list-card supervisor-dashboard-home__team-item">
                <div className="supervisor-dashboard-home__team-main">
                  <p className="admin-dashboard-home__activity-name">{item.full_name || "Unnamed Guard"}</p>
                  <p className="app-copy-sm">{item.employee_id || "No employee ID assigned"}</p>
                  <p className="app-copy-xs-muted">{item.branch || item.location || "No branch assigned"} | {item.shift || "Shift not set"}</p>
                </div>
                <span className="app-pill app-pill--warning">Follow up</span>
              </div>
            ))}
            {!latestCutoff ? <p className="admin-empty-copy">No active cutoff has DTR activity yet.</p> : null}
            {latestCutoff && missingDtrTeam.length === 0 ? <p className="admin-empty-copy">No missing DTRs for this cutoff.</p> : null}
          </div>
        </Card>

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
