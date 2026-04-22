import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { attachSignedUrls } from "../../lib/storage";
import { matchesSupervisorScope } from "../../lib/supervisorScope";
import { createRealtimeRuntime, createScopedRealtimeStore } from "./createScopedRealtimeStore";

const DTR_SELECT = `
  id,
  user_id,
  cutoff,
  selected_dtr_date,
  employee_note,
  admin_remarks,
  file_url,
  status,
  approved_at,
  created_at,
  submitted_by_role,
  submitted_by_user_id,
  profiles:profiles!dtr_submissions_user_id_profile_fkey(full_name, role, employee_id, location, branch, supervisor_user_id)
`;

function sortDtrRows(rows = []) {
  return [...rows].sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
}

function getScopeKey({ currentRole, currentUserId, scopeProfile }) {
  return [
    currentRole || "unknown",
    currentUserId || "unknown",
    scopeProfile?.location || "",
    scopeProfile?.branch || "",
  ].join(":");
}

function getRealtimeFilter({ currentRole, currentUserId }) {
  if (!currentRole || !currentUserId) return null;
  if (currentRole === "employee") return `user_id=eq.${currentUserId}`;
  return null;
}

function isRelevantDtrRow(row, { currentRole, currentUserId, scopeProfile }) {
  if (!row) return false;

  if (currentRole === "employee") {
    return row.user_id === currentUserId;
  }

  if (currentRole === "supervisor") {
    return matchesSupervisorScope(row, scopeProfile);
  }

  return true;
}

async function fetchDtrRows(params, { userId = null } = {}) {
  let query = supabase.from("dtr_submissions").select(DTR_SELECT).order("created_at", { ascending: false });

  if (params.currentRole === "employee") {
    query = query.eq("user_id", params.currentUserId);
  }

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const withSignedUrls = await attachSignedUrls(data ?? [], "dtr-images");
  return sortDtrRows(withSignedUrls.filter((row) => isRelevantDtrRow(row, params)));
}

async function fetchDtrRowById(rowId, params) {
  if (!rowId) return null;

  const { data, error } = await supabase.from("dtr_submissions").select(DTR_SELECT).eq("id", rowId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [withSignedUrl] = await attachSignedUrls([data], "dtr-images");
  return isRelevantDtrRow(withSignedUrl, params) ? withSignedUrl : null;
}

function buildLastEvent({ eventType, previousRow = null, nextRow = null }) {
  return {
    table: "dtr_submissions",
    eventType,
    rowId: nextRow?.id || previousRow?.id || null,
    row: nextRow,
    previousRow,
    occurredAt: new Date().toISOString(),
  };
}

function maybeToastDtrEvent({ currentRole, eventType, previousRow, nextRow }) {
  if (!nextRow) return;

  if (eventType === "INSERT" && !previousRow) {
    if (currentRole === "employee") {
      const sourceLabel = nextRow.submitted_by_role === "supervisor" ? "Supervisor submitted" : "DTR submitted";
      toast.success(`${sourceLabel} for ${nextRow.cutoff || "the selected cutoff"}.`);
      return;
    }

    toast.success("New DTR received.");
    return;
  }

  if (eventType === "UPDATE" && previousRow?.status !== nextRow.status) {
    if (currentRole === "employee") {
      toast.success(`DTR ${String(nextRow.status || "updated").toLowerCase()} for ${nextRow.cutoff || "your cutoff"}.`);
      return;
    }

    toast.success(`${nextRow.profiles?.full_name || "Employee"} DTR ${String(nextRow.status || "updated").toLowerCase()}.`);
  }
}

function createDtrStore(params) {
  const runtime = createRealtimeRuntime({
    params,
    createInitialState: () => ({
      rows: [],
    }),
    isReady: ({ currentRole, currentUserId }) => Boolean(currentRole && currentUserId),
    getMissingIdentityMessage: () => "Missing DTR realtime identity.",
    async syncSnapshot({ setState }) {
      const rows = await fetchDtrRows(params);
      setState((current) => ({
        ...current,
        rows,
        lastSyncedAt: new Date().toISOString(),
      }));
    },
    connectChannel({ handleSubscribeStatus }) {
      const dtrSubscription = {
        event: "*",
        schema: "public",
        table: "dtr_submissions",
      };
      const dtrFilter = getRealtimeFilter(params);
      if (dtrFilter) {
        dtrSubscription.filter = dtrFilter;
      }

      const profileSubscription = {
        event: "*",
        schema: "public",
        table: "profiles",
      };
      if (params.currentRole === "employee" && params.currentUserId) {
        profileSubscription.filter = `id=eq.${params.currentUserId}`;
      }

      const channel = supabase
        .channel(`live-dtr-store-${getScopeKey(params)}`)
        .on("postgres_changes", dtrSubscription, (payload) => {
          if (payload.eventType === "DELETE") {
            removeRow(payload.old?.id, {
              lastEvent: buildLastEvent({
                eventType: "DELETE",
                previousRow: runtime.getState().rows.find((row) => row.id === payload.old?.id) || null,
              }),
            });
            return;
          }

          void syncRowById(payload.new?.id, {
            eventType: payload.eventType,
            emitLastEvent: true,
            emitToast: true,
          });
        })
        .on("postgres_changes", profileSubscription, (payload) => {
          const userId = payload.new?.id || payload.old?.id;
          void syncRowsByUserId(userId);
        })
        .subscribe(handleSubscribeStatus);

      return () => {
        supabase.removeChannel(channel);
      };
    },
  });

  function upsertRow(nextRow, { lastEvent = null } = {}) {
    if (!nextRow?.id) return;

    runtime.setState((current) => ({
      ...current,
      rows: sortDtrRows([nextRow, ...current.rows.filter((row) => row.id !== nextRow.id)]),
      lastSyncedAt: new Date().toISOString(),
      lastEvent,
    }));
  }

  function upsertRows(nextRows = []) {
    if (!nextRows.length) return;

    runtime.setState((current) => {
      const nextMap = new Map(current.rows.map((row) => [row.id, row]));
      nextRows.forEach((row) => {
        if (row?.id) {
          nextMap.set(row.id, row);
        }
      });

      return {
        ...current,
        rows: sortDtrRows(Array.from(nextMap.values())),
        lastSyncedAt: new Date().toISOString(),
      };
    });
  }

  function removeRow(rowId, { lastEvent = null } = {}) {
    if (!rowId) return;

    runtime.setState((current) => ({
      ...current,
      rows: current.rows.filter((row) => row.id !== rowId),
      lastSyncedAt: new Date().toISOString(),
      lastEvent,
    }));
  }

  function patchRowsByIds(rowIds = [], patch) {
    const idSet = new Set(rowIds.filter(Boolean));
    if (!idSet.size) return;

    runtime.setState((current) => ({
      ...current,
      rows: sortDtrRows(
        current.rows.map((row) =>
          idSet.has(row.id)
            ? {
                ...row,
                ...(typeof patch === "function" ? patch(row) : patch),
              }
            : row
        )
      ),
      lastSyncedAt: new Date().toISOString(),
    }));
  }

  async function syncRowById(rowId, { eventType = "UPDATE", emitLastEvent = false, emitToast = false } = {}) {
    if (!rowId) return null;

    const previousRow = runtime.getState().rows.find((row) => row.id === rowId) || null;
    const nextRow = await fetchDtrRowById(rowId, params);

    if (!nextRow) {
      if (previousRow) {
        removeRow(rowId, {
          lastEvent: emitLastEvent ? buildLastEvent({ eventType: "DELETE", previousRow }) : null,
        });
      }
      return null;
    }

    if (emitToast) {
      maybeToastDtrEvent({
        currentRole: params.currentRole,
        eventType,
        previousRow,
        nextRow,
      });
    }

    upsertRow(nextRow, {
      lastEvent: emitLastEvent ? buildLastEvent({ eventType, previousRow, nextRow }) : null,
    });
    return nextRow;
  }

  async function syncRowsByUserId(userId) {
    if (!userId) return;

    const nextRowsForUser = await fetchDtrRows(params, { userId });

    runtime.setState((current) => ({
      ...current,
      rows: sortDtrRows([
        ...current.rows.filter((row) => row.user_id !== userId),
        ...nextRowsForUser,
      ]),
      lastSyncedAt: new Date().toISOString(),
    }));
  }

  return {
    ...runtime,
    actions: {
      upsertRow,
      upsertRows,
      removeRow,
      patchRowsByIds,
      syncRowById,
      syncRowsByUserId,
    },
  };
}

export const useLiveDtrStore = createScopedRealtimeStore({
  getStoreKey: getScopeKey,
  createStore: createDtrStore,
});
