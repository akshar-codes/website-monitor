import { AlertTriangle } from "lucide-react";

/**
 * Shared inline error banner for the auth pages (Login, Register,
 * ForgotPassword, ResetPassword). Renders nothing when there's no message,
 * so callers can render it unconditionally at the top of the form.
 */
export default function AuthErrorBanner({ message }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
