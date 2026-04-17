import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import {
  MESSAGE_THREAD_MESSAGE_SELECT,
  buildSeenReceiptLabel,
  buildTypingLabel,
  getLatestMessage,
  getPreferredEmployeeThread,
  getThreadParticipantRole,
  getThreadReadState,
  isThreadUnread,
  normalizeMessageSenderRole,
} from "./messageThreadUtils";
import { useMessageThreadRealtime } from "./messageThreadRealtimeStore";

const RECOVERY_POLL_MS = 3000;
const RECONNECT_WATCHDOG_MS = 6000;
const PENDING_RECONCILIATION_MS = 4000;
const TYPING_EVENT_NAME = "typing";
const TYPING_EXPIRY_MS = 3000;
const TYPING_BROADCAST_THROTTLE_MS = 1200;

function sortMessages(messages = []) {
  return [...messages].sort((left, right) => new Date(left.created_at || 0) - new Date(right.created_at || 0));
}

function buildOptimisticMessage({ body, currentRole, currentUserId, threadId }) {
  const createdAt = new Date().toISOString();
  return {
    id: `pending-${threadId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    thread_id: threadId,
    sender_user_id: currentUserId,
    sender_role: normalizeMessageSenderRole(currentRole),
    body,
    created_at: createdAt,
    localStatus: "pending",
    client_created_at: createdAt,
  };
}

function isMatchingConfirmedMessage(confirmedMessage, pendingMessage) {
  if (!confirmedMessage || !pendingMessage) return false;
  if (confirmedMessage.sender_user_id !== pendingMessage.sender_user_id) return false;
  if ((confirmedMessage.body || "").trim() !== (pendingMessage.body || "").trim()) return false;

  const confirmedTime = new Date(confirmedMessage.created_at || 0).getTime();
  const pendingTime = new Date(pendingMessage.client_created_at || pendingMessage.created_at || 0).getTime();
  return Math.abs(confirmedTime - pendingTime) <= 60000;
}

function mergeConfirmedMessages(confirmedMessages = [], pendingMessages = []) {
  const nextConfirmed = new Map();
  confirmedMessages.forEach((message) => {
    if (message?.id) {
      nextConfirmed.set(message.id, message);
    }
  });

  const unmatchedPending = pendingMessages.filter(
    (pendingMessage) => !confirmedMessages.some((confirmedMessage) => isMatchingConfirmedMessage(confirmedMessage, pendingMessage))
  );

  return sortMessages([...nextConfirmed.values(), ...unmatchedPending]);
}

function upsertRealtimeMessage(currentMessages = [], nextMessage) {
  if (!nextMessage?.id) return currentMessages;

  const confirmedMessages = currentMessages.filter((message) => !message.localStatus && message.id !== nextMessage.id);
  return sortMessages([...confirmedMessages, nextMessage, ...currentMessages.filter((message) => message.localStatus)]);
}

export function useMessageThreadInbox({ currentRole, currentUserId, preferredSupervisorUserId = null }) {
  const threadRealtime = useMessageThreadRealtime({ currentRole, currentUserId });
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [escalatingThreadId, setEscalatingThreadId] = useState(null);
  const [deescalatingThreadId, setDeescalatingThreadId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [resolvingThreadId, setResolvingThreadId] = useState(null);
  const [messageConnectionState, setMessageConnectionState] = useState("connecting");
  const [lastMessageSyncedAt, setLastMessageSyncedAt] = useState(null);
  const [messageChannelEpoch, setMessageChannelEpoch] = useState(0);
  const [typingParticipants, setTypingParticipants] = useState([]);
  const activeThreadIdRef = useRef(null);
  const activeThreadChannelRef = useRef(null);
  const messageConnectionStateRef = useRef("connecting");
  const messageRestartAttemptsRef = useRef(0);
  const messageReconnectWatchdogRef = useRef(null);
  const pendingMessagesRef = useRef(new Map());
  const pendingMessageTimersRef = useRef(new Map());
  const typingParticipantsMapRef = useRef(new Map());
  const typingParticipantTimersRef = useRef(new Map());
  const composerTypingRef = useRef({
    draftText: "",
    hasFocus: false,
    isTyping: false,
    lastSentAt: 0,
    threadId: null,
  });

  const threads = threadRealtime.threads;
  const threadsLoading = threadRealtime.threadsLoading;

  function updateMessageConnectionState(nextState) {
    messageConnectionStateRef.current = nextState;
    setMessageConnectionState(nextState);
  }

  function clearMessageReconnectWatchdog() {
    if (messageReconnectWatchdogRef.current && typeof window !== "undefined") {
      window.clearTimeout(messageReconnectWatchdogRef.current);
      messageReconnectWatchdogRef.current = null;
    }
  }

  function clearPendingMessageTimer(messageId) {
    const timerId = pendingMessageTimersRef.current.get(messageId);
    if (!timerId || typeof window === "undefined") return;

    window.clearTimeout(timerId);
    pendingMessageTimersRef.current.delete(messageId);
  }

  function commitTypingParticipants() {
    const nextTypingParticipants = [...typingParticipantsMapRef.current.values()].sort((left, right) => {
      const roleOrder = {
        employee: 0,
        supervisor: 1,
        admin: 2,
      };

      if ((roleOrder[left.role] ?? 99) !== (roleOrder[right.role] ?? 99)) {
        return (roleOrder[left.role] ?? 99) - (roleOrder[right.role] ?? 99);
      }

      return new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0);
    });

    setTypingParticipants(nextTypingParticipants);
  }

  function clearTypingParticipantTimer(userId) {
    const timerId = typingParticipantTimersRef.current.get(userId);
    if (!timerId || typeof window === "undefined") return;

    window.clearTimeout(timerId);
    typingParticipantTimersRef.current.delete(userId);
  }

  function removeTypingParticipant(userId) {
    if (!userId) return;

    clearTypingParticipantTimer(userId);
    if (!typingParticipantsMapRef.current.has(userId)) return;

    typingParticipantsMapRef.current.delete(userId);
    commitTypingParticipants();
  }

  function resetTypingParticipants() {
    typingParticipantTimersRef.current.forEach((timerId) => {
      if (typeof window !== "undefined") {
        window.clearTimeout(timerId);
      }
    });
    typingParticipantTimersRef.current.clear();
    typingParticipantsMapRef.current.clear();
    setTypingParticipants([]);
  }

  function applyTypingPayload(payload) {
    const nextPayload = payload?.payload || payload || {};
    const senderUserId = nextPayload.userId || null;
    const targetThreadId = nextPayload.threadId || null;
    const senderRole = normalizeMessageSenderRole(nextPayload.role);

    if (!senderUserId || !targetThreadId || senderUserId === currentUserId) return;
    if (targetThreadId !== activeThreadIdRef.current) return;

    if (!nextPayload.isTyping) {
      removeTypingParticipant(senderUserId);
      return;
    }

    typingParticipantsMapRef.current.set(senderUserId, {
      userId: senderUserId,
      role: senderRole,
      updatedAt: new Date().toISOString(),
    });
    commitTypingParticipants();

    if (typeof window !== "undefined") {
      clearTypingParticipantTimer(senderUserId);
      const timerId = window.setTimeout(() => {
        removeTypingParticipant(senderUserId);
      }, TYPING_EXPIRY_MS);
      typingParticipantTimersRef.current.set(senderUserId, timerId);
    }
  }

  function getPendingMessages(threadId) {
    return pendingMessagesRef.current.get(threadId) || [];
  }

  function setPendingMessages(threadId, nextPendingMessages) {
    if (!threadId) return;

    const previousPendingMessages = pendingMessagesRef.current.get(threadId) || [];
    const nextPendingMessagesById = new Map(nextPendingMessages.map((message) => [message.id, message]));

    previousPendingMessages.forEach((previousMessage) => {
      const nextMessage = nextPendingMessagesById.get(previousMessage.id);
      if (!nextMessage || nextMessage.localStatus !== "pending") {
        clearPendingMessageTimer(previousMessage.id);
      }
    });

    if (!nextPendingMessages.length) {
      pendingMessagesRef.current.delete(threadId);
      return;
    }

    pendingMessagesRef.current.set(threadId, nextPendingMessages);
  }

  const broadcastTypingState = useCallback(
    async (nextIsTyping, threadId = activeThreadIdRef.current) => {
      const channel = activeThreadChannelRef.current;
      const normalizedThreadId = threadId || null;
      const normalizedRole = normalizeMessageSenderRole(currentRole);

      composerTypingRef.current.threadId = normalizedThreadId;

      if (!normalizedThreadId || !currentUserId) {
        composerTypingRef.current.isTyping = false;
        return;
      }

      if (!channel || messageConnectionStateRef.current !== "live") {
        composerTypingRef.current.isTyping = false;
        return;
      }

      const now = Date.now();
      if (
        nextIsTyping &&
        composerTypingRef.current.isTyping &&
        now - composerTypingRef.current.lastSentAt < TYPING_BROADCAST_THROTTLE_MS
      ) {
        return;
      }

      composerTypingRef.current.isTyping = nextIsTyping;
      composerTypingRef.current.lastSentAt = now;

      try {
        await channel.send({
          type: "broadcast",
          event: TYPING_EVENT_NAME,
          payload: {
            isTyping: nextIsTyping,
            role: normalizedRole,
            threadId: normalizedThreadId,
            userId: currentUserId,
          },
        });
      } catch {
        if (!nextIsTyping) {
          composerTypingRef.current.isTyping = false;
        }
      }
    },
    [currentRole, currentUserId]
  );

  const setComposerTyping = useCallback(
    ({ draftText = "", hasFocus = false } = {}) => {
      const normalizedDraftText = draftText;
      const shouldBroadcastTyping = Boolean(activeThreadIdRef.current && hasFocus && normalizedDraftText.trim());

      composerTypingRef.current = {
        ...composerTypingRef.current,
        draftText: normalizedDraftText,
        hasFocus: Boolean(hasFocus),
        threadId: activeThreadIdRef.current,
      };

      if (shouldBroadcastTyping) {
        void broadcastTypingState(true, activeThreadIdRef.current);
        return;
      }

      if (composerTypingRef.current.isTyping) {
        void broadcastTypingState(false, composerTypingRef.current.threadId || activeThreadIdRef.current);
        return;
      }

      composerTypingRef.current.isTyping = false;
    },
    [broadcastTypingState]
  );

  const markPendingMessageFailed = useCallback((threadId, optimisticMessageId) => {
    if (!threadId || !optimisticMessageId) return;

    const failedPendingMessages = getPendingMessages(threadId).map((message) =>
      message.id === optimisticMessageId
        ? {
            ...message,
            localStatus: "failed",
          }
        : message
    );
    setPendingMessages(threadId, failedPendingMessages);

    if (activeThreadIdRef.current === threadId) {
      setActiveMessages((current) =>
        current.map((message) =>
          message.id === optimisticMessageId
            ? {
                ...message,
                localStatus: "failed",
              }
            : message
        )
      );
    }
  }, []);

  const syncMessages = useCallback(
    async (threadId = activeThreadIdRef.current, { showLoading = false } = {}) => {
      if (!threadId) {
        setActiveMessages([]);
        setMessagesLoading(false);
        return [];
      }

      if (showLoading) {
        setMessagesLoading(true);
      }

      const { data, error } = await supabase
        .from("message_messages")
        .select(MESSAGE_THREAD_MESSAGE_SELECT)
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) {
        setMessagesLoading(false);
        updateMessageConnectionState("error");
        return [];
      }

      const nextMessages = mergeConfirmedMessages(data ?? [], getPendingMessages(threadId));
      setPendingMessages(
        threadId,
        getPendingMessages(threadId).filter((pendingMessage) => pendingMessage.localStatus === "failed")
      );

      if (activeThreadIdRef.current === threadId) {
        setActiveMessages(nextMessages);
      }

      setMessagesLoading(false);
      setLastMessageSyncedAt(new Date().toISOString());
      return nextMessages;
    },
    []
  );

  const schedulePendingMessageReconciliation = useCallback(
    (threadId, optimisticMessage) => {
      if (!threadId || !optimisticMessage || typeof window === "undefined") return;

      clearPendingMessageTimer(optimisticMessage.id);
      const timeoutId = window.setTimeout(async () => {
        const stillPending = getPendingMessages(threadId).some(
          (message) => message.id === optimisticMessage.id && message.localStatus === "pending"
        );

        if (!stillPending) {
          clearPendingMessageTimer(optimisticMessage.id);
          return;
        }

        await syncMessages(threadId, { showLoading: false });

        const remainsPending = getPendingMessages(threadId).some(
          (message) => message.id === optimisticMessage.id && message.localStatus === "pending"
        );
        clearPendingMessageTimer(optimisticMessage.id);

        if (remainsPending) {
          markPendingMessageFailed(threadId, optimisticMessage.id);
        }
      }, PENDING_RECONCILIATION_MS);

      pendingMessageTimersRef.current.set(optimisticMessage.id, timeoutId);
    },
    [markPendingMessageFailed, syncMessages]
  );

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
    composerTypingRef.current.threadId = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) {
      updateMessageConnectionState(threadRealtime.connectionState);
    }
  }, [activeThreadId, threadRealtime.connectionState]);

  useEffect(() => {
    messageRestartAttemptsRef.current = 0;
    clearMessageReconnectWatchdog();
  }, [activeThreadId, currentRole, currentUserId]);

  useEffect(() => {
    return () => {
      clearMessageReconnectWatchdog();
      pendingMessageTimersRef.current.forEach((timerId) => {
        if (typeof window !== "undefined") {
          window.clearTimeout(timerId);
        }
      });
      pendingMessageTimersRef.current.clear();
      resetTypingParticipants();
    };
  }, []);

  useEffect(() => {
    if (!threads.length) {
      setActiveThreadId(null);
      return;
    }

    setActiveThreadId((current) => {
      if (current && threads.some((thread) => thread.id === current)) {
        return current;
      }

      if (currentRole === "employee") {
        return getPreferredEmployeeThread(threads, preferredSupervisorUserId)?.id ?? null;
      }

      return threads[0]?.id ?? null;
    });
  }, [currentRole, preferredSupervisorUserId, threads]);

  useEffect(() => {
    if (!activeThreadId) {
      setActiveMessages([]);
      setMessagesLoading(false);
      clearMessageReconnectWatchdog();
      activeThreadChannelRef.current = null;
      resetTypingParticipants();
      composerTypingRef.current.isTyping = false;
      return undefined;
    }

    const activeThreadFilter = `thread_id=eq.${activeThreadId}`;

    function scheduleMessageReconnectWatchdog() {
      if (messageReconnectWatchdogRef.current || typeof window === "undefined") return;

      messageReconnectWatchdogRef.current = window.setTimeout(() => {
        messageReconnectWatchdogRef.current = null;

        if (messageConnectionStateRef.current === "live") {
          return;
        }

        if (messageRestartAttemptsRef.current === 0) {
          messageRestartAttemptsRef.current = 1;
          setMessageChannelEpoch((current) => current + 1);
          return;
        }

        updateMessageConnectionState("error");
      }, RECONNECT_WATCHDOG_MS);
    }

    function handleVisibilityBackfill() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        resetTypingParticipants();
        if (composerTypingRef.current.isTyping) {
          void broadcastTypingState(false, activeThreadId);
        }
        return;
      }

      updateMessageConnectionState(messageConnectionStateRef.current === "live" ? "live" : "reconnecting");
      void syncMessages(activeThreadId, { showLoading: false });
    }

    function handleOnlineBackfill() {
      updateMessageConnectionState(messageConnectionStateRef.current === "live" ? "live" : "reconnecting");
      void syncMessages(activeThreadId, { showLoading: false });
    }

    messageConnectionStateRef.current = "connecting";
    setMessageConnectionState("connecting");
    resetTypingParticipants();
    void syncMessages(activeThreadId, { showLoading: true });

    const channel = supabase
      .channel(`message-thread-room-${activeThreadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_messages", filter: activeThreadFilter }, (payload) => {
        if (payload.eventType === "DELETE") {
          const deletedMessageId = payload.old?.id;
          setActiveMessages((current) => current.filter((message) => message.id !== deletedMessageId));
          setLastMessageSyncedAt(new Date().toISOString());
          return;
        }

        const nextPendingMessages = getPendingMessages(activeThreadId).filter(
          (pendingMessage) => !isMatchingConfirmedMessage(payload.new, pendingMessage)
        );
        setPendingMessages(activeThreadId, nextPendingMessages);

        setActiveMessages((current) =>
          mergeConfirmedMessages(
            upsertRealtimeMessage(current, payload.new).filter((message) => !message.localStatus),
            nextPendingMessages
          )
        );
        setLastMessageSyncedAt(new Date().toISOString());
      })
      .on("broadcast", { event: TYPING_EVENT_NAME }, (payload) => {
        applyTypingPayload(payload);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          messageRestartAttemptsRef.current = 0;
          clearMessageReconnectWatchdog();
          activeThreadChannelRef.current = channel;
          resetTypingParticipants();
          updateMessageConnectionState("live");
          void syncMessages(activeThreadId, { showLoading: false });
          if (composerTypingRef.current.hasFocus && composerTypingRef.current.draftText.trim()) {
            void broadcastTypingState(true, activeThreadId);
          }
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          activeThreadChannelRef.current = null;
          resetTypingParticipants();
          composerTypingRef.current.isTyping = false;
          updateMessageConnectionState("reconnecting");
          scheduleMessageReconnectWatchdog();
          return;
        }

        activeThreadChannelRef.current = null;
        updateMessageConnectionState("connecting");
        scheduleMessageReconnectWatchdog();
      });

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnlineBackfill);
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityBackfill);
    }

    return () => {
      clearMessageReconnectWatchdog();
      if (composerTypingRef.current.isTyping) {
        void channel.send({
          type: "broadcast",
          event: TYPING_EVENT_NAME,
          payload: {
            isTyping: false,
            role: normalizeMessageSenderRole(currentRole),
            threadId: activeThreadId,
            userId: currentUserId,
          },
        });
      }
      composerTypingRef.current.isTyping = false;
      activeThreadChannelRef.current = null;
      resetTypingParticipants();
      supabase.removeChannel(channel);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnlineBackfill);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityBackfill);
      }
    };
  }, [activeThreadId, broadcastTypingState, currentRole, currentUserId, messageChannelEpoch, syncMessages]);

  const activeThread = useMemo(() => {
    return threads.find((thread) => thread.id === activeThreadId) || null;
  }, [activeThreadId, threads]);

  const unreadCount = threadRealtime.unreadCount;

  const activeThreadUnread = useMemo(() => {
    return activeThread ? isThreadUnread(activeThread, currentUserId) : false;
  }, [activeThread, currentUserId]);

  const connectionState = useMemo(() => {
    const states = [threadRealtime.connectionState, activeThreadId ? messageConnectionState : null].filter(Boolean);

    if (states.includes("error")) return "error";
    if (states.includes("reconnecting")) return "reconnecting";
    if (states.includes("connecting")) return "connecting";
    if (states.includes("live")) return "live";
    return "connecting";
  }, [activeThreadId, messageConnectionState, threadRealtime.connectionState]);

  const lastSyncedAt = useMemo(() => {
    return lastMessageSyncedAt || threadRealtime.lastSyncedAt || null;
  }, [lastMessageSyncedAt, threadRealtime.lastSyncedAt]);

  const messageSeenReceipts = useMemo(() => {
    if (!activeThread || !currentUserId) return {};

    const useRoleLabel = activeThread.escalated_to_admin || !activeThread.supervisor_user_id;
    const receiptCandidates = (activeThread.read_states || [])
      .filter((readState) => readState.user_id && readState.user_id !== currentUserId && readState.last_read_at)
      .map((readState) => ({
        ...readState,
        role: getThreadParticipantRole(activeThread, readState.user_id),
      }));

    return activeMessages.reduce((receiptMap, message) => {
      if (!message?.id || message.localStatus || message.sender_user_id !== currentUserId || !message.created_at) {
        return receiptMap;
      }

      const latestReceipt = receiptCandidates
        .filter((readState) => new Date(readState.last_read_at) >= new Date(message.created_at))
        .sort((left, right) => new Date(right.last_read_at || 0) - new Date(left.last_read_at || 0))[0];

      if (!latestReceipt) {
        return receiptMap;
      }

      receiptMap[message.id] = {
        label: buildSeenReceiptLabel(latestReceipt.role, { useRoleLabel }),
        readAt: latestReceipt.last_read_at,
        role: latestReceipt.role,
      };
      return receiptMap;
    }, {});
  }, [activeMessages, activeThread, currentUserId]);

  const editableMessageId = useMemo(() => {
    if (!currentUserId) return null;

    return (
      [...activeMessages]
        .reverse()
        .find((message) => !message.localStatus && message.sender_user_id === currentUserId)?.id || null
    );
  }, [activeMessages, currentUserId]);

  const activeTypingLabel = useMemo(() => {
    return buildTypingLabel(typingParticipants.map((participant) => participant.role));
  }, [typingParticipants]);

  useEffect(() => {
    if (!activeThreadId || connectionState === "live" || typeof window === "undefined") {
      return undefined;
    }

    const recoveryInterval = window.setInterval(() => {
      void syncMessages(activeThreadId, { showLoading: false });
    }, RECOVERY_POLL_MS);

    return () => {
      window.clearInterval(recoveryInterval);
    };
  }, [activeThreadId, connectionState, syncMessages]);

  async function markThreadRead(threadId = activeThreadId, explicitMessageId = null, explicitCreatedAt = null) {
    if (!threadId || !currentUserId) return;

    const targetThread = threads.find((thread) => thread.id === threadId) || null;
    const latestMessage = explicitMessageId || activeThreadId !== threadId ? null : getLatestMessage(activeMessages);
    const latestConfirmedMessageId = latestMessage?.localStatus ? null : latestMessage?.id;
    const nextReadAt = explicitCreatedAt || latestMessage?.created_at || targetThread?.last_message_at || new Date().toISOString();
    const nextReadMessageId =
      explicitMessageId || latestConfirmedMessageId || getThreadReadState(targetThread, currentUserId)?.last_read_message_id || null;

    const { error } = await supabase.from("message_read_states").upsert(
      {
        thread_id: threadId,
        user_id: currentUserId,
        last_read_message_id: nextReadMessageId,
        last_read_at: nextReadAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "thread_id,user_id" }
    );

    if (error) {
      return;
    }

    threadRealtime.applyLocalReadState(threadId, {
      last_read_message_id: nextReadMessageId,
      last_read_at: nextReadAt,
    });
  }

  async function ensureEmployeeThread() {
    if (currentRole !== "employee" || !currentUserId) return null;

    const preferredThread = getPreferredEmployeeThread(threads, preferredSupervisorUserId);
    if (preferredThread && preferredThread.status === "open") {
      setActiveThreadId(preferredThread.id);
      return preferredThread;
    }

    const payload = {
      employee_user_id: currentUserId,
      supervisor_user_id: preferredSupervisorUserId || null,
      created_by_user_id: currentUserId,
      status: "open",
      escalated_to_admin: false,
      last_message_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("message_threads").insert(payload);

    if (error) {
      const reloadedThreads = await threadRealtime.syncNow({ showLoading: false });
      const fallbackThread = getPreferredEmployeeThread(reloadedThreads, preferredSupervisorUserId);
      if (fallbackThread) {
        setActiveThreadId(fallbackThread.id);
        return fallbackThread;
      }

      toast.error(error.message || "Unable to start your message thread.");
      return null;
    }

    const reloadedThreads = await threadRealtime.syncNow({ showLoading: false });
    const nextThread = getPreferredEmployeeThread(reloadedThreads, preferredSupervisorUserId);
    if (nextThread) {
      setActiveThreadId(nextThread.id);
      return nextThread;
    }

    return null;
  }

  async function sendMessage(body, threadId = activeThreadId) {
    const trimmedBody = body.trim();
    if (!trimmedBody) return false;

    setSendingMessage(true);

    let optimisticMessage = null;
    let targetThreadId = threadId;

    try {
      if (!targetThreadId && currentRole === "employee") {
        const nextThread = await ensureEmployeeThread();
        targetThreadId = nextThread?.id || null;
      }

      if (!targetThreadId) {
        toast.error("Open a conversation first.");
        return false;
      }

      if (composerTypingRef.current.isTyping) {
        void broadcastTypingState(false, targetThreadId);
      }
      composerTypingRef.current.draftText = "";

      optimisticMessage = buildOptimisticMessage({
        body: trimmedBody,
        currentRole,
        currentUserId,
        threadId: targetThreadId,
      });

      const nextPendingMessages = [...getPendingMessages(targetThreadId), optimisticMessage];
      setPendingMessages(targetThreadId, nextPendingMessages);

      if (activeThreadIdRef.current === targetThreadId) {
        setActiveMessages((current) => sortMessages([...current, optimisticMessage]));
      }

      threadRealtime.patchThreadActivity(targetThreadId, {
        body: trimmedBody,
        createdAt: optimisticMessage.created_at,
        senderUserId: currentUserId,
      });

      const { error } = await supabase.from("message_messages").insert({
        thread_id: targetThreadId,
        sender_user_id: currentUserId,
        sender_role: normalizeMessageSenderRole(currentRole),
        body: trimmedBody,
      });

      if (error) {
        throw error;
      }

      setActiveThreadId(targetThreadId);
      schedulePendingMessageReconciliation(targetThreadId, optimisticMessage);
      return true;
    } catch (error) {
      if (optimisticMessage) {
        markPendingMessageFailed(optimisticMessage.thread_id, optimisticMessage.id);
      }

      await Promise.all([
        threadRealtime.syncNow({ showLoading: false }),
        targetThreadId ? syncMessages(targetThreadId, { showLoading: false }) : Promise.resolve([]),
      ]);
      toast.error(error.message || "Unable to send your message.");
      return false;
    } finally {
      setSendingMessage(false);
    }
  }

  async function syncNow() {
    await Promise.all([
      threadRealtime.syncNow({ showLoading: false }),
      activeThreadId ? syncMessages(activeThreadId, { showLoading: false }) : Promise.resolve([]),
    ]);
  }

  async function escalateThread(threadId = activeThreadId) {
    if (!threadId || currentRole !== "employee") return false;

    setEscalatingThreadId(threadId);
    try {
      const { error } = await supabase.rpc("employee_escalate_message_thread", {
        target_thread_id: threadId,
      });
      if (error) throw error;

      toast.success("Thread escalated to admin.");
      await threadRealtime.syncNow({ showLoading: false });
      return true;
    } catch (error) {
      toast.error(error.message || "Unable to escalate this thread.");
      return false;
    } finally {
      setEscalatingThreadId(null);
    }
  }

  async function deescalateThread(threadId = activeThreadId) {
    if (!threadId || currentRole !== "employee") return false;

    setDeescalatingThreadId(threadId);
    try {
      const { error } = await supabase.rpc("employee_deescalate_message_thread", {
        target_thread_id: threadId,
      });
      if (error) throw error;

      toast.success("Admin escalation turned off.");
      await threadRealtime.syncNow({ showLoading: false });
      return true;
    } catch (error) {
      toast.error(error.message || "Unable to turn off admin escalation.");
      return false;
    } finally {
      setDeescalatingThreadId(null);
    }
  }

  async function editMessage(targetMessageId, nextBody) {
    const trimmedBody = nextBody.trim();
    if (!targetMessageId || !trimmedBody) return false;

    setEditingMessageId(targetMessageId);
    try {
      const { data, error } = await supabase.rpc("edit_message", {
        target_message_id: targetMessageId,
        next_body: trimmedBody,
      });
      if (error) throw error;

      if (data?.id) {
        setActiveMessages((current) =>
          sortMessages(current.map((message) => (message.id === data.id ? { ...message, ...data } : message)))
        );
      }

      return true;
    } catch (error) {
      toast.error(error.message || "Unable to edit this message.");
      return false;
    } finally {
      setEditingMessageId(null);
    }
  }

  async function resolveThread(threadId = activeThreadId) {
    if (!threadId || !["supervisor", "admin"].includes(currentRole)) return false;

    setResolvingThreadId(threadId);
    try {
      const { error } = await supabase.rpc("resolve_message_thread", {
        target_thread_id: threadId,
      });
      if (error) throw error;

      toast.success("Thread marked as resolved.");
      await threadRealtime.syncNow({ showLoading: false });
      return true;
    } catch (error) {
      toast.error(error.message || "Unable to resolve this thread.");
      return false;
    } finally {
      setResolvingThreadId(null);
    }
  }

  return {
    activeMessages,
    activeThread,
    activeThreadId,
    activeTypingLabel,
    activeThreadUnread,
    connectionState,
    deescalateThread,
    deescalatingThreadId,
    editableMessageId,
    editMessage,
    editingMessageId,
    ensureEmployeeThread,
    escalateThread,
    escalatingThreadId,
    lastSyncedAt,
    loadThreads: threadRealtime.syncNow,
    messageSeenReceipts,
    markThreadRead,
    messagesLoading,
    resolveThread,
    resolvingThreadId,
    sendingMessage,
    sendMessage,
    setComposerTyping,
    setActiveThreadId,
    syncNow,
    threads,
    threadsLoading,
    typingParticipants,
    unreadCount,
  };
}
