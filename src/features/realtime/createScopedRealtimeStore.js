import { useEffect, useMemo, useState } from "react";

export const RECOVERY_POLL_MS = 3000;
export const RECONNECT_WATCHDOG_MS = 6000;

export function createRealtimeRuntime({
  params,
  createInitialState,
  isReady,
  getMissingIdentityMessage,
  syncSnapshot,
  connectChannel,
}) {
  let state = {
    ...createInitialState(params),
    loading: true,
    connectionState: "connecting",
    lastSyncedAt: null,
    error: "",
    lastEvent: null,
  };
  let retainCount = 0;
  let isStarted = false;
  let isSyncing = false;
  let needsResync = false;
  let forcedRestartCount = 0;
  let channelCleanup = null;
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
    if (!isStarted || !isReady(params)) {
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
        void runSync({ showLoading: false });
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
          restartChannel();
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

  async function runSync({ showLoading = false } = {}) {
    if (!isReady(params)) {
      setState((current) => ({
        ...current,
        loading: false,
        connectionState: "error",
        error: getMissingIdentityMessage?.(params) || "Missing realtime identity.",
      }));
      return getState();
    }

    if (isSyncing) {
      needsResync = true;
      return getState();
    }

    isSyncing = true;
    if (showLoading) {
      setState((current) => ({
        ...current,
        loading: true,
      }));
    }

    try {
      await syncSnapshot({
        params,
        getState,
        setState,
      });

      setState((current) => ({
        ...current,
        loading: false,
        error: "",
      }));
      return getState();
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        connectionState: current.connectionState === "live" ? "reconnecting" : "error",
        error: error?.message || "Unable to sync realtime data.",
      }));
      return getState();
    } finally {
      isSyncing = false;
      if (needsResync) {
        needsResync = false;
        void runSync({ showLoading: false });
      }
    }
  }

  function handleSubscribeStatus(status) {
    if (status === "SUBSCRIBED") {
      setState((current) => ({
        ...current,
        connectionState: "live",
      }));
      void runSync({ showLoading: false });
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

  function handleVisibilityBackfill() {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    setState((current) => ({
      ...current,
      connectionState: current.connectionState === "live" ? "live" : "reconnecting",
    }));
    void runSync({ showLoading: false });
  }

  function handleOnlineBackfill() {
    setState((current) => ({
      ...current,
      connectionState: current.connectionState === "live" ? "live" : "reconnecting",
    }));
    void runSync({ showLoading: false });
  }

  function stopChannel() {
    if (channelCleanup) {
      channelCleanup();
      channelCleanup = null;
    }
  }

  function restartChannel() {
    if (!isReady(params)) {
      return;
    }

    stopChannel();
    channelCleanup = connectChannel({
      params,
      getState,
      setState,
      syncNow: runSync,
      handleSubscribeStatus,
    });
  }

  function start() {
    if (isStarted || !isReady(params)) {
      return;
    }

    isStarted = true;
    setState((current) => ({
      ...current,
      connectionState: current.lastSyncedAt ? "reconnecting" : "connecting",
    }));
    void runSync({ showLoading: true });
    restartChannel();

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
    stopChannel();
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
    setState,
    syncNow: runSync,
  };
}

export function createScopedRealtimeStore({ getStoreKey, createStore }) {
  const storeRegistry = new Map();

  function getOrCreateStore(params) {
    const key = getStoreKey(params);
    if (!storeRegistry.has(key)) {
      storeRegistry.set(key, createStore(params));
    }
    return storeRegistry.get(key);
  }

  return function useScopedRealtimeStore(params) {
    const storeKey = getStoreKey(params);
    const store = useMemo(() => getOrCreateStore(params), [storeKey]);
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

    return {
      ...snapshot,
      syncNow: store.syncNow,
      ...store.actions,
    };
  };
}
