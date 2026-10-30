import { useNavigate, useLocation } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { AuthShell, Button } from "../components/ui/Primitives";

export default function UpgradeRequired() {
  const navigate = useNavigate();
  const location = useLocation();

  const message =
    location.state?.message ||
    "This feature isn't included in your current plan. Upgrade to unlock it.";

  const handleAction = () => navigate(ROUTES.BILLING);

  return (
    <AuthShell
      title="Unlock this feature"
      description={message}
      footer="Choose a plan that fits your monitoring needs."
    >
      <div className="upgrade-art">
        <span>PRO</span>
        <span>12</span>
        <span>∞</span>
      </div>
      <Button type="button" onClick={handleAction}>
        View plans and billing
      </Button>
    </AuthShell>
  );
}
