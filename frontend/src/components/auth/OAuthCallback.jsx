import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import LoginMarketingPanel from "../components/auth/LoginMarketingPanel";
import VerificationStatusCard from "../components/auth/VerificationStatusCard";
import ResendVerificationForm from "../components/auth/ResendVerificationForm";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { ROUTES } from "../constants/routes";

/**
 * Lands here after the backend finishes handling an OAuth redirect
 * (`/api/auth/google/callback` or `/api/auth/github/callback`), which
 * itself redirects the browser to:
 *   `${CLIENT_URL}/oauth/callback?status=success`
 *   `${CLIENT_URL}/oauth/callback?status=error&code=...&message=...`
 *
 * On success the session cookie is already set by the backend — this page
 * just needs to refresh the cached auth-context user and move on to the
 * dashboard. On failure it surfaces the reason and a way forward.
 */
export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refetchUser } = useAuth();

  const status = searchParams.get("status");
  const code = searchParams.get("code");
  const message = searchParams.get("message");
  const email = searchParams.get("email") || "";

  const [phase, setPhase] = useState(status === "success" ? "pending" : "failed");

  // Guards against React StrictMode's double-invoked effects re-triggering
  // the redirect logic.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current || status !== "success") return;
    hasRun.current = true;

    (async () => {
      await refetchUser();
      setPhase("success");
      navigate(ROUTES.DASHBOARD, { replace: true });
    })();
  }, [status, refetchUser, navigate]);

  if (phase === "pending") {
    return (
      <AuthLayout animKey="oauth-pending" marketingPanel={<LoginMarketingPanel />}>
        <VerificationStatusCard status="pending" message="Finishing sign-in…" />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout animKey="oauth-failed" marketingPanel={<LoginMarketingPanel />}>
      <VerificationStatusCard
        status="failed"
        title="Sign-in failed"
        message={
          message ||
          "We couldn't complete sign-in with this provider. Please try again."
        }
      >
        {code === "EMAIL_NOT_VERIFIED" ? (
          <ResendVerificationForm initialEmail={email} />
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            iconRight={ArrowRight}
            onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
          >
            Back to sign in
          </Button>
        )}
      </VerificationStatusCard>
    </AuthLayout>
  );
}
