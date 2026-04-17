import MessageThreadInboxPanel from "../messaging/MessageThreadInboxPanel";
import { useMessageThreadInbox } from "../messaging/useMessageThreadInbox";

export default function AdminMessagesPage({ profile }) {
  const inbox = useMessageThreadInbox({
    currentRole: "admin",
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
      currentRole="admin"
      currentUserId={profile?.id}
      description="Escalated guard threads and admin fallback conversations appear here."
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
      title="Admin Messages"
      unreadCount={inbox.unreadCount}
    />
  );
}
