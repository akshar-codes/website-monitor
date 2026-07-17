import { useCallback, useState } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password strength used by both the register form's validation and the
 * PasswordStrengthMeter display — a single source of truth for the rules.
 */
export function getPasswordStrength(password = "") {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  const LEVELS = [
    { label: "Very weak", color: "#ef4444" },
    { label: "Weak", color: "#ef4444" },
    { label: "Fair", color: "#f59e0b" },
    { label: "Good", color: "#3b82f6" },
    { label: "Strong", color: "#10b981" },
  ];

  return { score, ...LEVELS[score], checks };
}

const validateName = (value) => {
  const v = value?.trim() ?? "";
  if (!v) return "Full name is required";
  if (v.length < 2) return "Name must be at least 2 characters";
  if (v.length > 120) return "Name cannot exceed 120 characters";
  return "";
};

const validateEmail = (value) => {
  const v = value?.trim() ?? "";
  if (!v) return "Email address is required";
  if (!EMAIL_REGEX.test(v)) return "Enter a valid email address";
  return "";
};

const validateRequiredPassword = (value) => {
  if (!value) return "Password is required";
  return "";
};

const validateStrongPassword = (value) => {
  if (!value) return "Password is required";
  const { checks } = getPasswordStrength(value);
  if (!checks.length) return "Password must be at least 8 characters";
  if (!checks.uppercase) return "Include at least one uppercase letter";
  if (!checks.number) return "Include at least one number";
  if (!checks.special) return "Include at least one special character";
  return "";
};

const validateConfirmPassword = (value, password) => {
  if (!value) return "Please confirm your password";
  if (value !== password) return "Passwords do not match";
  return "";
};

/**
 * Lightweight controlled-form hook for the auth pages.
 * `fields` — array of field names to manage (subset of
 * "name" | "email" | "password" | "confirmPassword").
 * Presence of "confirmPassword" signals register-mode, which enables full
 * password-strength validation; without it (login) only presence is checked.
 */
export default function useAuthForm(fields, validateOnBlur = false) {
  const isRegisterMode = fields.includes("confirmPassword");

  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f, ""])),
  );
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = useCallback(
    (field, value, allValues) => {
      switch (field) {
        case "name":
          return validateName(value);
        case "email":
          return validateEmail(value);
        case "password":
          return isRegisterMode
            ? validateStrongPassword(value)
            : validateRequiredPassword(value);
        case "confirmPassword":
          return validateConfirmPassword(value, allValues.password);
        default:
          return "";
      }
    },
    [isRegisterMode],
  );

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);

    // Live-revalidate once a field has been touched or already has an error,
    // so corrections clear the error immediately instead of on next blur.
    if (touched[field] || errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: validateField(field, value, nextValues),
      }));
    }

    // If password changes after confirmPassword was already validated,
    // re-check the match immediately.
    if (field === "password" && touched.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateConfirmPassword(
          nextValues.confirmPassword,
          value,
        ),
      }));
    }
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (validateOnBlur) {
      setErrors((prev) => ({
        ...prev,
        [field]: validateField(field, values[field], values),
      }));
    }
  };

  const validateAll = () => {
    const nextErrors = {};
    fields.forEach((field) => {
      nextErrors[field] = validateField(field, values[field], values);
    });
    setErrors(nextErrors);
    setTouched(Object.fromEntries(fields.map((f) => [f, true])));
    return Object.values(nextErrors).every((msg) => !msg);
  };

  const setFieldError = (field, message) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  };

  const clearErrors = () => setErrors({});

  return {
    values,
    errors,
    handleChange,
    handleBlur,
    validateAll,
    setFieldError,
    clearErrors,
  };
}
