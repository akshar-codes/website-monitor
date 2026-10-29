import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ROUTES } from "../../constants/routes";

/**
 * Restricts nested routes to a specific set of roles.
 */
export default function RoleProtectedRoute({ allowedRoles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to={ROUTES.UNAUTHORIZED}
        replace
        state={{
          message: "You don't have the required role to access this page.",
        }}
      />
    );
  }

  return <Outlet />;
}
