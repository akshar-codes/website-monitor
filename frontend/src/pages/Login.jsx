import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import useAuthForm from "../hooks/useAuthForm";
import { ROUTES } from "../constants/routes";
import { ROLES } from "../constants/roles";
import { mapAuthError, getAuthErrorCode } from "../utils/AuthErrors";

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

  return null;
}
