import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ROUTES } from "../../constants/routes";
import FullScreenLoader from "../ui/FullScreenLoader";

/**
 * Restricts nested routes to a specific set of roles. Intended to be
 * nested INSIDE <ProtectedRoute> in the route tree (see App.jsx) so an
 * unauthenticated visitor is already redirected to /login before this
 * component ever renders — this component only decides what an
 * authenticated-but-insufficiently-privileged user sees.
 *
 * Usage:
 *   <Route element={<ProtectedRoute />}>
 *     <Route element={<AppLayout />}>
 *       <Route element={<RoleProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
 *         <Route path="/admin/users" element={<AdminUsers />} />
 *       </Route>
 *     </Route>
 *   </Route>
 */
export default function RoleProtectedRoute({ allowedRoles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
  }

  return <Outlet />;
}
