import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { FormField, Input } from "../ui/Input";
import Button from "../ui/Button";
import * as authApi from "../../services/api/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `compact` renders a single-row [input + button] layout meant to sit
 * inline under an error banner (e.g. Login's "email not verified" state).
 * The default (non-compact) layout is a full-width standalone form, used
 * on the verification page and the post-registration screen.
 */
export default function ResendVerificationForm({
  initialEmail = "",
  compact = false,
}) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleChange = (e) => {
    setEmail(e.target.value);
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();

    if (!EMAIL_REGEX.test(trimmed)) {
      setError("Enter a valid email address");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await authApi.resendVerification(trimmed);
      setSent(true);
    } catch {
      // The endpoint always resolves with a generic success message on the
      // server; reaching this catch means something else went wrong
      // (network failure, rate limit) rather than "account not found".
      setError("Something went wrong. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        <span>
          If an account with that email exists and isn&apos;t verified yet, a
          new verification email is on its way.
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={handleChange}
            disabled={submitting}
            error={!!error}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="secondary"
            size="md"
            icon={Send}
            loading={submitting}
            disabled={submitting}
            className="shrink-0"
          >
            Resend
          </Button>
        </div>
        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <FormField label="Email address" error={error}>
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={handleChange}
          disabled={submitting}
          error={!!error}
        />
      </FormField>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        icon={Send}
        loading={submitting}
        disabled={submitting}
        className="w-full"
      >
        Resend verification email
      </Button>
    </form>
  );
}
