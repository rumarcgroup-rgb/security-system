import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute({ user, loading }) {
  if (loading) return <div className="p-6 text-sm text-slate-500">Loading session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
