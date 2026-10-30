import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import useAuthForm from "../hooks/useAuthForm";
import { mapAuthError } from "../utils/AuthErrors";
import { AuthShell, Button, Input, Notice } from "../components/ui/Primitives";
import { Link } from "react-router-dom";

export default function Register() {
  const { register } = useAuth();

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

  return (
    <AuthShell
      title={registeredEmail ? "Check your email" : "Create your account"}
      description={
        registeredEmail
          ? `We sent a verification link to ${registeredEmail}. Verify your email to sign in.`
          : "Start monitoring your websites in a few minutes."
      }
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="sw-form" onSubmit={handleSubmit} noValidate>
        {apiError && <Notice tone="error">{apiError}</Notice>}
        {!registeredEmail && (
          <>
            <Input
              label="Full name"
              autoComplete="name"
              placeholder="Your name"
              value={values.name || ""}
              onChange={makeChangeHandler("name")}
              onBlur={handleBlur("name")}
              error={errors.name}
              required
            />
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
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={values.password || ""}
              onChange={makeChangeHandler("password")}
              onBlur={handleBlur("password")}
              error={errors.password}
              required
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={values.confirmPassword || ""}
              onChange={makeChangeHandler("confirmPassword")}
              onBlur={handleBlur("confirmPassword")}
              error={errors.confirmPassword}
              required
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </>
        )}
      </form>
    </AuthShell>
  );
}
