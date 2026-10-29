import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ROUTES } from "../../constants/routes";

/**
 * Keeps already-authenticated users off /login and /register by bouncing
 * them straight to the dashboard.
 */
export default function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
}
