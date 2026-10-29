import { useNavigate, useLocation } from "react-router-dom";
import { ROUTES } from "../constants/routes";

export default function UpgradeRequired() {
  const navigate = useNavigate();
  const location = useLocation();

  const message =
    location.state?.message ||
    "This feature isn't included in your current plan. Upgrade to unlock it.";

  const handleAction = () => navigate(ROUTES.BILLING);

  return null;
}
