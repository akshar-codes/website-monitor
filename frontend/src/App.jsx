import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { PermissionsProvider } from "./context/PermissionsContext";
import { PreferencesProvider } from "./context/PreferencesContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import GuestRoute from "./components/routing/GuestRoute";
import RoleProtectedRoute from "./components/routing/RoleProtectedRoute";
import BlockRoleRoute from "./components/routing/BlockRoleRoute";
import AccessErrorListener from "./components/access/AccessErrorListener";
import AppLayout from "./components/layout/AppLayout";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Monitors = lazy(() => import("./pages/Monitors"));
const MonitorDetails = lazy(() => import("./pages/MonitorDetails"));
const SslMonitoring = lazy(() => import("./pages/SslMonitoring"));
const Insights = lazy(() => import("./pages/Insights"));
const IncidentHistory = lazy(() => import("./pages/IncidentHistory"));
const Billing = lazy(() => import("./pages/Billing"));
const Activity = lazy(() => import("./pages/Activity"));
const Profile = lazy(() => import("./pages/Profile"));
const Preferences = lazy(() => import("./pages/Preferences"));
const SettingsLayout = lazy(() => import("./pages/SettingsLayout"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const SecuritySettings = lazy(() => import("./pages/SecuritySettings"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const ApiKeysSettings = lazy(() => import("./pages/ApiKeysSettings"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUserDetails = lazy(() => import("./pages/AdminUserDetails"));
const AdminPlans = lazy(() => import("./pages/AdminPlans"));
const AdminPlanHistory = lazy(() => import("./pages/AdminPlanHistory"));
const AdminMonitorDetails = lazy(() => import("./pages/AdminMonitorDetails"));
const AdminMonitors = lazy(() => import("./pages/AdminMonitors"));
const AdminIncidents = lazy(() => import("./pages/AdminIncidents"));
const AdminIncidentDetails = lazy(() => import("./pages/AdminIncidentDetails"));
const AdminAuditLogs = lazy(() => import("./pages/AdminAuditLogs"));
const AdminPlanRequests = lazy(() => import("./pages/AdminPlanRequests"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const UpgradeRequired = lazy(() => import("./pages/UpgradeRequired"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const OAuthCallback = lazy(() => import("./components/auth/OAuthCallback"));
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
        <PermissionsProvider>
          <PreferencesProvider>
            <NotificationsProvider>
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
                    warning: "!text-amber-400",
                  },
                }}
                richColors
              />
              {/* Listens for the `access:denied` event dispatched by
                services/api/client.js and presents every role/permission/
                plan authorization failure with a single, consistent toast
                (with an upgrade CTA where relevant). Needs to live inside
                <BrowserRouter> for useNavigate. */}
              <AccessErrorListener />
              <Suspense fallback={<PageFallback />}>
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
                    {/* End-user only routes — blocked for administrators (redirects to /admin) */}
                    <Route
                      element={
                        <BlockRoleRoute
                          blockedRoles={[ROLES.ADMIN]}
                          redirectTo="/admin"
                        />
                      }
                    >
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
                        path="/monitors/:id"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <MonitorDetails />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/ssl"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <SslMonitoring />
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
                      <Route
                        path="/incidents"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <IncidentHistory />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/billing"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <Billing />
                          </Suspense>
                        }
                      />
                    </Route>

                    <Route
                      path="/activity"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <Activity />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <Profile />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/preferences"
                      element={
                        <Suspense fallback={<PageFallback />}>
                          <Preferences />
                        </Suspense>
                      }
                    />
                    <Route path="/settings" element={<SettingsLayout />}>
                      <Route
                        index
                        element={<Navigate to="account" replace />}
                      />
                      <Route path="account" element={<AccountSettings />} />
                      <Route path="profile" element={<Profile />} />
                      <Route path="subscription" element={<Billing />} />
                      <Route path="preferences" element={<Preferences />} />
                      <Route path="security" element={<SecuritySettings />} />
                      <Route
                        path="notifications"
                        element={<NotificationSettings />}
                      />
                      <Route path="api-keys" element={<ApiKeysSettings />} />
                    </Route>

                    {/* Reachable by any authenticated user regardless of role
                      or plan — these are where a denied access attempt lands. */}
                    <Route path="/unauthorized" element={<Unauthorized />} />
                    <Route
                      path="/upgrade-required"
                      element={<UpgradeRequired />}
                    />

                    {/* Requires an authenticated session AND the admin role */}
                    <Route
                      element={
                        <RoleProtectedRoute allowedRoles={[ROLES.ADMIN]} />
                      }
                    >
                      <Route
                        path="/admin"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <AdminDashboard />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/admin/plans"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <AdminPlans />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/admin/plan-history"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <AdminPlanHistory />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/admin/monitors"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <AdminMonitors />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/admin/monitors/:id"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <AdminMonitorDetails />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/admin/incidents"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <AdminIncidents />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/admin/audit-logs"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <AdminAuditLogs />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/admin/incidents/:id"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <AdminIncidentDetails />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/admin/users/:id"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <AdminUserDetails />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/admin/users"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <AdminUsers />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/admin/plan-requests"
                        element={
                          <Suspense fallback={<PageFallback />}>
                            <AdminPlanRequests />
                          </Suspense>
                        }
                      />
                    </Route>
                  </Route>
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
            </NotificationsProvider>
          </PreferencesProvider>
        </PermissionsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
