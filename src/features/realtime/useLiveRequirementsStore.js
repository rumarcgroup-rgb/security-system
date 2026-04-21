import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { attachSignedUrls } from "../../lib/storage";
import { matchesSupervisorScope } from "../../lib/supervisorScope";
import { createRealtimeRuntime, createScopedRealtimeStore } from "./createScopedRealtimeStore";

const DOCUMENT_SELECT = `
  id,
  user_id,
  document_type,
  file_url,
  review_status,
  created_at,
  profiles:profiles!employee_documents_user_id_profile_fkey(id, full_name, employee_id, location, branch, supervisor_user_id)
`;

const PROFILE_SIGNATURE_SELECT = `
  id,
  full_name,
  employee_id,
  location,
  branch,
  supervisor_user_id,
  signature_url,
  signature_status,
  created_at
`;

function sortRequirementRows(rows = []) {
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

function isRelevantRequirementRow(row, { currentRole, currentUserId, scopeProfile }) {
  if (!row) return false;

  if (currentRole === "employee") {
    return row.user_id === currentUserId;
  }

  if (currentRole === "supervisor") {
    return matchesSupervisorScope(row, scopeProfile);
  }

  return true;
}

function normalizeDocumentRow(row) {
  return {
    ...row,
    requirement_type: row.document_type,
    status: row.review_status || "Pending Review",
    source_table: "employee_documents",
  };
}

function normalizeSignatureRow(profile) {
  return {
    id: `signature-${profile.id}`,
    user_id: profile.id,
    document_type: "Signature",
    requirement_type: "Signature",
    file_url: profile.signature_url,
    created_at: profile.created_at,
    status: profile.signature_status || "Pending Review",
    source_table: "profiles",
    profiles: {
      id: profile.id,
      full_name: profile.full_name,
      employee_id: profile.employee_id,
      location: profile.location,
      branch: profile.branch,
      supervisor_user_id: profile.supervisor_user_id,
    },
  };
}

async function fetchDocumentRows(params, { userId = null } = {}) {
  let query = supabase.from("employee_documents").select(DOCUMENT_SELECT).order("created_at", { ascending: false });

  if (params.currentRole === "employee") {
    query = query.eq("user_id", params.currentUserId);
  }

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const withSignedUrls = await attachSignedUrls((data ?? []).map(normalizeDocumentRow), "documents");
  return sortRequirementRows(withSignedUrls.filter((row) => isRelevantRequirementRow(row, params)));
}

async function fetchSignatureRows(params, { userId = null } = {}) {
  let query = supabase.from("profiles").select(PROFILE_SIGNATURE_SELECT).order("created_at", { ascending: false });

  if (params.currentRole === "employee") {
    query = query.eq("id", params.currentUserId);
  }

  if (userId) {
    query = query.eq("id", userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const signatureRows = (data ?? []).filter((profile) => profile.signature_url).map(normalizeSignatureRow);
  const withSignedUrls = await attachSignedUrls(signatureRows, "documents");
  return sortRequirementRows(withSignedUrls.filter((row) => isRelevantRequirementRow(row, params)));
}

async function fetchDocumentRowById(rowId, params) {
  if (!rowId) return null;

  const { data, error } = await supabase.from("employee_documents").select(DOCUMENT_SELECT).eq("id", rowId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [withSignedUrl] = await attachSignedUrls([normalizeDocumentRow(data)], "documents");
  return isRelevantRequirementRow(withSignedUrl, params) ? withSignedUrl : null;
}

async function fetchSignatureRowByUserId(userId, params) {
  if (!userId) return null;

  const { data, error } = await supabase.from("profiles").select(PROFILE_SIGNATURE_SELECT).eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data?.signature_url) return null;

  const [withSignedUrl] = await attachSignedUrls([normalizeSignatureRow(data)], "documents");
  return isRelevantRequirementRow(withSignedUrl, params) ? withSignedUrl : null;
}

function buildLastEvent({ eventType, previousRow = null, nextRow = null }) {
  return {
    table: nextRow?.source_table === "profiles" ? "profiles" : "employee_documents",
    eventType,
    rowId: nextRow?.id || previousRow?.id || null,
    row: nextRow,
    previousRow,
    occurredAt: new Date().toISOString(),
  };
}

function maybeToastRequirementEvent({ currentRole, eventType, previousRow, nextRow }) {
  if (!nextRow) return;

  if (eventType === "INSERT" && !previousRow) {
    if (currentRole === "employee") {
      toast.success(`${nextRow.requirement_type} uploaded and waiting for review.`);
      return;
    }

    toast.success(nextRow.requirement_type === "Signature" ? "New signature received." : "New requirement received.");
    return;
  }

  if (eventType === "UPDATE" && previousRow?.status !== nextRow.status) {
    if (currentRole === "employee") {
      toast.success(`${nextRow.requirement_type} ${String(nextRow.status || "updated").toLowerCase()}.`);
      return;
    }

    toast.success(
      `${nextRow.profiles?.full_name || "Employee"} ${nextRow.requirement_type} ${String(nextRow.status || "updated").toLowerCase()}.`
    );
  }
}

function createRequirementsStore(params) {
  const runtime = createRealtimeRuntime({
    params,
    createInitialState: () => ({
      rows: [],
    }),
    isReady: ({ currentRole, currentUserId }) => Boolean(currentRole && currentUserId),
    getMissingIdentityMessage: () => "Missing requirements realtime identity.",
    async syncSnapshot({ setState }) {
      const [documentRows, signatureRows] = await Promise.all([fetchDocumentRows(params), fetchSignatureRows(params)]);
      setState((current) => ({
        ...current,
        rows: sortRequirementRows([...documentRows, ...signatureRows]),
        lastSyncedAt: new Date().toISOString(),
      }));
    },
    connectChannel({ handleSubscribeStatus }) {
      const documentSubscription = {
        event: "*",
        schema: "public",
        table: "employee_documents",
      };
      const profileSubscription = {
        event: "*",
        schema: "public",
        table: "profiles",
      };

      if (params.currentRole === "employee" && params.currentUserId) {
        documentSubscription.filter = `user_id=eq.${params.currentUserId}`;
        profileSubscription.filter = `id=eq.${params.currentUserId}`;
      }

      const channel = supabase
        .channel(`live-requirements-store-${getScopeKey(params)}`)
        .on("postgres_changes", documentSubscription, (payload) => {
          if (payload.eventType === "DELETE") {
            removeRow(payload.old?.id, {
              lastEvent: buildLastEvent({
                eventType: "DELETE",
                previousRow: runtime.getState().rows.find((row) => row.id === payload.old?.id) || null,
              }),
            });
            return;
          }

          void syncDocumentById(payload.new?.id, {
            eventType: payload.eventType,
            emitLastEvent: true,
            emitToast: true,
          });
        })
        .on("postgres_changes", profileSubscription, (payload) => {
          const userId = payload.new?.id || payload.old?.id;
          void syncSignatureByUserId(userId, {
            eventType: payload.eventType,
            emitLastEvent: true,
            emitToast: true,
          });
          void syncDocumentsByUserId(userId);
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
      rows: sortRequirementRows([nextRow, ...current.rows.filter((row) => row.id !== nextRow.id)]),
      lastSyncedAt: new Date().toISOString(),
      lastEvent,
    }));
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
      rows: sortRequirementRows(
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

  async function syncDocumentById(rowId, { eventType = "UPDATE", emitLastEvent = false, emitToast = false } = {}) {
    if (!rowId) return null;

    const previousRow = runtime.getState().rows.find((row) => row.id === rowId) || null;
    const nextRow = await fetchDocumentRowById(rowId, params);

    if (!nextRow) {
      if (previousRow) {
        removeRow(rowId, {
          lastEvent: emitLastEvent ? buildLastEvent({ eventType: "DELETE", previousRow }) : null,
        });
      }
      return null;
    }

    if (emitToast) {
      maybeToastRequirementEvent({
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

  async function syncSignatureByUserId(userId, { eventType = "UPDATE", emitLastEvent = false, emitToast = false } = {}) {
    if (!userId) return null;

    const signatureRowId = `signature-${userId}`;
    const previousRow = runtime.getState().rows.find((row) => row.id === signatureRowId) || null;
    const nextRow = await fetchSignatureRowByUserId(userId, params);

    if (!nextRow) {
      if (previousRow) {
        removeRow(signatureRowId, {
          lastEvent: emitLastEvent ? buildLastEvent({ eventType: "DELETE", previousRow }) : null,
        });
      }
      return null;
    }

    if (emitToast) {
      maybeToastRequirementEvent({
        currentRole: params.currentRole,
        eventType: previousRow ? "UPDATE" : "INSERT",
        previousRow,
        nextRow,
      });
    }

    upsertRow(nextRow, {
      lastEvent: emitLastEvent
        ? buildLastEvent({
            eventType: previousRow ? "UPDATE" : "INSERT",
            previousRow,
            nextRow,
          })
        : null,
    });
    return nextRow;
  }

  async function syncDocumentsByUserId(userId) {
    if (!userId) return;

    const nextRowsForUser = await fetchDocumentRows(params, { userId });

    runtime.setState((current) => ({
      ...current,
      rows: sortRequirementRows([
        ...current.rows.filter((row) => row.source_table !== "employee_documents" || row.user_id !== userId),
        ...nextRowsForUser,
      ]),
      lastSyncedAt: new Date().toISOString(),
    }));
  }

  return {
    ...runtime,
    actions: {
      upsertRow,
      removeRow,
      patchRowsByIds,
      syncDocumentById,
      syncSignatureByUserId,
      syncDocumentsByUserId,
    },
  };
}

export const useLiveRequirementsStore = createScopedRealtimeStore({
  getStoreKey: getScopeKey,
  createStore: createRequirementsStore,
});
