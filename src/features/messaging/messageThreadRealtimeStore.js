import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  MESSAGE_THREAD_SUMMARY_SELECT,
  applyMessageThreadScope,
  countUnreadThreads,
  sortThreads,
} from "./messageThreadUtils";

const RECOVERY_POLL_MS = 3000;
const RECONNECT_WATCHDOG_MS = 6000;
const storeRegistry = new Map();

function getStoreKey(currentRole, currentUserId) {
  return `${currentRole || "unknown"}:${currentUserId || "unknown"}`;
}

function getThreadRealtimeFilter(currentRole, currentUserId) {
  if (!currentRole || !currentUserId) return null;
  if (currentRole === "employee") return `employee_user_id=eq.${currentUserId}`;
  if (currentRole === "supervisor") return `supervisor_user_id=eq.${currentUserId}`;
  return null;
}

function isRelevantThreadForRole(thread, currentRole, currentUserId) {
  if (!thread || !currentRole || !currentUserId) return false;

  if (currentRole === "employee") {
    return thread.employee_user_id === currentUserId;
  }

  if (currentRole === "supervisor") {
    return thread.supervisor_user_id === currentUserId;
  }

  if (currentRole === "admin") {
    return !thread.supervisor_user_id || thread.escalated_to_admin;
  }

  return false;
}

function buildNextThreads(currentThreads, nextThread) {
  const withoutThread = currentThreads.filter((thread) => thread.id !== nextThread.id);
  return sortThreads([...withoutThread, nextThread]);
}

function mergeThreadRow(currentThread, nextThread) {
  if (!currentThread) return nextThread;

  return {
    ...currentThread,
    ...nextThread,
    employee: nextThread.employee || currentThread.employee || null,
    supervisor: nextThread.supervisor || currentThread.supervisor || null,
    read_states: nextThread.read_states || currentThread.read_states || [],
  };
}

function createRealtimeStore({ currentRole, currentUserId }) {
  let state = {
    threads: [],
    threadsLoading: true,
    connectionState: "connecting",
    lastSyncedAt: null,
    error: "",
  };
  let retainCount = 0;
  let isStarted = false;
  let isSyncing = false;
  let needsResync = false;
  let forcedRestartCount = 0;
  let channel = null;
  let cleanupHandlers = [];
  let recoveryPollInterval = null;
  let reconnectWatchdog = null;
  const listeners = new Set();

  function emit() {
    listeners.forEach((listener) => listener(state));
  }

  function clearRecoveryPolling() {
    if (recoveryPollInterval) {
      window.clearInterval(recoveryPollInterval);
      recoveryPollInterval = null;
    }
  }

  function clearReconnectWatchdog() {
    if (reconnectWatchdog) {
      window.clearTimeout(reconnectWatchdog);
      reconnectWatchdog = null;
    }
  }

  function syncRecoveryTools() {
    if (!isStarted || !supabase || !currentRole || !currentUserId) {
      clearRecoveryPolling();
      clearReconnectWatchdog();
      return;
    }

    if (state.connectionState === "live") {
      forcedRestartCount = 0;
      clearRecoveryPolling();
      clearReconnectWatchdog();
      return;
    }

    if (!recoveryPollInterval && typeof window !== "undefined") {
      recoveryPollInterval = window.setInterval(() => {
        void syncThreads({ showLoading: false });
      }, RECOVERY_POLL_MS);
    }

    if (
      (state.connectionState === "connecting" || state.connectionState === "reconnecting") &&
      !reconnectWatchdog &&
      typeof window !== "undefined"
    ) {
      reconnectWatchdog = window.setTimeout(() => {
        reconnectWatchdog = null;

        if (!isStarted || state.connectionState === "live") {
          return;
        }

        if (forcedRestartCount === 0) {
          forcedRestartCount = 1;
          setState((current) => ({
            ...current,
            connectionState: "connecting",
          }));
          connectChannel();
          return;
        }

        setState((current) => ({
          ...current,
          connectionState: "error",
        }));
      }, RECONNECT_WATCHDOG_MS);
    }

    if (state.connectionState === "error") {
      clearReconnectWatchdog();
    }
  }

  function setState(nextStateOrUpdater) {
    state =
      typeof nextStateOrUpdater === "function"
        ? nextStateOrUpdater(state)
        : {
            ...state,
            ...nextStateOrUpdater,
          };

    syncRecoveryTools();
    emit();
  }

  function getState() {
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function applyThreadRow(nextThread) {
    if (!nextThread?.id) return;

    if (!isRelevantThreadForRole(nextThread, currentRole, currentUserId)) {
      setState((current) => ({
        ...current,
        threads: current.threads.filter((thread) => thread.id !== nextThread.id),
        lastSyncedAt: new Date().toISOString(),
      }));
      return;
    }

    setState((current) => ({
      ...current,
      threads: buildNextThreads(
        current.threads,
        mergeThreadRow(
          current.threads.find((thread) => thread.id === nextThread.id) || null,
          nextThread
        )
      ),
      lastSyncedAt: new Date().toISOString(),
    }));
  }

  function removeThread(threadId) {
    if (!threadId) return;

    setState((current) => ({
      ...current,
      threads: current.threads.filter((thread) => thread.id !== threadId),
      lastSyncedAt: new Date().toISOString(),
    }));
  }

  function applyReadStateRow(nextReadState) {
    if (!nextReadState?.thread_id || !nextReadState.user_id) return;

    setState((current) => ({
      ...current,
      threads: current.threads.map((thread) =>
        thread.id === nextReadState.thread_id
          ? {
              ...thread,
              read_states: [
                ...(thread.read_states || []).filter((row) => row.user_id !== nextReadState.user_id),
                nextReadState,
              ],
            }
          : thread
      ),
      lastSyncedAt: new Date().toISOString(),
    }));
  }

  function removeReadState(nextReadState) {
    if (!nextReadState?.thread_id || !nextReadState.user_id) return;

    setState((current) => ({
      ...current,
      threads: current.threads.map((thread) =>
        thread.id === nextReadState.thread_id
          ? {
              ...thread,
              read_states: (thread.read_states || []).filter((row) => row.user_id !== nextReadState.user_id),
            }
          : thread
      ),
      lastSyncedAt: new Date().toISOString(),
    }));
  }

  async function syncThreads({ showLoading = false } = {}) {
    if (!currentRole || !currentUserId || !supabase) {
      setState({
        threads: [],
        threadsLoading: false,
        connectionState: "error",
        lastSyncedAt: state.lastSyncedAt,
        error: "Missing realtime identity.",
      });
      return [];
    }

    if (isSyncing) {
      needsResync = true;
      return state.threads;
    }

    isSyncing = true;
    if (showLoading) {
      setState((current) => ({
        ...current,
        threadsLoading: true,
      }));
    }

    try {
      const baseQuery = supabase.from("message_threads").select(MESSAGE_THREAD_SUMMARY_SELECT);
      const scopedQuery = applyMessageThreadScope(baseQuery, { currentRole, currentUserId }).order("last_message_at", {
        ascending: false,
        nullsFirst: false,
      });
      const { data, error } = await scopedQuery;

      if (error) {
        setState((current) => ({
          ...current,
          threadsLoading: false,
          connectionState: current.connectionState === "live" ? "reconnecting" : "error",
          error: error.message || "Unable to sync threads.",
        }));
        return state.threads;
      }

      const nextTimestamp = new Date().toISOString();
      const nextThreads = sortThreads(data ?? []);
      setState((current) => ({
        ...current,
        threads: nextThreads,
        threadsLoading: false,
        lastSyncedAt: nextTimestamp,
        error: "",
      }));
      return nextThreads;
    } finally {
      isSyncing = false;
      if (needsResync) {
        needsResync = false;
        void syncThreads({ showLoading: false });
      }
    }
  }

  function applyLocalReadState(threadId, nextReadState) {
    if (!threadId || !nextReadState) return;
    applyReadStateRow({
      thread_id: threadId,
      user_id: currentUserId,
      ...nextReadState,
    });
  }

  function patchThreadActivity(threadId, { body, createdAt, senderUserId }) {
    if (!threadId) return;

    setState((current) => ({
      ...current,
      threads: sortThreads(
        current.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                last_message_at: createdAt || thread.last_message_at,
                last_message_sender_user_id: senderUserId || thread.last_message_sender_user_id,
                last_message_preview: body?.slice(0, 140) || thread.last_message_preview,
                status: "open",
              }
            : thread
        )
      ),
    }));
  }

  function handleSubscribeStatus(status) {
    if (status === "SUBSCRIBED") {
      setState((current) => ({
        ...current,
        connectionState: "live",
      }));
      void syncThreads({ showLoading: false });
      return;
    }

    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      setState((current) => ({
        ...current,
        connectionState: "reconnecting",
      }));
      return;
    }

    setState((current) => ({
      ...current,
      connectionState: "connecting",
    }));
  }

  function connectChannel() {
    if (!supabase || !currentRole || !currentUserId) return;

    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }

    const threadSubscriptionConfig = {
      event: "*",
      schema: "public",
      table: "message_threads",
    };
    const threadRealtimeFilter = getThreadRealtimeFilter(currentRole, currentUserId);
    if (threadRealtimeFilter) {
      threadSubscriptionConfig.filter = threadRealtimeFilter;
    }

    channel = supabase
      .channel(`message-thread-store-${currentRole}-${currentUserId}`)
      .on("postgres_changes", threadSubscriptionConfig, (payload) => {
        if (payload.eventType === "DELETE") {
          removeThread(payload.old?.id);
          return;
        }

        applyThreadRow(payload.new);
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_read_states",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            removeReadState(payload.old);
            return;
          }

          applyReadStateRow(payload.new);
        }
      )
      .subscribe(handleSubscribeStatus);
  }

  function handleVisibilityBackfill() {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    setState((current) => ({
      ...current,
      connectionState: current.connectionState === "live" ? "live" : "reconnecting",
    }));
    void syncThreads({ showLoading: false });
  }

  function handleOnlineBackfill() {
    setState((current) => ({
      ...current,
      connectionState: current.connectionState === "live" ? "live" : "reconnecting",
    }));
    void syncThreads({ showLoading: false });
  }

  function start() {
    if (isStarted || !currentRole || !currentUserId || !supabase) return;

    isStarted = true;
    setState((current) => ({
      ...current,
      connectionState: current.lastSyncedAt ? "reconnecting" : "connecting",
    }));
    void syncThreads({ showLoading: true });
    connectChannel();

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnlineBackfill);
      cleanupHandlers.push(() => window.removeEventListener("online", handleOnlineBackfill));
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityBackfill);
      cleanupHandlers.push(() => document.removeEventListener("visibilitychange", handleVisibilityBackfill));
    }
  }

  function stop() {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }

    cleanupHandlers.forEach((cleanup) => cleanup());
    cleanupHandlers = [];
    clearRecoveryPolling();
    clearReconnectWatchdog();
    isStarted = false;
  }

  return {
    acquire() {
      retainCount += 1;
      start();
    },
    release() {
      retainCount = Math.max(0, retainCount - 1);
      if (retainCount === 0) {
        stop();
      }
    },
    getState,
    subscribe,
    syncThreads,
    applyLocalReadState,
    patchThreadActivity,
  };
}

function getOrCreateStore({ currentRole, currentUserId }) {
  const key = getStoreKey(currentRole, currentUserId);
  if (!storeRegistry.has(key)) {
    storeRegistry.set(key, createRealtimeStore({ currentRole, currentUserId }));
  }
  return storeRegistry.get(key);
}

export function useMessageThreadRealtime({ currentRole, currentUserId }) {
  const store = useMemo(() => getOrCreateStore({ currentRole, currentUserId }), [currentRole, currentUserId]);
  const [snapshot, setSnapshot] = useState(() => store.getState());

  useEffect(() => {
    setSnapshot(store.getState());
    return store.subscribe(setSnapshot);
  }, [store]);

  useEffect(() => {
    store.acquire();
    return () => {
      store.release();
    };
  }, [store]);

  const unreadCount = useMemo(() => countUnreadThreads(snapshot.threads, currentUserId), [currentUserId, snapshot.threads]);

  return {
    ...snapshot,
    unreadCount,
    syncNow: store.syncThreads,
    applyLocalReadState: store.applyLocalReadState,
    patchThreadActivity: store.patchThreadActivity,
  };
}
