import { Clock3, FileImage, ListChecks, UserRound } from "lucide-react";
import StatusBadge from "../../../components/ui/StatusBadge";

export default function EmployeeActionItemsSection({
  actions,
  emptyCopy,
  onPendingDtrAction,
}) {
  return (
    <div>
      <div className="employee-dashboard__section-head">
        <div>
          <h3 className="employee-dashboard__subsection-title">Action Items</h3>
          <p className="app-copy-sm">Profile corrections and DTR follow-ups appear here.</p>
        </div>
        <div className="app-icon-box">
          <ListChecks size={18} />
        </div>
      </div>

      <div className="employee-stack employee-dashboard__stack">
        {actions.length === 0 ? (
          <div className="app-info-panel app-info-panel--success employee-dashboard__notice-card">{emptyCopy}</div>
        ) : null}

        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="employee-card-panel employee-card-panel--muted employee-dashboard__doc-row employee-dashboard__action-row"
            onClick={() => {
              if (action.kind === "dtr") {
                onPendingDtrAction?.();
                return;
              }

              action.action?.();
            }}
          >
            <div className="employee-dashboard__doc-row-main">
              <div className="app-icon-box employee-dashboard__doc-row-icon">
                {action.kind === "profile" ? <UserRound size={18} /> : action.kind === "dtr" ? <Clock3 size={18} /> : <FileImage size={18} />}
              </div>
              <div className="employee-dashboard__min-w-0">
                <p className="employee-dashboard__truncate app-text-strong-dark">{action.title}</p>
                <p className="employee-dashboard__action-copy">{action.description}</p>
              </div>
            </div>
            <StatusBadge status={action.status} />
          </button>
        ))}
      </div>
    </div>
  );
}
