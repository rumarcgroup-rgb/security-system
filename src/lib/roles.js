export const ROLE_SUPER_ADMIN = "super_admin";
export const ROLE_ADMIN_OPS = "admin_ops";
export const ROLE_LEGACY_ADMIN = "admin";

export const ADMIN_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN_OPS, ROLE_LEGACY_ADMIN];

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function isSuperAdminRole(role) {
  return role === ROLE_SUPER_ADMIN || role === ROLE_LEGACY_ADMIN;
}

