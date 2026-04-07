import { formatLastSeen, isEmployeeOnline } from "../../../lib/presence";

export default function PresenceBadge({ lastSeenAt }) {
  const online = isEmployeeOnline(lastSeenAt);

  return (
    <div className="admin-users-page__presence">
      <span className={`app-pill ${online ? "app-pill--success" : "app-pill--muted"}`}>
        <span className={`app-pill-dot ${online ? "app-pill-dot--success" : "app-pill-dot--muted"}`} />
        {online ? "Online" : "Offline"}
      </span>
      <p className="admin-copy-xs">Last seen: {formatLastSeen(lastSeenAt)}</p>
    </div>
  );
}
