import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import RoleRoute from "./components/layout/RoleRoute";

const LoginPage = lazy(() => import("./features/auth/LoginPage"));
const ResetPasswordPage = lazy(() => import("./features/auth/ResetPasswordPage"));
const EmployeeDashboard = lazy(() => import("./features/employee/EmployeeDashboard"));
const OnboardingPage = lazy(() => import("./features/onboarding/OnboardingPage"));
const AdminLayout = lazy(() => import("./features/admin/AdminLayout"));
const AdminDashboardHome = lazy(() => import("./features/admin/AdminDashboardHome"));
const AdminDtrPage = lazy(() => import("./features/admin/AdminDtrPage"));
const AdminRequirementsPage = lazy(() => import("./features/admin/AdminRequirementsPage"));
const AdminReportsPage = lazy(() => import("./features/admin/AdminReportsPage"));
const AdminUsersPage = lazy(() => import("./features/admin/AdminUsersPage"));
const AdminSettingsPage = lazy(() => import("./features/admin/AdminSettingsPage"));
const SupervisorLayout = lazy(() => import("./features/supervisor/SupervisorLayout"));
const SupervisorDashboardHome = lazy(() => import("./features/supervisor/SupervisorDashboardHome"));
const SupervisorDtrPage = lazy(() => import("./features/supervisor/SupervisorDtrPage"));
const SupervisorTeamPage = lazy(() => import("./features/supervisor/SupervisorTeamPage"));
const SupervisorSettingsPage = lazy(() => import("./features/supervisor/SupervisorSettingsPage"));

export default function App() {
  const { user, profile, loading, authError, refreshProfile, resetSession } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const cleanupMarkerKey = "showcase-cleanup-2026-04-08";
    if (window.localStorage.getItem(cleanupMarkerKey)) return;

    [
      "cebuana-preview-active-tab",
      "cebuana-preview-settings",
      "cebuana-preview-upload-workspace",
    ].forEach((key) => window.localStorage.removeItem(key));

    window.localStorage.setItem(cleanupMarkerKey, "done");
  }, []);

  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading module...</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/:portalType" element={<LoginPage />} />
        <Route path="/reset-password/:portalType" element={<ResetPasswordPage />} />
        <Route
          path="/onboarding"
          element={<OnboardingPage user={user} profile={profile} refreshProfile={refreshProfile} />}
        />
        <Route
          element={
            <ProtectedRoute
              user={user}
              loading={loading}
              authError={authError}
              onResetSession={resetSession}
            />
          }
        >
          <Route
            element={<RoleRoute allowedRole="admin" profile={profile} fallback="/" />}
          >
            <Route path="/admin" element={<AdminLayout profile={profile} />}>
              <Route index element={<AdminDashboardHome profile={profile} />} />
              <Route path="dtr-submissions" element={<AdminDtrPage />} />
              <Route path="requirements" element={<AdminRequirementsPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route
                path="settings"
                element={<AdminSettingsPage profile={profile} refreshProfile={refreshProfile} />}
              />
            </Route>
          </Route>

          <Route
            element={<RoleRoute allowedRole="supervisor" profile={profile} fallback="/" />}
          >
            <Route path="/supervisor" element={<SupervisorLayout profile={profile} />}>
              <Route index element={<SupervisorDashboardHome profile={profile} />} />
              <Route path="dtr" element={<SupervisorDtrPage profile={profile} />} />
              <Route path="team" element={<SupervisorTeamPage profile={profile} />} />
              <Route
                path="settings"
                element={<SupervisorSettingsPage profile={profile} refreshProfile={refreshProfile} />}
              />
            </Route>
          </Route>

          <Route
            path="/"
            element={
              !profile ? (
                <Navigate to="/onboarding" replace />
              ) : profile.role === "admin" ? (
                <Navigate to="/admin" replace />
              ) : profile.role === "supervisor" ? (
                <Navigate to="/supervisor" replace />
              ) : (
                <EmployeeDashboard user={user} profile={profile} refreshProfile={refreshProfile} />
              )
            }
          />
        </Route>
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
    </Suspense>
  );
}
