import { useNavigate, useLocation } from "react-router-dom";
import AccessDenied from "../components/access/AccessDenied";
import { ROUTES } from "../constants/routes";

/**
 * Landed on when a <RoleProtectedRoute> blocks access because the
 * current user's role isn't allowed. `location.state.message` (optional)
 * lets the redirecting route customize the copy — mirrors
 * pages/UpgradeRequired.jsx's identical pattern for plan-based denials.
 */
export default function Unauthorized() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AccessDenied
      message={location.state?.message}
      onAction={() => navigate(ROUTES.DASHBOARD)}
    />
  );
}
