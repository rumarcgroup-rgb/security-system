export const EMPLOYEE_ONLINE_WINDOW_MS = 2 * 60 * 1000;
export const EMPLOYEE_PRESENCE_HEARTBEAT_MS = 60 * 1000;

export function isEmployeeOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  const lastSeenMs = new Date(lastSeenAt).getTime();
  if (Number.isNaN(lastSeenMs)) return false;
  return Date.now() - lastSeenMs <= EMPLOYEE_ONLINE_WINDOW_MS;
}

export function formatLastSeen(lastSeenAt) {
  if (!lastSeenAt) return "Never";

  const date = new Date(lastSeenAt);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  return date.toLocaleString();
}
