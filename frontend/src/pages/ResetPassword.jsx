import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import useAuthForm from "../hooks/useAuthForm";
import { ROUTES } from "../constants/routes";
import { mapAuthError } from "../utils/AuthErrors";
import AuthLayout from "../components/auth/AuthLayout";
import LoginMarketingPanel from "../components/auth/LoginMarketingPanel";
import VerificationStatusCard from "../components/auth/VerificationStatusCard";
import PasswordField from "../components/auth/PasswordField";
import PasswordStrengthMeter from "../components/auth/PasswordStrengthMeter";
import AuthErrorBanner from "../components/auth/AuthErrorBanner";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import * as authApi from "../services/api/auth";

/**
 * Lands here from the link in the password-reset email:
 * `${CLIENT_URL}/reset-password?token=...`
 *
 * Renders one of four states:
 *  - "missing"  — no token in the URL
 *  - "form"     — token present, collecting the new password
 *  - "success"  — reset completed (every session was invalidated server-side)
 *  - inline error banner on the form for an invalid/expired token
 */
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const { values, errors, handleChange, handleBlur, validateAll, clearErrors } =
    useAuthForm(["password", "confirmPassword"], true);

  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [resetComplete, setResetComplete] = useState(false);

  const makeChangeHandler = (field) => (e) => {
    if (apiError) setApiError("");
    handleChange(field)(e);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    clearErrors();

    if (!validateAll()) return;

    setSubmitting(true);
    try {
      await authApi.resetPassword({
        token,
        password: values.password,
        confirmPassword: values.confirmPassword,
      });
      setResetComplete(true);
    } catch (err) {
      setApiError(mapAuthError(err, "reset"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout
        animKey="reset-password-missing"
        marketingPanel={<LoginMarketingPanel />}
      >
        <VerificationStatusCard
          status="failed"
          title="Reset link incomplete"
          message="No reset token was found in this link. Request a new password reset email to continue."
        >
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            iconRight={ArrowRight}
            onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
          >
            Request a new link
          </Button>
        </VerificationStatusCard>
      </AuthLayout>
    );
  }

  if (resetComplete) {
    return (
      <AuthLayout
        animKey="reset-password-success"
        marketingPanel={<LoginMarketingPanel />}
      >
        <VerificationStatusCard
          status="success"
          title="Password reset"
          message="Your password has been changed successfully. Every active session has been signed out for security — please sign in again with your new password."
        >
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
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      animKey="reset-password"
      marketingPanel={<LoginMarketingPanel />}
    >
      <div className="mb-6">
        <h2 className="mb-1.5 text-2xl font-semibold tracking-tight text-white">
          Choose a new password
        </h2>
        <p className="text-sm text-text-secondary">
          Your new password must be different from previously used passwords.
        </p>
      </div>

      <Card>
        <AuthErrorBanner message={apiError} />

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <PasswordField
              label="New password"
              placeholder="Create a strong password"
              value={values.password}
              onChange={makeChangeHandler("password")}
              onBlur={handleBlur("password")}
              error={errors.password}
              autoComplete="new-password"
              disabled={submitting}
            />
            <PasswordStrengthMeter
              password={values.password}
              show={values.password.length > 0}
            />
          </div>

          <div>
            <PasswordField
              label="Confirm new password"
              placeholder="Repeat your password"
              value={values.confirmPassword}
              onChange={makeChangeHandler("confirmPassword")}
              onBlur={handleBlur("confirmPassword")}
              error={errors.confirmPassword}
              autoComplete="new-password"
              disabled={submitting}
            />
            {values.confirmPassword &&
              values.password &&
              !errors.confirmPassword && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <Check size={11} /> Passwords match
                </p>
              )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? "Resetting…" : "Reset password"}
          </Button>
        </form>
      </Card>
    </AuthLayout>
  );
}
