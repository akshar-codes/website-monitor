import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import useAuthForm from "../hooks/useAuthForm";
import { ROUTES } from "../constants/routes";
import { mapAuthError } from "../utils/AuthErrors";
import AuthLayout from "../components/auth/AuthLayout";
import RegisterMarketingPanel from "../components/auth/RegisterMarketingPanel";
import PasswordField from "../components/auth/PasswordField";
import PasswordStrengthMeter from "../components/auth/PasswordStrengthMeter";
import VerificationStatusCard from "../components/auth/VerificationStatusCard";
import ResendVerificationForm from "../components/auth/ResendVerificationForm";
import AuthDivider from "../components/auth/AuthDivider";
import OAuthButtons from "../components/auth/OAuthButtons";
import { Card } from "../components/ui/Card";
import { FormField, Input } from "../components/ui/Input";
import Button from "../components/ui/Button";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const {
    values,
    errors,
    handleChange,
    handleBlur,
    validateAll,
    setFieldError,
    clearErrors,
  } = useAuthForm(["name", "email", "password", "confirmPassword"], true);

  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  // Set once registration succeeds — swaps the form for a "check your
  // inbox" screen. Registration no longer creates a session (the account
  // is unverified), so there's nowhere authenticated to navigate to yet.
  const [registeredEmail, setRegisteredEmail] = useState("");

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
      await register(values.name.trim(), values.email.trim(), values.password);
      setRegisteredEmail(values.email.trim());
    } catch (err) {
      const mapped = mapAuthError(err, "register");
      if (err?.response?.status === 409) {
        setFieldError("email", mapped);
      } else {
        setApiError(mapped);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (registeredEmail) {
    return (
      <AuthLayout
        animKey="register-success"
        marketingPanel={<RegisterMarketingPanel />}
      >
        <VerificationStatusCard
          status="success"
          title="Check your inbox"
          message={`We've sent a verification link to ${registeredEmail}. Verify your email to activate your account and sign in.`}
        >
          <ResendVerificationForm initialEmail={registeredEmail} />
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
    <AuthLayout animKey="register" marketingPanel={<RegisterMarketingPanel />}>
      <div className="mb-6">
        <h2 className="mb-1.5 text-2xl font-semibold tracking-tight text-white">
          Create your account
        </h2>
        <p className="text-sm text-text-secondary">
          Start monitoring in under two minutes.
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

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField label="Full name" error={errors.name} required>
            <Input
              type="text"
              placeholder="Akshar Gupta"
              value={values.name}
              onChange={makeChangeHandler("name")}
              onBlur={handleBlur("name")}
              error={!!errors.name}
              autoComplete="name"
              disabled={submitting}
              autoFocus
            />
          </FormField>

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
            />
          </FormField>

          <div>
            <PasswordField
              label="Password"
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
              label="Confirm password"
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
            {submitting ? "Creating account…" : "Create free account"}
          </Button>
        </form>

        <AuthDivider />
        <OAuthButtons disabled={submitting} />
      </Card>

      <p className="mt-4 text-center text-sm text-text-muted">
        Already have an account?{" "}
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
