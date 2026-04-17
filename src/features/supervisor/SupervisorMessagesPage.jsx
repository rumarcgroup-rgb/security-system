import MessageThreadInboxPanel from "../messaging/MessageThreadInboxPanel";
import { useMessageThreadInbox } from "../messaging/useMessageThreadInbox";

export default function SupervisorMessagesPage({ profile }) {
  const inbox = useMessageThreadInbox({
    currentRole: "supervisor",
    currentUserId: profile?.id,
  });

  return (
    <MessageThreadInboxPanel
      activeMessages={inbox.activeMessages}
      activeTypingLabel={inbox.activeTypingLabel}
      activeThread={inbox.activeThread}
      activeThreadId={inbox.activeThreadId}
      activeThreadUnread={inbox.activeThreadUnread}
      connectionState={inbox.connectionState}
      currentRole="supervisor"
      currentUserId={profile?.id}
      description="Instant guard threads from your assigned team appear here."
      editableMessageId={inbox.editableMessageId}
      editingMessageId={inbox.editingMessageId}
      lastSyncedAt={inbox.lastSyncedAt}
      messageSeenReceipts={inbox.messageSeenReceipts}
      messagesLoading={inbox.messagesLoading}
      onComposerTyping={inbox.setComposerTyping}
      onEditMessage={inbox.editMessage}
      onMarkThreadRead={inbox.markThreadRead}
      onResolveThread={inbox.resolveThread}
      onSelectThread={inbox.setActiveThreadId}
      onSendMessage={inbox.sendMessage}
      onSyncNow={inbox.syncNow}
      resolvingThreadId={inbox.resolvingThreadId}
      sendingMessage={inbox.sendingMessage}
      threads={inbox.threads}
      threadsLoading={inbox.threadsLoading}
      title="Supervisor Messages"
      unreadCount={inbox.unreadCount}
    />
  );
}
