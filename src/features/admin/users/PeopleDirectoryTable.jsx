import { Link } from "react-router-dom";
import { ShieldCheck, UserRound } from "lucide-react";
import Button from "../../../components/ui/Button";
import Select from "../../../components/ui/Select";
import PresenceBadge from "./PresenceBadge";

export default function PeopleDirectoryTable({ profiles, savingId, onUpdateRole, onOpenAssignmentEditor }) {
  return (
    <>
      <div className="admin-table-wrap admin-users-page__table-wrap">
        <table className="admin-table admin-users-page__table">
          <thead>
            <tr className="admin-table-head-row admin-table-head-row--caps">
              <th className="admin-table-head-cell admin-table-head-cell--lg">User</th>
              <th className="admin-table-head-cell admin-table-head-cell--lg">Presence</th>
              <th className="admin-table-head-cell admin-table-head-cell--lg">Assignment</th>
              <th className="admin-table-head-cell admin-table-head-cell--lg">Government IDs</th>
              <th className="admin-table-head-cell admin-table-head-cell--lg">Requirements</th>
              <th className="admin-table-head-cell admin-table-head-cell--lg">Role</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="admin-table-row admin-table-row--top">
                <td className="admin-table-cell admin-table-cell--lg">
                  <div className="admin-users-page__user-main">
                    <div className="app-avatar app-avatar--panel app-avatar--sm admin-users-page__avatar">
                      {profile.preview_url ? (
                        <img src={profile.preview_url} alt={profile.full_name || "User"} className="app-media-cover" />
                      ) : profile.role === "admin" ? (
                        <ShieldCheck size={18} />
                      ) : (
                        <UserRound size={18} />
                      )}
                    </div>
                    <div>
                      <p className="admin-text-strong">{profile.full_name || "Unnamed User"}</p>
                      <p className="admin-copy-xs">{profile.employee_id || "No employee ID assigned"}</p>
                      <p className="admin-copy-xs-muted">{profile.id}</p>
                    </div>
                  </div>
                </td>
                <td className="admin-table-cell admin-table-cell--lg">
                  {profile.role === "employee" || profile.role === "supervisor" ? (
                    <PresenceBadge lastSeenAt={profile.last_seen_at} />
                  ) : (
                    <p className="admin-copy-xs-muted">Admin account</p>
                  )}
                </td>
                <td className="admin-table-cell admin-table-cell--lg">
                  <p className="admin-text-medium">{profile.position || "No position set"}</p>
                  <p className="admin-copy-xs">
                    {profile.location || "Unassigned location"}
                    {profile.branch ? ` / ${profile.branch}` : ""}
                  </p>
                  <p className="admin-copy-xs-muted">
                    Shift: {profile.shift || "Not set"} | Supervisor: {profile.supervisor || "Not set"}
                  </p>
                  <Button variant="secondary" className="admin-users-page__button-top" onClick={() => onOpenAssignmentEditor(profile)}>
                    Edit Assignment
                  </Button>
                </td>
                <td className="admin-table-cell admin-table-cell--lg admin-copy-xs">
                  <p>SSS: {profile.sss || "-"}</p>
                  <p>PhilHealth: {profile.philhealth || "-"}</p>
                  <p>Pag-IBIG: {profile.pagibig || "-"}</p>
                  <p>TIN: {profile.tin || "-"}</p>
                </td>
                <td className="admin-table-cell admin-table-cell--lg">
                  <Link className="app-link-button admin-users-page__button-wide-link" to={`/admin/requirements?user=${profile.id}`}>
                    Review Files
                  </Link>
                </td>
                <td className="admin-table-cell admin-table-cell--lg">
                  <div className="admin-users-page__role-controls">
                    <Select value={profile.role} onChange={(e) => onUpdateRole(profile.id, e.target.value)} disabled={savingId === profile.id}>
                      <option value="employee">employee</option>
                      <option value="supervisor">supervisor</option>
                      <option value="admin">admin</option>
                    </Select>
                    <Button
                      variant="secondary"
                      className="admin-button-full"
                      loading={savingId === profile.id}
                      onClick={() => onUpdateRole(profile.id, profile.role === "admin" ? "employee" : "admin")}
                    >
                      {profile.role === "admin" ? "Make Employee" : "Make Admin"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {profiles.length === 0 ? <p className="admin-copy-sm">No profiles match the current filters.</p> : null}
    </>
  );
}
