import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ROUTES } from "../../constants/routes";
import { ROLES } from "../../constants/roles";
import FullScreenLoader from "../ui/FullScreenLoader";

/**
 * Inverse of RoleProtectedRoute — blocks nested routes for a specific set
 * of roles rather than restricting to them. Used to keep admin accounts
 * off end-user-only surfaces (e.g. /monitors, /billing) that don't apply to a
 * management-only role. Redirects to /admin (for admins) or dashboard
 * rather than the generic "unauthorized" page.
 */
export default function BlockRoleRoute({ blockedRoles = [], redirectTo }) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  if (user && blockedRoles.includes(user.role)) {
    const target =
      redirectTo || (user.role === ROLES.ADMIN ? "/admin" : ROUTES.DASHBOARD);
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
