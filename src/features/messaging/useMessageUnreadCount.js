import { useMessageThreadRealtime } from "./messageThreadRealtimeStore";

export function useMessageUnreadCount({ currentRole, currentUserId }) {
  const { unreadCount } = useMessageThreadRealtime({ currentRole, currentUserId });
  return unreadCount;
}
