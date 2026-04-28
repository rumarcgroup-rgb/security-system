import { isAdminRole } from "../../lib/roles";

export const MESSAGE_THREAD_SUMMARY_SELECT = `
  id,
  employee_user_id,
  supervisor_user_id,
  created_by_user_id,
  status,
  escalated_to_admin,
  escalated_by_user_id,
  escalated_at,
  last_message_at,
  last_message_sender_user_id,
  last_message_preview,
  created_at,
  employee:profiles!message_threads_employee_user_id_fkey(id, full_name, employee_id, location, branch, position, role),
  supervisor:profiles!message_threads_supervisor_user_id_fkey(id, full_name, employee_id, location, branch, position, role),
  read_states:message_read_states(user_id, last_read_message_id, last_read_at)
`;

export const MESSAGE_THREAD_MESSAGE_SELECT = "id,thread_id,sender_user_id,sender_role,body,created_at,edited_at";

export function applyMessageThreadScope(query, { currentRole, currentUserId }) {
  if (currentRole === "employee") {
    return query.eq("employee_user_id", currentUserId);
  }

  if (currentRole === "supervisor") {
    return query.eq("supervisor_user_id", currentUserId);
  }

  if (isAdminRole(currentRole)) {
    return query.or("supervisor_user_id.is.null,escalated_to_admin.eq.true");
  }

  return query.eq("id", "__unsupported__");
}

export function sortThreads(threads = []) {
  return [...threads].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "open" ? -1 : 1;
    }

    return new Date(right.last_message_at || right.created_at || 0) - new Date(left.last_message_at || left.created_at || 0);
  });
}

export function getThreadReadState(thread, currentUserId) {
  return (thread?.read_states || []).find((item) => item.user_id === currentUserId) || null;
}

export function isThreadUnread(thread, currentUserId) {
  if (!thread?.last_message_at) return false;
  if (thread.last_message_sender_user_id === currentUserId) return false;

  const readState = getThreadReadState(thread, currentUserId);
  if (!readState?.last_read_at) return true;

  return new Date(thread.last_message_at) > new Date(readState.last_read_at);
}

export function countUnreadThreads(threads = [], currentUserId) {
  return threads.filter((thread) => isThreadUnread(thread, currentUserId)).length;
}

export function normalizeMessageSenderRole(role = "employee") {
  if (role === "admin" || role === "supervisor") return role;
  return "employee";
}

export function getThreadParticipantRole(thread, userId) {
  if (!thread || !userId) return null;
  if (thread.employee_user_id === userId) return "employee";
  if (thread.supervisor_user_id === userId) return "supervisor";
  return "admin";
}

export function getRoleDisplayName(role) {
  if (isAdminRole(role)) return "Admin";
  if (role === "supervisor") return "Supervisor";
  return "Employee";
}

export function buildSeenReceiptLabel(role, { useRoleLabel = false } = {}) {
  if (!useRoleLabel || !role) return "Seen";
  return `Seen by ${getRoleDisplayName(role)}`;
}

export function buildEditedLabel(role) {
  return `Edited by ${getRoleDisplayName(role)}`;
}

export function buildTypingLabel(roles = []) {
  const normalizedRoles = [...new Set(roles.filter(Boolean).map((role) => normalizeMessageSenderRole(role)))];
  const orderedRoles = normalizedRoles.sort((left, right) => {
    const roleOrder = {
      employee: 0,
      supervisor: 1,
      admin: 2,
    };
    return (roleOrder[left] ?? 99) - (roleOrder[right] ?? 99);
  });

  if (!orderedRoles.length) return "";
  if (orderedRoles.length === 1) {
    return `${getRoleDisplayName(orderedRoles[0])} is typing...`;
  }
  if (orderedRoles.length === 2) {
    return `${getRoleDisplayName(orderedRoles[0])} and ${getRoleDisplayName(orderedRoles[1])} are typing...`;
  }

  const leadingLabels = orderedRoles.slice(0, 2).map((role) => getRoleDisplayName(role));
  return `${leadingLabels.join(", ")}, and ${orderedRoles.length - 2} others are typing...`;
}

export function getThreadCounterpartLabel(thread, currentRole) {
  if (currentRole === "employee") {
    return thread?.supervisor?.full_name || "Admin support";
  }

  return thread?.employee?.full_name || "Employee";
}

export function getThreadMetaCopy(thread, currentRole) {
  if (currentRole === "employee") {
    if (thread?.supervisor?.full_name) {
      return thread.escalated_to_admin ? "Supervisor thread escalated to admin" : "Assigned supervisor";
    }

    return "Direct admin fallback";
  }

  const employeeId = thread?.employee?.employee_id || "No employee ID";
  const scope = [thread?.employee?.location, thread?.employee?.branch].filter(Boolean).join(" / ") || "No assignment";
  return `${employeeId} | ${scope}`;
}

export function getThreadStatusLabel(thread) {
  if (thread?.status === "resolved") return "Resolved";
  if (thread?.escalated_to_admin) return "Escalated";
  return "Open";
}

export function getPreferredEmployeeThread(threadList = [], supervisorUserId = null) {
  const normalizedSupervisorId = supervisorUserId || null;
  return (
    threadList.find(
      (thread) => thread.status === "open" && (thread.supervisor_user_id || null) === normalizedSupervisorId
    ) ||
    threadList.find((thread) => (thread.supervisor_user_id || null) === normalizedSupervisorId) ||
    null
  );
}

export function getLatestMessage(messages = []) {
  return messages.length ? messages[messages.length - 1] : null;
}

export function getThreadPreview(thread) {
  return thread?.last_message_preview?.trim() || "No messages yet.";
}
