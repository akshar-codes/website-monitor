import { Navigate, Outlet } from "react-router-dom";
import { usePermissions } from "../../hooks/usePermissions";
import { ROUTES } from "../../constants/routes";
import FullScreenLoader from "../ui/FullScreenLoader";

/**
 * Restricts nested routes to accounts whose plan includes `feature` (see
 * constants/features.js). Intended to be nested INSIDE <ProtectedRoute> —
 * mirrors RoleProtectedRoute's placement in the route tree — so an
 * unauthenticated visitor is already redirected to /login before this
 * component ever evaluates plan access.
 *
 * Usage:
 *   <Route element={<PlanProtectedRoute feature={FEATURES.TEAM_ACCESS} />}>
 *     <Route path="/team" element={<TeamSettings />} />
 *   </Route>
 */
export default function PlanProtectedRoute({ feature, message }) {
  const { hasFeature, loading } = usePermissions();

  if (loading) return <FullScreenLoader />;

  if (!hasFeature(feature)) {
    return (
      <Navigate to={ROUTES.UPGRADE_REQUIRED} replace state={{ message }} />
    );
  }

  return <Outlet />;
}
