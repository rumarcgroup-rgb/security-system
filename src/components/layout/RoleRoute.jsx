import { Navigate, Outlet } from "react-router-dom";

export default function RoleRoute({ allowedRole, profile, fallback = "/" }) {
  if (!profile) return <div className="p-6 text-sm text-slate-500">Loading profile...</div>;
  const allowedRoles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
  if (!allowedRoles.includes(profile.role)) return <Navigate to={fallback} replace />;
  return <Outlet />;
}
