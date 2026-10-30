import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ROUTES } from "../../constants/routes";
import { ROLES } from "../../constants/roles";

/**
 * Blocks nested routes for a specific set of roles rather than restricting to them.
 */
export default function BlockRoleRoute({ blockedRoles = [], redirectTo }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user && blockedRoles.includes(user.role)) {
    const target =
      redirectTo || (user.role === ROLES.ADMIN ? "/admin" : ROUTES.DASHBOARD);
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
