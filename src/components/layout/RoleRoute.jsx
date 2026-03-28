import { Navigate, Outlet } from "react-router-dom";

export default function RoleRoute({ allowedRole, profile, fallback = "/" }) {
  if (!profile) return <div className="p-6 text-sm text-slate-500">Loading profile...</div>;
  if (profile.role !== allowedRole) return <Navigate to={fallback} replace />;
  return <Outlet />;
}
