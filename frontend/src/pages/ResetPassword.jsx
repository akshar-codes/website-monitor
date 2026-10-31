import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import useAuthForm from "../hooks/useAuthForm";
import { ROUTES } from "../constants/routes";
import { mapAuthError } from "../utils/AuthErrors";
import * as authApi from "../services/api/auth";
import { AuthShell, Button, Input, Notice } from "../components/ui/Primitives";
import { Link } from "react-router-dom";

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

  if (!token)
    return (
      <AuthShell
        title="Reset link unavailable"
        description="This password reset link is missing its token. Request a new one to continue."
        footer={<Link to={ROUTES.FORGOT_PASSWORD}>Request another link</Link>}
      />
    );
  if (resetComplete)
    return (
      <AuthShell
        title="Password updated"
        description="Your password has been changed. Sign in with your new password."
        footer={<Link to={ROUTES.LOGIN}>Return to sign in</Link>}
      />
    );
  return (
    <AuthShell
      title="Choose a new password"
      description="Use a strong password you don’t use on other sites."
      footer={<Link to={ROUTES.LOGIN}>Back to sign in</Link>}
    >
      <form className="sw-form" onSubmit={handleSubmit} noValidate>
        {apiError && <Notice tone="error">{apiError}</Notice>}
        <Input
          label="New password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          value={values.password || ""}
          onChange={makeChangeHandler("password")}
          onBlur={handleBlur("password")}
          error={errors.password}
          required
        />
        <Input
          label="Confirm password"
          type="password"
          placeholder="Re-enter your new password"
          autoComplete="new-password"
          value={values.confirmPassword || ""}
          onChange={makeChangeHandler("confirmPassword")}
          onBlur={handleBlur("confirmPassword")}
          error={errors.confirmPassword}
          required
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
