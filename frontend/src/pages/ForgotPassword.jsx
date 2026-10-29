import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthForm from "../hooks/useAuthForm";
import { ROUTES } from "../constants/routes";
import { mapAuthError } from "../utils/AuthErrors";
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

  return null;
}
