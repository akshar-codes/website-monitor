import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import GuestRoute from "./components/routing/GuestRoute";
import RoleProtectedRoute from "./components/routing/RoleProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Monitors from "./pages/Monitors";
import Insights from "./pages/Insights";
import AdminUsers from "./pages/AdminUsers";
import Unauthorized from "./pages/Unauthorized";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import OAuthCallback from "./pages/OAuthCallback";
import { Skeleton } from "./components/ui/Skeleton";
import { ROLES } from "./constants/roles";

function PageFallback() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="mt-4 grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-72 rounded-xl" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#18181b",
              border: "1px solid #27272a",
              color: "#fafafa",
              fontSize: "13px",
              borderRadius: "12px",
            },
            classNames: {
              success: "!text-emerald-400",
              error: "!text-red-400",
            },
          }}
          richColors
        />
        <Routes>
          {/* Public — redirects to the dashboard if already logged in */}
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>

          {/*
            Public and always accessible regardless of auth state — these
            are transactional links clicked from an email client (or, for
            /oauth/callback, a redirect from the backend after an OAuth
            attempt), which may land in a different browser/session than
            the one that triggered the request.
          */}
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />

          {/* Requires an authenticated session */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route
                path="/"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Dashboard />
                  </Suspense>
                }
              />
              <Route
                path="/monitors"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Monitors />
                  </Suspense>
                }
              />
              <Route
                path="/insights"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <Insights />
                  </Suspense>
                }
              />

              {/* Reachable by any authenticated user regardless of role —
                  this is where a role mismatch on the routes below lands. */}
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Requires an authenticated session AND the admin role */}
              <Route
                element={<RoleProtectedRoute allowedRoles={[ROLES.ADMIN]} />}
              >
                <Route
                  path="/admin/users"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <AdminUsers />
                    </Suspense>
                  }
                />
              </Route>
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
