import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute({ user, loading, authError, onResetSession }) {
  if (loading) return <div className="p-6 text-sm text-slate-500">Loading session...</div>;
  if (authError) {
    return (
      <div className="p-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-semibold">Unable to load session</p>
          <p className="mt-1">{authError}</p>
          {onResetSession ? (
            <button
              className="mt-3 rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
              onClick={async () => {
                await onResetSession();
                window.location.reload();
              }}
            >
              Reset Session
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
