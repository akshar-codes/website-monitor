import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import useAuthForm from "../hooks/useAuthForm";
import { ROUTES } from "../constants/routes";
import { mapAuthError } from "../utils/AuthErrors";
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

  return null;
}
