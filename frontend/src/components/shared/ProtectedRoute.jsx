import { Outlet } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  // Future: redirect to login page when auth is implemented
  // e.g. return <Navigate to="/login" replace />;
  if (!isAuthenticated) {
    return null;
  }

  return <Outlet />;
}

export default ProtectedRoute;
