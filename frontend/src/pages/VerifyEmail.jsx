import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { mapAuthError } from "../utils/AuthErrors";
import * as authApi from "../services/api/auth";
import { AuthShell, Button, Notice } from "../components/ui/Primitives";
import { Link } from "react-router-dom";

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
    <AuthShell
      title={
        status === "success"
          ? "Email verified"
          : status === "pending"
            ? "Verifying your email"
            : "Email verification"
      }
      description={
        message ||
        (status === "pending"
          ? "Confirming your email address…"
          : "Use the link in your verification email to activate your account.")
      }
      footer={
        status === "success" ? (
          <Link to={ROUTES.LOGIN}>Continue to sign in</Link>
        ) : (
          <Link to={ROUTES.REGISTER}>Create an account</Link>
        )
      }
    >
      <Notice
        tone={
          status === "failed" || status === "missing" ? "warning" : "success"
        }
      >
        {status === "pending"
          ? "Please wait while we confirm your address."
          : message || "The verification link is missing or invalid."}
      </Notice>
      {status === "success" && (
        <Button type="button" onClick={() => navigate(ROUTES.LOGIN)}>
          Sign in
        </Button>
      )}
    </AuthShell>
  );
}
