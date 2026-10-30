import { useState } from "react";
import useAuthForm from "../hooks/useAuthForm";
import { ROUTES } from "../constants/routes";
import { mapAuthError } from "../utils/AuthErrors";
import * as authApi from "../services/api/auth";
import { AuthShell, Button, Input, Notice } from "../components/ui/Primitives";
import { Link } from "react-router-dom";

/**
 * Requests a password-reset email. Always shows the same "check your
 * inbox" confirmation regardless of whether the account exists — the
 * backend responds identically either way to prevent account
 * enumeration, so the UI must not imply otherwise.
 */
export default function ForgotPassword() {
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

  return (
    <AuthShell
      title={submittedEmail ? "Check your inbox" : "Reset your password"}
      description={
        submittedEmail
          ? `If an account exists for ${submittedEmail}, you’ll receive a password reset link shortly.`
          : "Enter the email address associated with your account."
      }
      footer={
        <>
          Remember your password? <Link to={ROUTES.LOGIN}>Sign in</Link>
        </>
      }
    >
      <form className="sw-form" onSubmit={handleSubmit} noValidate>
        {apiError && <Notice tone="error">{apiError}</Notice>}
        {!submittedEmail && (
          <>
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={values.email || ""}
              onChange={makeChangeHandler("email")}
              onBlur={handleBlur("email")}
              error={errors.email}
              required
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </>
        )}
      </form>
    </AuthShell>
  );
}
