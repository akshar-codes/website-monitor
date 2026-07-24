import { useNavigate } from "react-router-dom";
import AccessDenied from "../components/access/AccessDenied";
import { ROUTES } from "../constants/routes";

export default function Unauthorized() {
  const navigate = useNavigate();

  return <AccessDenied onAction={() => navigate(ROUTES.DASHBOARD)} />;
}
