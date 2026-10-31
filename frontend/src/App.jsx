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
const IntegrationGuide = lazy(() => import("./pages/IntegrationGuide"));
const Integrations = lazy(() => import("./pages/Integrations"));
const IntegrationForm = lazy(() => import("./pages/IntegrationForm"));
const Suggestions = lazy(() => import("./pages/Suggestions"));
const AdminSuggestions = lazy(() => import("./pages/AdminSuggestions"));
const Monitors = lazy(() => import("./pages/Monitors"));
const StatusPages = lazy(() => import("./pages/StatusPages"));
const PublicStatus = lazy(() => import("./pages/PublicStatus"));
const StatusPageManage = lazy(() => import("./pages/StatusPageManage"));
const StatusSubscription = lazy(() => import("./pages/StatusSubscription"));
const MonitorDetails = lazy(() => import("./pages/MonitorDetails"));
const SslMonitoring = lazy(() => import("./pages/SslMonitoring"));
const Insights = lazy(() => import("./pages/Insights"));
const IncidentHistory = lazy(() => import("./pages/IncidentHistory"));
const Billing = lazy(() => import("./pages/Billing"));
const Activity = lazy(() => import("./pages/Activity"));
const Notifications = lazy(() => import("./pages/Notifications"));
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
import { ROLES } from "./constants/roles";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermissionsProvider>
          <PreferencesProvider>
            <NotificationsProvider>
              <Toaster position="bottom-right" />
              {/* Listens for the `access:denied` event dispatched by
                services/api/client.js and presents every role/permission/
                plan authorization failure with a single, consistent toast
                (with an upgrade CTA where relevant). Needs to live inside
                <BrowserRouter> for useNavigate. */}
              <AccessErrorListener />
              <Suspense fallback={null}>
                <Routes>
                  {/* Public — redirects to the dashboard if already logged in */}
                  <Route element={<GuestRoute />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route
                      path="/forgot-password"
                      element={<ForgotPassword />}
                    />
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
                  <Route path="/status/:slug" element={<PublicStatus />} />
                  <Route element={<ProtectedRoute />}>
                    <Route
                      path="/status-preview/:id"
                      element={<PublicStatus />}
                    />
                  </Route>
                  <Route
                    path="/status-subscription"
                    element={<StatusSubscription />}
                  />

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
                            <Suspense fallback={null}>
                              <Dashboard />
                            </Suspense>
                          }
                        />

                        <Route
                          path="/monitors"
                          element={
                            <Suspense fallback={null}>
                              <Monitors />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/monitors/:id"
                          element={
                            <Suspense fallback={null}>
                              <MonitorDetails />
                            </Suspense>
                          }
                        />
                        <Route path="/status-pages" element={<StatusPages />} />
                        <Route
                          path="/integrations"
                          element={<Integrations />}
                        />
                        <Route
                          path="/integrations/deliveries"
                          element={<Integrations />}
                        />
                        <Route
                          path="/integrations/new/:provider"
                          element={<IntegrationForm />}
                        />
                        <Route
                          path="/integrations/:provider/:id/edit"
                          element={<IntegrationForm />}
                        />
                        <Route
                          path="/status-pages/:id/manage"
                          element={<StatusPageManage />}
                        />
                        <Route
                          path="/ssl"
                          element={
                            <Suspense fallback={null}>
                              <SslMonitoring />
                            </Suspense>
                          }
                        />

                        <Route
                          path="/insights"
                          element={
                            <Suspense fallback={null}>
                              <Insights />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/incidents"
                          element={
                            <Suspense fallback={null}>
                              <IncidentHistory />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/billing"
                          element={
                            <Suspense fallback={null}>
                              <Billing />
                            </Suspense>
                          }
                        />
                      </Route>

                      <Route
                        path="/activity"
                        element={
                          <Suspense fallback={null}>
                            <Activity />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/integration-guide"
                        element={
                          <Suspense fallback={null}>
                            <IntegrationGuide />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/suggestions"
                        element={
                          <Suspense fallback={null}>
                            <Suggestions />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/notifications"
                        element={
                          <Suspense fallback={null}>
                            <Notifications />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/profile"
                        element={
                          <Suspense fallback={null}>
                            <Profile />
                          </Suspense>
                        }
                      />
                      <Route
                        path="/preferences"
                        element={
                          <Suspense fallback={null}>
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
                        <Route
                          path="notifications/rules"
                          element={<Integrations />}
                        />
                        <Route path="escalations" element={<Integrations />} />
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
                          path="/admin/suggestions"
                          element={
                            <Suspense fallback={null}>
                              <AdminSuggestions />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/admin"
                          element={
                            <Suspense fallback={null}>
                              <AdminDashboard />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/admin/plans"
                          element={
                            <Suspense fallback={null}>
                              <AdminPlans />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/admin/plan-history"
                          element={
                            <Suspense fallback={null}>
                              <AdminPlanHistory />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/admin/monitors"
                          element={
                            <Suspense fallback={null}>
                              <AdminMonitors />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/admin/monitors/:id"
                          element={
                            <Suspense fallback={null}>
                              <AdminMonitorDetails />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/admin/incidents"
                          element={
                            <Suspense fallback={null}>
                              <AdminIncidents />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/admin/audit-logs"
                          element={
                            <Suspense fallback={null}>
                              <AdminAuditLogs />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/admin/incidents/:id"
                          element={
                            <Suspense fallback={null}>
                              <AdminIncidentDetails />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/admin/users/:id"
                          element={
                            <Suspense fallback={null}>
                              <AdminUserDetails />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/admin/users"
                          element={
                            <Suspense fallback={null}>
                              <AdminUsers />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/admin/plan-requests"
                          element={
                            <Suspense fallback={null}>
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
