import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import useAuthForm from "../hooks/useAuthForm";
import { ROUTES } from "../constants/routes";
import { mapAuthError } from "../utils/AuthErrors";

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

  return null;
}
