import { Suspense, lazy } from "react";
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
const AdminReportsPage = lazy(() => import("./features/admin/AdminReportsPage"));
const AdminUsersPage = lazy(() => import("./features/admin/AdminUsersPage"));
const AdminSettingsPage = lazy(() => import("./features/admin/AdminSettingsPage"));

export default function App() {
  const { user, profile, loading, authError, refreshProfile, resetSession } = useAuth();

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
              <Route index element={<AdminDashboardHome />} />
              <Route path="dtr-submissions" element={<AdminDtrPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route
                path="settings"
                element={<AdminSettingsPage profile={profile} refreshProfile={refreshProfile} />}
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
