import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import useAuthForm from "../hooks/useAuthForm";
import { ROUTES } from "../constants/routes";
import { mapAuthError, getAuthErrorCode } from "../utils/AuthErrors";
import AuthLayout from "../components/auth/AuthLayout";
import LoginMarketingPanel from "../components/auth/LoginMarketingPanel";
import PasswordField from "../components/auth/PasswordField";
import ResendVerificationForm from "../components/auth/ResendVerificationForm";
import AuthDivider from "../components/auth/AuthDivider";
import OAuthButtons from "../components/auth/OAuthButtons";
import { Card } from "../components/ui/Card";
import { FormField, Input } from "../components/ui/Input";
import Button from "../components/ui/Button";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { values, errors, handleChange, handleBlur, validateAll, clearErrors } =
    useAuthForm(["email", "password"], true);

  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  // Set to the attempted email whenever login fails specifically because
  // the account hasn't verified its email yet — renders an inline resend
  // form pre-filled with that address.
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  const makeChangeHandler = (field) => (e) => {
    if (apiError) setApiError("");
    if (unverifiedEmail) setUnverifiedEmail("");
    handleChange(field)(e);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    setUnverifiedEmail("");
    clearErrors();

    if (!validateAll()) return;

    setSubmitting(true);
    try {
      await login(values.email.trim(), values.password, rememberMe);
      const redirectTo = location.state?.from?.pathname || ROUTES.DASHBOARD;
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setApiError(mapAuthError(err, "login"));
      if (getAuthErrorCode(err) === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(values.email.trim());
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout animKey="login" marketingPanel={<LoginMarketingPanel />}>
      <div className="mb-6">
        <h2 className="mb-1.5 text-2xl font-semibold tracking-tight text-white">
          Welcome back
        </h2>
        <p className="text-sm text-text-secondary">
          Sign in to your WebMonitor account
        </p>
      </div>

      <Card>
        {apiError && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {unverifiedEmail && (
          <div className="mb-4">
            <ResendVerificationForm initialEmail={unverifiedEmail} compact />
          </div>
        )}

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

          <PasswordField
            label="Password"
            placeholder="Enter your password"
            value={values.password}
            onChange={makeChangeHandler("password")}
            onBlur={handleBlur("password")}
            error={errors.password}
            autoComplete="current-password"
            disabled={submitting}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={submitting}
                className="h-4 w-4 rounded border-border-strong bg-bg-subtle accent-emerald-500"
              />
              <label
                htmlFor="rememberMe"
                className="cursor-pointer select-none text-sm text-text-secondary"
              >
                Keep me signed in
              </label>
            </div>

            <button
              type="button"
              onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
              className="text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
            >
              Forgot password?
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? "Signing in…" : "Sign in to your account"}
          </Button>
        </form>

        <AuthDivider />
        <OAuthButtons disabled={submitting} />
      </Card>

      <p className="mt-4 text-center text-sm text-text-muted">
        Don&apos;t have an account?{" "}
        <button
          onClick={() => navigate(ROUTES.REGISTER)}
          className="inline-flex items-center gap-1 font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
        >
          Create one free <ArrowRight size={13} />
        </button>
      </p>
    </AuthLayout>
  );
}
