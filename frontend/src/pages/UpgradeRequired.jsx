import { useNavigate, useLocation } from "react-router-dom";
import { Crown } from "lucide-react";
import AccessDenied from "../components/access/AccessDenied";
import { ROUTES } from "../constants/routes";

/**
 * Landed on when a <PlanProtectedRoute> blocks access because the current
 * plan doesn't include the required feature. `location.state.message`
 * (optional) lets the redirecting route customize the copy.
 */
export default function UpgradeRequired() {
  const navigate = useNavigate();
  const location = useLocation();

  const message =
    location.state?.message ||
    "This feature isn't included in your current plan. Upgrade to unlock it.";

  return (
    <AccessDenied
      icon={Crown}
      iconClassName="text-emerald-400"
      iconBg="border-emerald-500/20 bg-emerald-500/10"
      title="Upgrade required"
      message={message}
      actionLabel="View plans"
      onAction={() => navigate(ROUTES.BILLING)}
    />
  );
}
