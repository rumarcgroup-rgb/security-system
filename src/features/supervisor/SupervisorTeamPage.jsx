import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Card from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import { sortBranches } from "../../lib/branches";
import { isEmployeeOnline } from "../../lib/presence";
import { getSupervisorScopeLabel } from "../../lib/supervisorScope";
import PresenceBadge from "../admin/users/PresenceBadge";
import { useLivePeopleStore } from "../realtime/useLivePeopleStore";

export default function SupervisorTeamPage({ profile }) {
  const [filters, setFilters] = useState({ branch: "All", status: "All", q: "" });
  const { profiles: teamProfiles, loading } = useLivePeopleStore({
    currentRole: "supervisor",
    currentUserId: profile?.id,
    scopeProfile: profile,
  });

  const branchOptions = useMemo(() => ["All", ...sortBranches(Array.from(new Set(teamProfiles.map((item) => item.branch).filter(Boolean))))], [teamProfiles]);

  const filteredProfiles = useMemo(() => {
    const query = filters.q.trim().toLowerCase();

    return teamProfiles.filter((item) => {
      const presenceStatus = isEmployeeOnline(item.last_seen_at) ? "online" : "offline";
      const haystack = [item.full_name, item.employee_id, item.position, item.branch, item.location].filter(Boolean).join(" ").toLowerCase();
      return (
        (filters.branch === "All" || item.branch === filters.branch) &&
        (filters.status === "All" || filters.status === presenceStatus) &&
        (!query || haystack.includes(query))
      );
    });
  }, [teamProfiles, filters]);

  if (!profile?.location) {
    return <p className="admin-empty-copy">This supervisor account needs an area assignment before the team directory can load.</p>;
  }

  if (loading) {
    return <p className="admin-loading-copy">Loading team directory...</p>;
  }

  return (
    <div className="admin-page supervisor-team-page">
      <Card>
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title">Team Directory</h2>
            <p className="admin-section-copy">Employees assigned under {getSupervisorScopeLabel(profile)}.</p>
          </div>
        </div>

        <div className="admin-filters-grid admin-filters-grid--directory">
          <Select label="Branch" value={filters.branch} onChange={(e) => setFilters((prev) => ({ ...prev, branch: e.target.value }))}>
            {branchOptions.map((branch) => (
              <option key={branch}>{branch}</option>
            ))}
          </Select>
          <Select label="Presence" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="All">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </Select>
          <label className="admin-search-label admin-search-label--wide">
            <span className="admin-search-label-text">Search</span>
            <div className="admin-search-wrap">
              <Search size={16} className="admin-search-icon" />
              <input
                className="admin-search-input"
                placeholder="Name, employee ID, branch, position"
                value={filters.q}
                onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
              />
            </div>
          </label>
        </div>
      </Card>

      <Card>
        <div className="admin-section-head">
          <div>
            <h2 className="admin-section-title">Team Members</h2>
            <p className="admin-section-copy">{filteredProfiles.length} matching employee(s)</p>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr className="admin-table-head-row admin-table-head-row--caps">
                <th className="admin-table-head-cell admin-table-head-cell--lg">Employee</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Presence</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Assignment</th>
                <th className="admin-table-head-cell admin-table-head-cell--lg">Schedule</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((item) => (
                <tr key={item.id} className="admin-table-row admin-table-row--top">
                  <td className="admin-table-cell admin-table-cell--lg">
                    <p className="admin-text-strong">{item.full_name || "Unnamed Employee"}</p>
                    <p className="admin-copy-xs">{item.employee_id || "No employee ID assigned"}</p>
                    <p className="admin-copy-xs-muted">{item.position || "No position set"}</p>
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    <PresenceBadge lastSeenAt={item.last_seen_at} />
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    <p className="admin-text-medium">{item.location || "Unassigned location"}</p>
                    <p className="admin-copy-xs">{item.branch || "No branch set"}</p>
                  </td>
                  <td className="admin-table-cell admin-table-cell--lg">
                    <p className="admin-copy-xs">Shift: {item.shift || "Not set"}</p>
                    <p className="admin-copy-xs-muted">Supervisor: {item.supervisor || profile.full_name || "Not set"}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProfiles.length === 0 ? <p className="admin-empty-copy">No team members match the current filters.</p> : null}
      </Card>
    </div>
  );
}
