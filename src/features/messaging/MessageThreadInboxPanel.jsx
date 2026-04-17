import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, RefreshCcw, SendHorizontal, ShieldAlert } from "lucide-react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import StatusBadge from "../../components/ui/StatusBadge";
import { formatDateTime } from "../employee/employeeDashboardUtils";
import {
  getThreadCounterpartLabel,
  getThreadMetaCopy,
  getThreadPreview,
  getThreadStatusLabel,
  isThreadUnread,
} from "./messageThreadUtils";

export default function MessageThreadInboxPanel({
  activeMessages,
  activeThread,
  activeThreadId,
  activeThreadUnread,
  connectionState,
  currentRole,
  currentUserId,
  description,
  lastSyncedAt,
  messagesLoading,
  onMarkThreadRead,
  onResolveThread,
  onSelectThread,
  onSendMessage,
  onSyncNow,
  resolvingThreadId,
  sendingMessage,
  threads,
  threadsLoading,
  title,
  unreadCount,
}) {
  const [draftMessage, setDraftMessage] = useState("");
  const conversationBodyRef = useRef(null);

  const latestActiveMessage = useMemo(() => {
    return activeMessages.length ? activeMessages[activeMessages.length - 1] : null;
  }, [activeMessages]);

  const connectionLabel = useMemo(() => {
    if (connectionState === "live") return "Live";
    if (connectionState === "reconnecting") return "Reconnecting...";
    if (connectionState === "error") return "Sync issue";
    return "Connecting...";
  }, [connectionState]);

  const showManualSync = connectionState === "reconnecting" || connectionState === "error";

  useEffect(() => {
    if (!activeThread?.id || !activeThreadUnread || !latestActiveMessage || latestActiveMessage.sender_user_id === currentUserId) {
      return;
    }

    void onMarkThreadRead(activeThread.id, latestActiveMessage.id, latestActiveMessage.created_at);
  }, [activeThread?.id, activeThreadUnread, currentUserId, latestActiveMessage, onMarkThreadRead]);

  useEffect(() => {
    if (!conversationBodyRef.current || activeMessages.length === 0) return;

    conversationBodyRef.current.scrollTo({
      top: conversationBodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeMessages]);

  async function handleSendMessage(event) {
    event.preventDefault();
    const didSend = await onSendMessage(draftMessage, activeThread?.id || null);
    if (didSend) {
      setDraftMessage("");
    }
  }

  return (
    <div className="admin-page">
      <Card>
        <div className="admin-section-head">
          <div className="admin-section-intro">
            <h2 className="admin-section-title">{title}</h2>
            <p className="admin-section-copy">
              {unreadCount > 0
                ? `${unreadCount} unread conversation${unreadCount === 1 ? "" : "s"} need attention.`
                : description}
            </p>
          </div>
        </div>
      </Card>

      <div className="message-inbox-layout">
        <Card className="message-thread-list-card">
          <div className="admin-section-head">
            <div className="admin-section-intro">
              <h3 className="admin-section-title">Threads</h3>
              <p className="admin-section-copy">Open conversations routed to your inbox.</p>
            </div>
          </div>

          <div className="message-thread-list">
            {threadsLoading ? <p className="admin-loading-copy">Loading conversations...</p> : null}
            {!threadsLoading && threads.length === 0 ? (
              <div className="app-empty-box">
                No realtime conversations are active right now.
              </div>
            ) : null}

            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`message-thread-card${thread.id === activeThreadId ? " message-thread-card--active" : ""}`}
                onClick={() => onSelectThread(thread.id)}
              >
                <div className="message-thread-card__head">
                  <div className="message-thread-card__title-wrap">
                    <p className="app-text-strong-dark">{getThreadCounterpartLabel(thread, currentRole)}</p>
                    <p className="admin-copy-xs">{getThreadMetaCopy(thread, currentRole)}</p>
                  </div>
                  <div className="message-thread-card__meta">
                    {thread.id === activeThreadId && !threadsLoading ? <span className="message-thread-card__active-dot" aria-hidden="true" /> : null}
                    {isThreadUnread(thread, currentUserId) ? (
                      <span className="message-thread-card__unread-pill">Unread</span>
                    ) : null}
                  </div>
                </div>

                <p className="message-thread-card__preview">{getThreadPreview(thread)}</p>

                <div className="message-thread-card__foot">
                  <StatusBadge status={getThreadStatusLabel(thread)} />
                  <span className="admin-copy-xs-muted">{formatDateTime(thread.last_message_at || thread.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="message-conversation-card">
          {!activeThread ? (
            <div className="app-empty-box app-empty-box--center">
              Select a thread to view the conversation.
            </div>
          ) : (
            <div className="message-conversation">
              <div className="message-conversation__header">
                <div>
                  <p className="admin-section-title">{getThreadCounterpartLabel(activeThread, currentRole)}</p>
                  <p className="admin-section-copy">{getThreadMetaCopy(activeThread, currentRole)}</p>
                </div>
                <div className="message-conversation__header-actions">
                  <span className={`message-connection-pill message-connection-pill--${connectionState}`}>
                    {connectionLabel}
                  </span>
                  {showManualSync ? (
                    <button type="button" className="message-sync-button" onClick={onSyncNow}>
                      <RefreshCcw size={14} />
                      Sync now
                    </button>
                  ) : null}
                  {activeThread.escalated_to_admin ? (
                    <span className="app-pill app-pill--warning">
                      <ShieldAlert size={14} />
                      Escalated to admin
                    </span>
                  ) : null}
                  <StatusBadge status={getThreadStatusLabel(activeThread)} />
                  {["admin", "supervisor"].includes(currentRole) ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="app-compact-button"
                      loading={resolvingThreadId === activeThread.id}
                      onClick={() => onResolveThread(activeThread.id)}
                    >
                      <CheckCheck size={16} />
                      Resolve
                    </Button>
                  ) : null}
                </div>
              </div>

              {showManualSync && lastSyncedAt ? <p className="admin-copy-xs-muted">Last synced {formatDateTime(lastSyncedAt)}</p> : null}

              <div ref={conversationBodyRef} className="message-conversation__body">
                {messagesLoading ? <p className="admin-loading-copy">Loading conversation...</p> : null}
                {!messagesLoading && activeMessages.length === 0 ? (
                  <div className="app-empty-box">
                    No messages yet in this thread.
                  </div>
                ) : null}

                {activeMessages.map((message) => {
                  const isOwnMessage = message.sender_user_id === currentUserId;

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
                            {isOwnMessage ? "You" : message.sender_role === "admin" ? "Admin" : message.sender_role === "supervisor" ? "Supervisor" : "Employee"}
                          </span>
                          <span className="message-bubble__time">{formatDateTime(message.created_at)}</span>
                        </div>
                        <p className="message-bubble__copy">{message.body}</p>
                        {message.localStatus ? (
                          <p
                            className={`message-bubble__delivery message-bubble__delivery--${message.localStatus}`}
                          >
                            {message.localStatus === "failed" ? "Failed to send. Press send again to retry." : "Sending..."}
                          </p>
                        ) : null}
                      </article>
                    </div>
                  );
                })}
              </div>

              <form className="message-composer" onSubmit={handleSendMessage}>
                <label className="message-composer__field">
                  <span className="sr-only">Type your message</span>
                  <textarea
                    className="message-composer__input"
                    placeholder="Type a message for this thread"
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    rows={3}
                  />
                </label>
                <div className="message-composer__actions">
                  <p className="admin-copy-xs-muted">
                    Text-only replies update instantly for everyone in this thread.
                  </p>
                  <Button type="submit" loading={sendingMessage} disabled={!draftMessage.trim()}>
                    <SendHorizontal size={16} />
                    Send Reply
                  </Button>
                </div>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
