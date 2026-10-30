import { useNavigate, useLocation } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { AuthShell, Button } from "../components/ui/Primitives";

export default function Unauthorized() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleAction = () => navigate(ROUTES.DASHBOARD);

  return (
    <AuthShell
      title="Access restricted"
      description={
        location.state?.message ||
        "Your account doesn’t have permission to view this page."
      }
      footer="If you think this is a mistake, contact your workspace administrator."
    >
      <Button type="button" onClick={handleAction}>
        Return to dashboard
      </Button>
    </AuthShell>
  );
}
