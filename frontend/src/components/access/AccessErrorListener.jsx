import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ROUTES } from "../../constants/routes";

const CODE_LABELS = {
  UPGRADE_REQUIRED: "Upgrade required",
  FEATURE_RESTRICTED: "Feature restricted",
  ROLE_FORBIDDEN: "Access denied",
  PERMISSION_DENIED: "Access denied",
  OWNERSHIP_REQUIRED: "Access denied",
};

/**
 * Single, consistent presentation layer for every authorization failure
 * the API can return — role-forbidden, permission-denied,
 * ownership-required, upgrade-required, and feature-restricted (see
 * backend/src/utils/ApiError.js and utils/accessErrors.js). The axios
 * client (services/api/client.js) dispatches an `access:denied` window
 * event for each of these instead of the generic error toast, and this
 * component is the one place that decides how to show it — mirroring the
 * existing `auth:session-expired` event pattern in context/AuthContext.jsx.
 *
 * Mounted once near the app root, inside the router (it needs
 * `useNavigate` for the upgrade-required CTA).
 */
export default function AccessErrorListener() {
  const navigate = useNavigate();
  const lastUpgradeToastRef = useRef(0);

  useEffect(() => {
    const handleAccessDenied = (event) => {
      const { code, message } = event.detail || {};
      const label = CODE_LABELS[code] || "Access denied";

      if (code === "UPGRADE_REQUIRED" || code === "FEATURE_RESTRICTED") {
        const now = Date.now();
        // Prevent toast spam/stacking across simultaneous requests or rapid tab switches
        if (now - lastUpgradeToastRef.current < 4000) {
          return;
        }
        lastUpgradeToastRef.current = now;

        toast.warning(message || "This action requires a higher plan.", {
          id: "upgrade-required",
          description: label,
          action: {
            label: "View plans",
            onClick: () => navigate(ROUTES.BILLING),
          },
        });
        return;
      }

      toast.error(
        message || "You don't have permission to perform this action.",
        { description: label },
      );
    };

    window.addEventListener("access:denied", handleAccessDenied);
    return () =>
      window.removeEventListener("access:denied", handleAccessDenied);
  }, [navigate]);

  return null;
}
