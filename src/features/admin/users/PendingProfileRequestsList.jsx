import { UserRound } from "lucide-react";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";

export default function PendingProfileRequestsList({ requests, onReview }) {
  return (
    <div className="admin-stack-sm">
      {requests.map((request) => {
        const isPending = request.status === "Pending Review";
        const historyStateClass =
          request.status === "Approved"
            ? " admin-users-page__request-card--approved"
            : request.status === "Rejected"
              ? " admin-users-page__request-card--rejected"
              : "";

        return (
          <div
            key={request.id}
            className={`admin-list-card admin-list-card--responsive admin-users-page__request-card${isPending ? "" : " admin-users-page__request-card--history"}${historyStateClass}`}
          >
            <div className="admin-media-row admin-users-page__request-main">
              <div className="app-avatar app-avatar--circle app-avatar--md admin-users-page__avatar">
                {request.preview_url ? (
                  <img src={request.preview_url} alt={request.requested_full_name || "Requested avatar"} className="app-media-cover" />
                ) : (
                  <UserRound size={18} />
                )}
              </div>
              <div>
                <p className="admin-text-strong">{request.profiles?.full_name || "Unknown Employee"}</p>
                <p className="admin-copy-sm">
                  {request.profiles?.employee_id || "No Employee ID"} | Requested name: {request.requested_full_name || "No change"}
                </p>
                <p className="admin-copy-xs-muted">{new Date(request.created_at).toLocaleString()}</p>
                {request.reviewed_at ? (
                  <p className="admin-copy-xs-muted">
                    Reviewed: {new Date(request.reviewed_at).toLocaleString()}
                  </p>
                ) : (
                  <p className="admin-copy-xs-muted">Awaiting review</p>
                )}
              </div>
            </div>
            <div className={`admin-users-page__actions${isPending ? "" : " admin-users-page__actions--history"}`}>
              <StatusBadge status={request.status} />
              {isPending ? (
                <Button variant="secondary" onClick={() => onReview(request)}>
                  Review
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
      {requests.length === 0 ? <p className="admin-copy-sm">No profile update requests match the current filters.</p> : null}
    </div>
  );
}
