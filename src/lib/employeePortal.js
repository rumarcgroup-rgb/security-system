export const EMPLOYEE_PORTAL_STORAGE_KEY = "employee-portal-type";

const POSITION_TO_PORTAL = {
  "cgroup access": "cgroup-access",
  "security guard": "security-guard",
  janitor: "janitor",
  "maintenance staff": "cgroup-access",
};

export function normalizeEmployeePortal(value) {
  return POSITION_TO_PORTAL[String(value || "").trim().toLowerCase()] || "cgroup-access";
}

export function saveEmployeePortalType(portalType) {
  if (typeof window === "undefined") return;
  if (!portalType || portalType === "admin") return;
  window.localStorage.setItem(EMPLOYEE_PORTAL_STORAGE_KEY, portalType);
}

export function getStoredEmployeePortalType() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(EMPLOYEE_PORTAL_STORAGE_KEY);
}

export function clearStoredEmployeePortalType() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(EMPLOYEE_PORTAL_STORAGE_KEY);
}
