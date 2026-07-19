import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import LoginMarketingPanel from "../components/auth/LoginMarketingPanel";
import VerificationStatusCard from "../components/auth/VerificationStatusCard";
import ResendVerificationForm from "../components/auth/ResendVerificationForm";
import Button from "../components/ui/Button";
import { ROUTES } from "../constants/routes";
import { mapAuthError } from "../utils/AuthErrors";
import * as authApi from "../services/api/auth";

/**
 * Lands here from the link in the verification email:
 * `${CLIENT_URL}/verify-email?token=...`
 *
 * Renders one of four states:
 *  - "missing" — no token in the URL (e.g. the link was mistyped/truncated)
 *  - "pending" — token present, verification request in flight
 *  - "success" — token confirmed
 *  - "failed"  — token invalid/expired/already consumed
 */
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [status, setStatus] = useState(token ? "pending" : "missing");
  const [message, setMessage] = useState("");

  // Guards against React StrictMode's double-invoked effects firing two
  // verification requests — the token is single-use, so a second call
  // would otherwise report a false "invalid or expired" failure.
  const hasRun = useRef(false);

  useEffect(() => {
    if (!token || hasRun.current) return;
    hasRun.current = true;

    (async () => {
      try {
        const { message: successMessage } = await authApi.verifyEmail(token);
        setMessage(successMessage);
        setStatus("success");
      } catch (err) {
        setMessage(mapAuthError(err, "verify"));
        setStatus("failed");
      }
    })();
  }, [token]);

  return (
    <AuthLayout animKey="verify-email" marketingPanel={<LoginMarketingPanel />}>
      {status === "missing" && (
        <VerificationStatusCard
          status="failed"
          title="Verification link incomplete"
          message="No verification token was found in this link. Enter your email below to request a new one."
        >
          <ResendVerificationForm />
        </VerificationStatusCard>
      )}

      {status === "pending" && (
        <VerificationStatusCard
          status="pending"
          message="Hang tight while we confirm your email address."
        />
      )}

      {status === "success" && (
        <VerificationStatusCard status="success" message={message}>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            iconRight={ArrowRight}
            onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
          >
            Continue to sign in
          </Button>
        </VerificationStatusCard>
      )}

      {status === "failed" && (
        <VerificationStatusCard status="failed" message={message}>
          <ResendVerificationForm />
        </VerificationStatusCard>
      )}
    </AuthLayout>
  );
}
