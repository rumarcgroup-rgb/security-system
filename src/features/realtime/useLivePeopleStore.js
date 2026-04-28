import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { attachSignedUrls } from "../../lib/storage";
import { isScopedEmployee } from "../../lib/supervisorScope";
import { isSuperAdminRole } from "../../lib/roles";
import { createRealtimeRuntime, createScopedRealtimeStore } from "./createScopedRealtimeStore";

const PROFILE_REQUEST_SELECT = `
  id,
  user_id,
  requested_full_name,
  requested_avatar_url,
  requested_birthday,
  requested_age,
  requested_gender,
  requested_civil_status,
  requested_sss,
  requested_philhealth,
  requested_pagibig,
  requested_tin,
  status,
  created_at,
  reviewed_at,
  profiles:profiles!profile_change_requests_user_id_profile_fkey(
    full_name,
    employee_id,
    location,
    avatar_url,
    birthday,
    age,
    gender,
    civil_status,
    sss,
    philhealth,
    pagibig,
    tin
  )
`;

function getScopeKey({ currentRole, currentUserId, scopeProfile }) {
  return [
    currentRole || "unknown",
    currentUserId || "unknown",
    scopeProfile?.location || "",
    scopeProfile?.branch || "",
  ].join(":");
}

function sortProfiles(rows = []) {
  return [...rows].sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
}

function sortProfileRequests(rows = []) {
  return [...rows].sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
}

function isRelevantProfile(profile, { currentRole, currentUserId, scopeProfile }) {
  if (!profile) return false;

  if (currentRole === "employee") {
    return profile.id === currentUserId;
  }

  if (currentRole === "supervisor") {
    return isScopedEmployee(profile, scopeProfile);
  }

  return true;
}

function isRelevantProfileRequest(request, { currentRole, currentUserId }) {
  if (!request) return false;

  if (currentRole === "employee") {
    return request.user_id === currentUserId;
  }

  if (currentRole === "supervisor") {
    return false;
  }

  return true;
}

async function fetchPresenceMap({ userIds = null, currentRole, currentUserId }) {
  let query = supabase.from("employee_presence").select("user_id,last_seen_at");

  if (currentRole === "employee" && currentUserId) {
    query = query.eq("user_id", currentUserId);
  }

  if (userIds?.length) {
    query = query.in("user_id", userIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.user_id, row.last_seen_at]));
}

async function fetchProfiles(params, { profileId = null } = {}) {
  let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });

  if (params.currentRole === "employee") {
    query = query.eq("id", params.currentUserId);
  }

  if (profileId) {
    query = query.eq("id", profileId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const filtered = (data ?? []).filter((profile) => isRelevantProfile(profile, params));
  if (!filtered.length) {
    return [];
  }

  const presenceMap = await fetchPresenceMap({
    currentRole: params.currentRole,
    currentUserId: params.currentUserId,
    userIds: filtered.map((profile) => profile.id),
  });
  const withSignedAvatars = await attachSignedUrls(filtered, "documents", "avatar_url");

  return sortProfiles(
    withSignedAvatars.map((profile) => ({
      ...profile,
      last_seen_at: presenceMap.get(profile.id) ?? null,
    }))
  );
}

async function fetchProfileById(profileId, params) {
  if (!profileId) return null;

  const [profiles, presenceMap] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).maybeSingle(),
    fetchPresenceMap({
      currentRole: params.currentRole,
      currentUserId: params.currentUserId,
      userIds: [profileId],
    }),
  ]);

  if (profiles.error) throw profiles.error;
  if (!profiles.data || !isRelevantProfile(profiles.data, params)) return null;

  const [withSignedAvatar] = await attachSignedUrls([profiles.data], "documents", "avatar_url");
  return {
    ...withSignedAvatar,
    last_seen_at: presenceMap.get(profileId) ?? null,
  };
}

async function fetchProfileRequests(params, { requestId = null, userId = null } = {}) {
  if (params.currentRole === "supervisor" || !isSuperAdminRole(params.scopeProfile?.role)) {
    return [];
  }

  let query = supabase.from("profile_change_requests").select(PROFILE_REQUEST_SELECT).order("created_at", { ascending: false });

  if (params.currentRole === "employee") {
    query = query.eq("user_id", params.currentUserId);
  }

  if (requestId) {
    query = query.eq("id", requestId);
  }

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const withSignedRequestedAvatars = await attachSignedUrls(data ?? [], "documents", "requested_avatar_url");
  return sortProfileRequests(withSignedRequestedAvatars.filter((request) => isRelevantProfileRequest(request, params)));
}

async function fetchProfileRequestById(requestId, params) {
  if (!requestId || params.currentRole === "supervisor" || !isSuperAdminRole(params.scopeProfile?.role)) return null;

  const { data, error } = await supabase
    .from("profile_change_requests")
    .select(PROFILE_REQUEST_SELECT)
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !isRelevantProfileRequest(data, params)) return null;

  const [withSignedRequestedAvatar] = await attachSignedUrls([data], "documents", "requested_avatar_url");
  return withSignedRequestedAvatar;
}

function buildLastEvent({ table, eventType, previousRow = null, nextRow = null }) {
  return {
    table,
    eventType,
    rowId: nextRow?.id || previousRow?.id || null,
    row: nextRow,
    previousRow,
    occurredAt: new Date().toISOString(),
  };
}

function maybeToastProfileEvent({ currentRole, currentUserId, eventType, previousRow, nextRow }) {
  if (!nextRow) return;

  if (eventType === "INSERT" && !previousRow && currentRole === "admin") {
    toast.success("New employee record added.");
    return;
  }

  const roleChanged = previousRow?.role !== nextRow.role;
  const assignmentChanged =
    previousRow?.location !== nextRow.location ||
    previousRow?.branch !== nextRow.branch ||
    previousRow?.supervisor_user_id !== nextRow.supervisor_user_id;

  if (!roleChanged && !assignmentChanged) return;

  if (currentRole === "employee" && nextRow.id === currentUserId) {
    toast.success("Your assignment was updated.");
    return;
  }

  if (roleChanged) {
    toast.success(`${nextRow.full_name || "Employee"} role updated to ${nextRow.role}.`);
    return;
  }

  toast.success(`${nextRow.full_name || "Employee"} assignment updated.`);
}

function maybeToastProfileRequestEvent({ currentRole, eventType, previousRow, nextRow }) {
  if (!nextRow) return;

  if (eventType === "INSERT" && !previousRow) {
    if (currentRole === "employee") {
      toast.success("Profile request submitted.");
      return;
    }

    toast.success("New profile request received.");
    return;
  }

  if (eventType === "UPDATE" && previousRow?.status !== nextRow.status) {
    if (currentRole === "employee") {
      toast.success(`Profile request ${String(nextRow.status || "updated").toLowerCase()}.`);
      return;
    }

    toast.success(`${nextRow.profiles?.full_name || "Employee"} profile request ${String(nextRow.status || "updated").toLowerCase()}.`);
  }
}

function createPeopleStore(params) {
  const runtime = createRealtimeRuntime({
    params,
    createInitialState: () => ({
      profiles: [],
      profileRequests: [],
    }),
    isReady: ({ currentRole, currentUserId }) => Boolean(currentRole && currentUserId),
    getMissingIdentityMessage: () => "Missing people realtime identity.",
    async syncSnapshot({ setState }) {
      const [profiles, profileRequests] = await Promise.all([fetchProfiles(params), fetchProfileRequests(params)]);
      setState((current) => ({
        ...current,
        profiles,
        profileRequests,
        lastSyncedAt: new Date().toISOString(),
      }));
    },
    connectChannel({ handleSubscribeStatus }) {
      const profileSubscription = {
        event: "*",
        schema: "public",
        table: "profiles",
      };
      const presenceSubscription = {
        event: "*",
        schema: "public",
        table: "employee_presence",
      };

      if (params.currentRole === "employee" && params.currentUserId) {
        profileSubscription.filter = `id=eq.${params.currentUserId}`;
        presenceSubscription.filter = `user_id=eq.${params.currentUserId}`;
      }

      let channel = supabase
        .channel(`live-people-store-${getScopeKey(params)}`)
        .on("postgres_changes", profileSubscription, (payload) => {
          if (payload.eventType === "DELETE") {
            removeProfile(payload.old?.id, {
              lastEvent: buildLastEvent({
                table: "profiles",
                eventType: "DELETE",
                previousRow: runtime.getState().profiles.find((profile) => profile.id === payload.old?.id) || null,
              }),
            });
            return;
          }

          const profileId = payload.new?.id;
          void syncProfileById(profileId, {
            eventType: payload.eventType,
            emitLastEvent: true,
            emitToast: true,
          });
          void syncProfileRequestsByUserId(profileId);
        })
        .on("postgres_changes", presenceSubscription, (payload) => {
          if (payload.eventType === "DELETE") {
            applyPresenceRow({
              user_id: payload.old?.user_id,
              last_seen_at: null,
            });
            return;
          }

          applyPresenceRow(payload.new);
        });

      if (params.currentRole !== "supervisor" && isSuperAdminRole(params.scopeProfile?.role)) {
        const requestSubscription = {
          event: "*",
          schema: "public",
          table: "profile_change_requests",
        };

        if (params.currentRole === "employee" && params.currentUserId) {
          requestSubscription.filter = `user_id=eq.${params.currentUserId}`;
        }

        channel = channel.on("postgres_changes", requestSubscription, (payload) => {
          if (payload.eventType === "DELETE") {
            removeProfileRequest(payload.old?.id, {
              lastEvent: buildLastEvent({
                table: "profile_change_requests",
                eventType: "DELETE",
                previousRow: runtime.getState().profileRequests.find((request) => request.id === payload.old?.id) || null,
              }),
            });
            return;
          }

          void syncProfileRequestById(payload.new?.id, {
            eventType: payload.eventType,
            emitLastEvent: true,
            emitToast: true,
          });
        });
      }

      channel = channel.subscribe(handleSubscribeStatus);

      return () => {
        supabase.removeChannel(channel);
      };
    },
  });

  function upsertProfile(nextProfile, { lastEvent = null } = {}) {
    if (!nextProfile?.id) return;

    runtime.setState((current) => ({
      ...current,
      profiles: sortProfiles([nextProfile, ...current.profiles.filter((profile) => profile.id !== nextProfile.id)]),
      lastSyncedAt: new Date().toISOString(),
      lastEvent,
    }));
  }

  function removeProfile(profileId, { lastEvent = null } = {}) {
    if (!profileId) return;

    runtime.setState((current) => ({
      ...current,
      profiles: current.profiles.filter((profile) => profile.id !== profileId),
      lastSyncedAt: new Date().toISOString(),
      lastEvent,
    }));
  }

  function patchProfilesByIds(profileIds = [], patch) {
    const idSet = new Set(profileIds.filter(Boolean));
    if (!idSet.size) return;

    runtime.setState((current) => ({
      ...current,
      profiles: sortProfiles(
        current.profiles.map((profile) =>
          idSet.has(profile.id)
            ? {
                ...profile,
                ...(typeof patch === "function" ? patch(profile) : patch),
              }
            : profile
        )
      ),
      lastSyncedAt: new Date().toISOString(),
    }));
  }

  function applyPresenceRow(presenceRow) {
    if (!presenceRow?.user_id) return;

    runtime.setState((current) => ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === presenceRow.user_id
          ? {
              ...profile,
              last_seen_at: presenceRow.last_seen_at || null,
            }
          : profile
      ),
      lastSyncedAt: new Date().toISOString(),
    }));
  }

  function upsertProfileRequest(nextRequest, { lastEvent = null } = {}) {
    if (!nextRequest?.id) return;

    runtime.setState((current) => ({
      ...current,
      profileRequests: sortProfileRequests([
        nextRequest,
        ...current.profileRequests.filter((request) => request.id !== nextRequest.id),
      ]),
      lastSyncedAt: new Date().toISOString(),
      lastEvent,
    }));
  }

  function removeProfileRequest(requestId, { lastEvent = null } = {}) {
    if (!requestId) return;

    runtime.setState((current) => ({
      ...current,
      profileRequests: current.profileRequests.filter((request) => request.id !== requestId),
      lastSyncedAt: new Date().toISOString(),
      lastEvent,
    }));
  }

  function patchProfileRequestsByIds(requestIds = [], patch) {
    const idSet = new Set(requestIds.filter(Boolean));
    if (!idSet.size) return;

    runtime.setState((current) => ({
      ...current,
      profileRequests: sortProfileRequests(
        current.profileRequests.map((request) =>
          idSet.has(request.id)
            ? {
                ...request,
                ...(typeof patch === "function" ? patch(request) : patch),
              }
            : request
        )
      ),
      lastSyncedAt: new Date().toISOString(),
    }));
  }

  async function syncProfileById(profileId, { eventType = "UPDATE", emitLastEvent = false, emitToast = false } = {}) {
    if (!profileId) return null;

    const previousProfile = runtime.getState().profiles.find((profile) => profile.id === profileId) || null;
    const nextProfile = await fetchProfileById(profileId, params);

    if (!nextProfile) {
      if (previousProfile) {
        removeProfile(profileId, {
          lastEvent: emitLastEvent ? buildLastEvent({ table: "profiles", eventType: "DELETE", previousRow: previousProfile }) : null,
        });
      }
      return null;
    }

    if (emitToast) {
      maybeToastProfileEvent({
        currentRole: params.currentRole,
        currentUserId: params.currentUserId,
        eventType,
        previousRow: previousProfile,
        nextRow: nextProfile,
      });
    }

    upsertProfile(nextProfile, {
      lastEvent: emitLastEvent ? buildLastEvent({ table: "profiles", eventType, previousRow: previousProfile, nextRow: nextProfile }) : null,
    });
    return nextProfile;
  }

  async function syncProfileRequestById(requestId, { eventType = "UPDATE", emitLastEvent = false, emitToast = false } = {}) {
    if (!requestId) return null;

    const previousRequest = runtime.getState().profileRequests.find((request) => request.id === requestId) || null;
    const nextRequest = await fetchProfileRequestById(requestId, params);

    if (!nextRequest) {
      if (previousRequest) {
        removeProfileRequest(requestId, {
          lastEvent: emitLastEvent
            ? buildLastEvent({ table: "profile_change_requests", eventType: "DELETE", previousRow: previousRequest })
            : null,
        });
      }
      return null;
    }

    if (emitToast) {
      maybeToastProfileRequestEvent({
        currentRole: params.currentRole,
        eventType,
        previousRow: previousRequest,
        nextRow: nextRequest,
      });
    }

    upsertProfileRequest(nextRequest, {
      lastEvent: emitLastEvent
        ? buildLastEvent({ table: "profile_change_requests", eventType, previousRow: previousRequest, nextRow: nextRequest })
        : null,
    });
    return nextRequest;
  }

  async function syncProfileRequestsByUserId(userId) {
    if (!userId || params.currentRole === "supervisor" || !isSuperAdminRole(params.scopeProfile?.role)) return;

    const nextRequests = await fetchProfileRequests(params, { userId });

    runtime.setState((current) => ({
      ...current,
      profileRequests: sortProfileRequests([
        ...current.profileRequests.filter((request) => request.user_id !== userId),
        ...nextRequests,
      ]),
      lastSyncedAt: new Date().toISOString(),
    }));
  }

  return {
    ...runtime,
    actions: {
      upsertProfile,
      removeProfile,
      patchProfilesByIds,
      applyPresenceRow,
      upsertProfileRequest,
      removeProfileRequest,
      patchProfileRequestsByIds,
      syncProfileById,
      syncProfileRequestById,
      syncProfileRequestsByUserId,
    },
  };
}

export const useLivePeopleStore = createScopedRealtimeStore({
  getStoreKey: getScopeKey,
  createStore: createPeopleStore,
});
