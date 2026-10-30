import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import useAuthForm from "../hooks/useAuthForm";
import { ROUTES } from "../constants/routes";
import { ROLES } from "../constants/roles";
import { mapAuthError, getAuthErrorCode } from "../utils/AuthErrors";
import { AuthShell, Button, Input, Notice } from "../components/ui/Primitives";
import { Link } from "react-router-dom";

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
      const data = await login(
        values.email.trim(),
        values.password,
        rememberMe,
      );
      const defaultDest =
        data?.role === ROLES.ADMIN ? "/admin" : ROUTES.DASHBOARD;
      const redirectTo = location.state?.from?.pathname || defaultDest;
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
    <AuthShell
      title="Welcome back"
      description="Sign in to check in on your websites."
      footer={
        <>
          New to SiteWatch? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="sw-form" onSubmit={handleSubmit} noValidate>
        {apiError && <Notice tone="error">{apiError}</Notice>}
        {unverifiedEmail && (
          <Notice tone="warning">
            Your email needs verification. Check your inbox for a verification
            link, or request a new one from the sign up flow.
          </Notice>
        )}
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
          autoComplete="current-password"
          placeholder="Enter your password"
          value={values.password || ""}
          onChange={makeChangeHandler("password")}
          onBlur={handleBlur("password")}
          error={errors.password}
          required
        />
        <div className="form-inline">
          <label className="check-label">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />{" "}
            Remember me
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
