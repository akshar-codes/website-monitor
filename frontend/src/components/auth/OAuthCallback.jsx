import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ROUTES } from "../../constants/routes";

/**
 * Handles backend OAuth redirect callbacks (`status=success` or `status=error`).
 * Pure logic component: Refetches session on success and redirects.
 */
export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refetchUser } = useAuth();

  const status = searchParams.get("status");
  const code = searchParams.get("code");
  const message = searchParams.get("message");
  const email = searchParams.get("email") || "";

  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (status === "success") {
      (async () => {
        try {
          await refetchUser();
        } finally {
          navigate(ROUTES.DASHBOARD, { replace: true });
        }
      })();
    } else {
      navigate(ROUTES.LOGIN, {
        replace: true,
        state: { error: message, code, email },
      });
    }
  }, [status, code, message, email, refetchUser, navigate]);

  return null;
}
