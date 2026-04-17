import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  MessageSquareText,
  RefreshCcw,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import StatusBadge from "../../../components/ui/StatusBadge";
import { formatDateTime } from "../employeeDashboardUtils";
import {
  buildEditedLabel,
  getThreadCounterpartLabel,
  getThreadMetaCopy,
  getThreadPreview,
  getThreadStatusLabel,
} from "../../messaging/messageThreadUtils";

const MESSAGE_FILTERS = [
  { value: "all", label: "All" },
  { value: "dtr", label: "DTR" },
  { value: "documents", label: "Documents" },
  { value: "profile", label: "Profile" },
  { value: "admin", label: "Admin" },
];

const MESSAGE_CATEGORY_META = {
  dtr: {
    label: "DTR",
    icon: Clock3,
  },
  documents: {
    label: "Documents",
    icon: FileText,
  },
  profile: {
    label: "Profile",
    icon: UserRound,
  },
  admin: {
    label: "Admin",
    icon: ShieldCheck,
  },
};

const PRIORITY_LABELS = {
  high: "High Priority",
  medium: "Needs Review",
  low: "Info",
};

const MESSAGE_WORKSPACES = [
  { value: "updates", label: "Updates" },
  { value: "chat", label: "Chat" },
];

export default function EmployeeMessagesView({
  assignment,
  chatInbox,
  currentUserId,
  onMarkAllStatusMessagesRead,
  onStatusMessageAction,
  onStatusMessageOpen,
  statusMessages,
  unreadStatusMessagesCount,
}) {
  const [activeWorkspace, setActiveWorkspace] = useState("updates");
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedMessageId, setExpandedMessageId] = useState(null);
  const [draftChatMessage, setDraftChatMessage] = useState("");
  const [isChatComposerFocused, setIsChatComposerFocused] = useState(false);
  const [editingChatMessageId, setEditingChatMessageId] = useState(null);
  const [editingChatMessageDraft, setEditingChatMessageDraft] = useState("");
  const chatHistoryRef = useRef(null);

  const filteredMessages = useMemo(() => {
    return activeFilter === "all"
      ? statusMessages
      : statusMessages.filter((message) => message.category === activeFilter);
  }, [activeFilter, statusMessages]);

  const latestChatMessage = useMemo(() => {
    return chatInbox.activeMessages.length ? chatInbox.activeMessages[chatInbox.activeMessages.length - 1] : null;
  }, [chatInbox.activeMessages]);

  const activeChatTargetLabel = useMemo(() => {
    if (chatInbox.activeThread) {
      return getThreadCounterpartLabel(chatInbox.activeThread, "employee");
    }

    return assignment.supervisor && assignment.supervisor !== "Not assigned" ? assignment.supervisor : "Admin support";
  }, [assignment.supervisor, chatInbox.activeThread]);

  const activeChatTargetCopy = useMemo(() => {
    if (chatInbox.activeThread) {
      return getThreadMetaCopy(chatInbox.activeThread, "employee");
    }

    return assignment.supervisor && assignment.supervisor !== "Not assigned" ? "Assigned supervisor" : "Direct admin fallback";
  }, [assignment.supervisor, chatInbox.activeThread]);

  const connectionLabel = useMemo(() => {
    if (chatInbox.connectionState === "live") return "Live";
    if (chatInbox.connectionState === "reconnecting") return "Reconnecting...";
    if (chatInbox.connectionState === "error") return "Sync issue";
    return "Connecting...";
  }, [chatInbox.connectionState]);

  const showManualSync = chatInbox.connectionState === "reconnecting" || chatInbox.connectionState === "error";

  useEffect(() => {
    if (
      activeWorkspace !== "chat" ||
      !chatInbox.activeThread?.id ||
      !chatInbox.activeThreadUnread ||
      !latestChatMessage ||
      latestChatMessage.sender_user_id === currentUserId
    ) {
      return;
    }

    void chatInbox.markThreadRead(chatInbox.activeThread.id, latestChatMessage.id, latestChatMessage.created_at);
  }, [
    activeWorkspace,
    chatInbox.activeThread?.id,
    chatInbox.activeThreadUnread,
    chatInbox.markThreadRead,
    currentUserId,
    latestChatMessage,
  ]);

  useEffect(() => {
    if (!chatHistoryRef.current || activeWorkspace !== "chat" || chatInbox.activeMessages.length === 0) return;

    chatHistoryRef.current.scrollTo({
      top: chatHistoryRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeWorkspace, chatInbox.activeMessages]);

  useEffect(() => {
    chatInbox.setComposerTyping?.({
      draftText: activeWorkspace === "chat" ? draftChatMessage : "",
      hasFocus: activeWorkspace === "chat" && isChatComposerFocused,
    });
  }, [activeWorkspace, chatInbox.setComposerTyping, draftChatMessage, isChatComposerFocused]);

  useEffect(() => {
    setEditingChatMessageId(null);
    setEditingChatMessageDraft("");
  }, [chatInbox.activeThreadId]);

  useEffect(() => {
    if (!editingChatMessageId) return;

    const isStillEditable = editingChatMessageId === chatInbox.editableMessageId;
    const messageStillExists = chatInbox.activeMessages.some((message) => message.id === editingChatMessageId);
    if (isStillEditable && messageStillExists) return;

    setEditingChatMessageId(null);
    setEditingChatMessageDraft("");
  }, [chatInbox.activeMessages, chatInbox.editableMessageId, editingChatMessageId]);

  function handleToggleMessage(message) {
    setExpandedMessageId((current) => (current === message.id ? null : message.id));
    onStatusMessageOpen(message.id);
  }

  async function handleSendChatMessage(event) {
    event.preventDefault();
    const didSend = await chatInbox.sendMessage(draftChatMessage, chatInbox.activeThread?.id || null);
    if (didSend) {
      setDraftChatMessage("");
    }
  }

  function handleStartEditingChatMessage(message) {
    setEditingChatMessageId(message.id);
    setEditingChatMessageDraft(message.body || "");
  }

  async function handleSaveEditedChatMessage(messageId) {
    const didSave = await chatInbox.editMessage?.(messageId, editingChatMessageDraft);
    if (didSave) {
      setEditingChatMessageId(null);
      setEditingChatMessageDraft("");
    }
  }

  return (
    <main className="employee-dashboard__content employee-dashboard__stack-lg">
      <div className="employee-dashboard__page-header">
        <h2 className="employee-dashboard__section-title">Messages</h2>
        <p className="app-copy-sm">Check employee updates or send instant messages to your assigned supervisor.</p>
      </div>

      <Card className="employee-dashboard__messages-summary-card">
        <div className="employee-dashboard__message-workspaces">
          {MESSAGE_WORKSPACES.map((workspace) => {
            const badgeCount = workspace.value === "updates" ? unreadStatusMessagesCount : chatInbox.unreadCount;

            return (
              <button
                key={workspace.value}
                type="button"
                className={`employee-dashboard__message-workspace-tab${
                  activeWorkspace === workspace.value ? " employee-dashboard__message-workspace-tab--active" : ""
                }`}
                onClick={() => setActiveWorkspace(workspace.value)}
              >
                <span>{workspace.label}</span>
                {badgeCount > 0 ? <span className="employee-dashboard__message-workspace-badge">{Math.min(badgeCount, 9)}</span> : null}
              </button>
            );
          })}
        </div>
      </Card>

      {activeWorkspace === "updates" ? (
        <>
          <Card className="employee-dashboard__messages-summary-card">
            <div className="employee-dashboard__messages-toolbar">
              <div>
                <p className="employee-dashboard__subsection-title">Status Inbox</p>
                <p className="app-copy-sm">
                  {unreadStatusMessagesCount > 0
                    ? `${unreadStatusMessagesCount} unread status update${unreadStatusMessagesCount === 1 ? "" : "s"} need your attention.`
                    : "You are caught up on your latest employee updates."}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="employee-button-secondary"
                onClick={onMarkAllStatusMessagesRead}
                disabled={statusMessages.length === 0 || unreadStatusMessagesCount === 0}
              >
                <CheckCheck size={16} />
                Mark all as read
              </Button>
            </div>

            <div className="employee-dashboard__message-filters">
              {MESSAGE_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={`employee-dashboard__message-filter${activeFilter === filter.value ? " employee-dashboard__message-filter--active" : ""}`}
                  onClick={() => {
                    setActiveFilter(filter.value);
                    setExpandedMessageId(null);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </Card>

          <div className="employee-stack employee-dashboard__stack">
            {filteredMessages.length === 0 ? (
              <div className="app-empty-box">
                No {activeFilter === "all" ? "" : `${MESSAGE_FILTERS.find((item) => item.value === activeFilter)?.label.toLowerCase()} `}messages to show right now.
              </div>
            ) : null}

            {filteredMessages.map((message) => {
              const categoryMeta = MESSAGE_CATEGORY_META[message.category] || MESSAGE_CATEGORY_META.admin;
              const CategoryIcon = categoryMeta.icon;
              const isExpanded = expandedMessageId === message.id;

              return (
                <Card
                  key={message.id}
                  className={`employee-dashboard__message-card${message.isUnread ? " employee-dashboard__message-card--unread" : ""}`}
                >
                  <button
                    type="button"
                    className="employee-dashboard__message-toggle"
                    onClick={() => handleToggleMessage(message)}
                  >
                    <div className="employee-dashboard__message-main">
                      <div className="app-icon-box employee-dashboard__message-icon">
                        <CategoryIcon size={18} />
                      </div>
                      <div className="employee-dashboard__min-w-0">
                        <div className="employee-dashboard__message-meta">
                          <span className="employee-dashboard__message-chip employee-dashboard__message-chip--category">
                            {categoryMeta.label}
                          </span>
                          <span className={`employee-dashboard__message-chip employee-dashboard__message-chip--${message.priority}`}>
                            {PRIORITY_LABELS[message.priority] || PRIORITY_LABELS.low}
                          </span>
                          {message.isUnread ? <span className="employee-dashboard__message-unread-dot" aria-hidden="true" /> : null}
                        </div>
                        <p className="app-text-strong-dark">{message.title}</p>
                        <p className="employee-dashboard__message-date">{message.createdAt ? formatDateTime(message.createdAt) : "Needs attention"}</p>
                        {!isExpanded ? <p className="employee-dashboard__message-snippet">{message.body}</p> : null}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={18} className="employee-dashboard__message-chevron" /> : <ChevronDown size={18} className="employee-dashboard__message-chevron" />}
                  </button>

                  {isExpanded ? (
                    <div className="employee-dashboard__message-body">
                      <p>{message.body}</p>
                      {message.actionLabel && message.actionTarget ? (
                        <div className="employee-dashboard__message-actions">
                          <Button type="button" variant="secondary" className="employee-button-secondary" onClick={() => onStatusMessageAction(message)}>
                            {message.actionLabel}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <Card className="employee-dashboard__messages-summary-card">
            <div className="employee-dashboard__messages-toolbar">
              <div>
                <p className="employee-dashboard__subsection-title">Direct Chat</p>
                <p className="app-copy-sm">
                  {chatInbox.unreadCount > 0
                    ? `${chatInbox.unreadCount} unread chat update${chatInbox.unreadCount === 1 ? "" : "s"} are waiting.`
                    : `Send an instant text message to ${activeChatTargetLabel}.`}
                </p>
              </div>
              {chatInbox.activeThread?.supervisor_user_id && !chatInbox.activeThread?.escalated_to_admin ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="employee-button-secondary"
                  loading={chatInbox.escalatingThreadId === chatInbox.activeThread.id}
                  onClick={() => chatInbox.escalateThread(chatInbox.activeThread.id)}
                >
                  <ShieldAlert size={16} />
                  Escalate to admin
                </Button>
              ) : null}
              {chatInbox.activeThread?.supervisor_user_id && chatInbox.activeThread?.escalated_to_admin ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="employee-button-secondary"
                  loading={chatInbox.deescalatingThreadId === chatInbox.activeThread.id}
                  onClick={() => chatInbox.deescalateThread(chatInbox.activeThread.id)}
                >
                  <ShieldAlert size={16} />
                  Turn off admin escalation
                </Button>
              ) : null}
            </div>
          </Card>

          <Card className="employee-dashboard__chat-card">
            <div className="employee-dashboard__chat-header">
              <div>
                <p className="employee-dashboard__subsection-title">{activeChatTargetLabel}</p>
                <p className="app-copy-sm">{activeChatTargetCopy}</p>
                {showManualSync && chatInbox.lastSyncedAt ? (
                  <p className="admin-copy-xs-muted">Last synced {formatDateTime(chatInbox.lastSyncedAt)}</p>
                ) : null}
              </div>
              <div className="employee-dashboard__chat-header-actions">
                <span className={`message-connection-pill message-connection-pill--${chatInbox.connectionState}`}>
                  {connectionLabel}
                </span>
                {showManualSync ? (
                  <button type="button" className="message-sync-button" onClick={chatInbox.syncNow}>
                    <RefreshCcw size={14} />
                    Sync now
                  </button>
                ) : null}
                {chatInbox.activeThread?.escalated_to_admin ? (
                  <span className="app-pill app-pill--warning">
                    <ShieldAlert size={14} />
                    Escalated to admin
                  </span>
                ) : null}
                <StatusBadge status={chatInbox.activeThread ? getThreadStatusLabel(chatInbox.activeThread) : "Open"} />
              </div>
            </div>

            {!chatInbox.activeThread && !chatInbox.threadsLoading ? (
              <div className="app-empty-box app-empty-box--spaced">
                Start the first conversation with {activeChatTargetLabel}. Your first message will open a live thread automatically.
              </div>
            ) : null}

            {chatInbox.activeThread?.status === "resolved" ? (
              <div className="app-info-panel app-info-panel--success employee-dashboard__chat-banner">
                This thread was resolved. Sending a new message will reopen it instantly.
              </div>
            ) : null}

            {chatInbox.activeThread?.escalated_to_admin ? (
              <div className="app-info-panel app-info-panel--warning employee-dashboard__chat-banner">
                This conversation is already escalated, so admin can now reply alongside your supervisor.
              </div>
            ) : null}

            <div ref={chatHistoryRef} className="employee-dashboard__chat-history">
              {chatInbox.threadsLoading || chatInbox.messagesLoading ? <p className="admin-loading-copy">Loading conversation...</p> : null}
              {!chatInbox.messagesLoading && chatInbox.activeMessages.length === 0 ? (
                <div className="app-empty-box">
                  {chatInbox.activeThread ? "No replies yet in this thread." : `No chat history yet with ${activeChatTargetLabel}.`}
                </div>
              ) : null}

              {chatInbox.activeMessages.map((message) => {
                const isOwnMessage = message.sender_user_id === currentUserId;
                const isEditingMessage = editingChatMessageId === message.id;
                const canEditMessage = Boolean(message.id === chatInbox.editableMessageId && !message.localStatus);
                const messageReceipt = chatInbox.messageSeenReceipts?.[message.id] || null;

                return (
                  <div
                    key={message.id}
                    className={`message-bubble-row${isOwnMessage ? " message-bubble-row--own" : ""}`}
                  >
                    <article
                      className={`message-bubble${isOwnMessage ? " message-bubble--own" : ""}${
                        message.localStatus ? ` message-bubble--${message.localStatus}` : ""
                      }`}
                    >
                      <div className="message-bubble__meta">
                        <span className="message-bubble__sender">
                          {isOwnMessage ? "You" : message.sender_role === "admin" ? "Admin" : message.sender_role === "supervisor" ? "Supervisor" : "Support"}
                        </span>
                        <span className="message-bubble__time">{formatDateTime(message.created_at)}</span>
                      </div>
                      {isEditingMessage ? (
                        <div className="message-bubble__editor">
                          <textarea
                            className="message-bubble__editor-input"
                            value={editingChatMessageDraft}
                            onChange={(event) => setEditingChatMessageDraft(event.target.value)}
                            rows={3}
                          />
                          <div className="message-bubble__actions">
                            <button
                              type="button"
                              className="message-bubble__action-button"
                              onClick={() => {
                                setEditingChatMessageId(null);
                                setEditingChatMessageDraft("");
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="message-bubble__action-button message-bubble__action-button--primary"
                              onClick={() => handleSaveEditedChatMessage(message.id)}
                              disabled={!editingChatMessageDraft.trim() || editingChatMessageDraft.trim() === (message.body || "").trim() || chatInbox.editingMessageId === message.id}
                            >
                              {chatInbox.editingMessageId === message.id ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="message-bubble__copy">{message.body}</p>
                      )}
                      {message.localStatus ? (
                        <p className={`message-bubble__delivery message-bubble__delivery--${message.localStatus}`}>
                          {message.localStatus === "failed" ? "Failed to send. Press send again to retry." : "Sending..."}
                        </p>
                      ) : null}
                      {!isEditingMessage && messageReceipt ? <p className="message-bubble__receipt">{messageReceipt.label}</p> : null}
                      {!isEditingMessage && message.edited_at ? (
                        <p className="message-bubble__edited">{buildEditedLabel(message.sender_role)}</p>
                      ) : null}
                      {!isEditingMessage && canEditMessage ? (
                        <div className="message-bubble__actions">
                          <button
                            type="button"
                            className="message-bubble__action-button"
                            onClick={() => handleStartEditingChatMessage(message)}
                          >
                            Edit
                          </button>
                        </div>
                      ) : null}
                    </article>
                  </div>
                );
              })}

              {chatInbox.activeThread && chatInbox.threads.length > 1 ? (
                <div className="employee-dashboard__chat-footnote">
                  <MessageSquareText size={16} />
                  <span>
                    {getThreadPreview(chatInbox.activeThread)}
                  </span>
                </div>
              ) : null}
            </div>

            <form className="message-composer" onSubmit={handleSendChatMessage}>
              <label className="message-composer__field">
                <span className="sr-only">Type your message</span>
                <textarea
                  className="message-composer__input"
                  placeholder={`Type your message for ${activeChatTargetLabel}`}
                  rows={3}
                  value={draftChatMessage}
                  onChange={(event) => setDraftChatMessage(event.target.value)}
                  onFocus={() => setIsChatComposerFocused(true)}
                  onBlur={() => setIsChatComposerFocused(false)}
                />
              </label>
              <div className="message-composer__actions">
                <div className="message-composer__status">
                  {chatInbox.activeTypingLabel ? <p className="message-composer__typing">{chatInbox.activeTypingLabel}</p> : null}
                  <p className="admin-copy-xs-muted">Text-only instant messaging for quick updates, questions, and escalation notes.</p>
                </div>
                <Button type="submit" loading={chatInbox.sendingMessage} disabled={!draftChatMessage.trim()}>
                  <SendHorizontal size={16} />
                  Send Message
                </Button>
              </div>
            </form>
          </Card>
        </>
      )}
    </main>
  );
}
