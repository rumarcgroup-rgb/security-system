export function isRetryableSessionError(message = "") {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("refresh token") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("jwt") ||
    normalized.includes("session") ||
    normalized.includes("token") ||
    normalized.includes("auth")
  );
}

export function clearStoredSupabaseAuth() {
  if (typeof window === "undefined") return;

  const clearStore = (store) => {
    const keys = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key?.startsWith("sb-")) {
        keys.push(key);
      }
    }
    keys.forEach((key) => store.removeItem(key));
  };

  clearStore(window.localStorage);
  clearStore(window.sessionStorage);
}
