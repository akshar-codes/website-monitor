import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ROUTES } from "../../constants/routes";
import FullScreenLoader from "../ui/FullScreenLoader";

/**
 * Blocks access to nested routes until a session has been confirmed.
 * Unauthenticated visitors are redirected to /login with the attempted
 * location preserved, so a successful login can send them back.
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
