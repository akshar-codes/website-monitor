import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ROUTES } from "../../constants/routes";
import FullScreenLoader from "../ui/FullScreenLoader";

/**
 * Inverse of RoleProtectedRoute — blocks nested routes for a specific set
 * of roles rather than restricting to them. Used to keep admin accounts
 * off end-user-only surfaces (e.g. /monitors) that don't apply to a
 * management-only role. Redirects to the dashboard rather than the
 * generic "unauthorized" page since this isn't a permissions failure —
 * it's a route that simply doesn't apply to this account type.
 *
 * Usage:
 *   <Route element={<BlockRoleRoute blockedRoles={[ROLES.ADMIN]} />}>
 *     <Route path="/monitors" element={<Monitors />} />
 *   </Route>
 */
export default function BlockRoleRoute({ blockedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  if (user && blockedRoles.includes(user.role)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
}
