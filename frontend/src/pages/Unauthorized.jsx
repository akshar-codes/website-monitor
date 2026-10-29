import { useNavigate, useLocation } from "react-router-dom";
import { ROUTES } from "../constants/routes";

export default function Unauthorized() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleAction = () => navigate(ROUTES.DASHBOARD);

  return null;
}
