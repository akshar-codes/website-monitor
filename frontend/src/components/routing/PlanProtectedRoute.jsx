import { Navigate, Outlet } from "react-router-dom";
import { usePermissions } from "../../hooks/usePermissions";
import { ROUTES } from "../../constants/routes";

/**
 * Restricts nested routes to accounts whose plan includes `feature`.
 */
export default function PlanProtectedRoute({ feature, message }) {
  const { hasFeature, loading } = usePermissions();

  if (loading) return null;

  if (!hasFeature(feature)) {
    return (
      <Navigate to={ROUTES.UPGRADE_REQUIRED} replace state={{ message }} />
    );
  }

  return <Outlet />;
}
