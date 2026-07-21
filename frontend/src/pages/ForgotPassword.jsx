import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Send } from "lucide-react";
import useAuthForm from "../hooks/useAuthForm";
import { ROUTES } from "../constants/routes";
import { mapAuthError } from "../utils/AuthErrors";
import AuthLayout from "../components/auth/AuthLayout";
import LoginMarketingPanel from "../components/auth/LoginMarketingPanel";
import VerificationStatusCard from "../components/auth/VerificationStatusCard";
import AuthErrorBanner from "../components/auth/AuthErrorBanner";
import { Card } from "../components/ui/Card";
import { FormField, Input } from "../components/ui/Input";
import Button from "../components/ui/Button";
import * as authApi from "../services/api/auth";

/**
 * Requests a password-reset email. Always shows the same "check your
 * inbox" confirmation regardless of whether the account exists — the
 * backend responds identically either way to prevent account
 * enumeration, so the UI must not imply otherwise.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();

  const { values, errors, handleChange, handleBlur, validateAll, clearErrors } =
    useAuthForm(["email"], true);

  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");

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
      await authApi.forgotPassword(values.email.trim());
      setSubmittedEmail(values.email.trim());
    } catch (err) {
      setApiError(mapAuthError(err, "reset"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedEmail) {
    return (
      <AuthLayout
        animKey="forgot-password-success"
        marketingPanel={<LoginMarketingPanel />}
      >
        <VerificationStatusCard
          status="success"
          title="Check your inbox"
          message={`If an account exists for ${submittedEmail}, we've sent a link to reset the password. The link expires in 1 hour.`}
        >
          <button
            onClick={() => navigate(ROUTES.LOGIN)}
            className="mt-4 w-full text-center text-sm font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
          >
            Back to sign in
          </button>
        </VerificationStatusCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      animKey="forgot-password"
      marketingPanel={<LoginMarketingPanel />}
    >
      <div className="mb-6">
        <h2 className="mb-1.5 text-2xl font-semibold tracking-tight text-white">
          Reset your password
        </h2>
        <p className="text-sm text-text-secondary">
          Enter the email address on your account and we&apos;ll send you a link
          to reset your password.
        </p>
      </div>

      <Card>
        <AuthErrorBanner message={apiError} />

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField label="Email address" error={errors.email} required>
            <Input
              type="email"
              placeholder="you@example.com"
              value={values.email}
              onChange={makeChangeHandler("email")}
              onBlur={handleBlur("email")}
              error={!!errors.email}
              autoComplete="email"
              disabled={submitting}
              autoFocus
            />
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={Send}
            loading={submitting}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-text-muted">
        Remembered your password?{" "}
        <button
          onClick={() => navigate(ROUTES.LOGIN)}
          className="inline-flex items-center gap-1 font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
        >
          Sign in instead <ArrowRight size={13} />
        </button>
      </p>
    </AuthLayout>
  );
}
