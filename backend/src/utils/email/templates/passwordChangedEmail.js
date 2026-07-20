import { renderBaseEmail, escapeHtml } from "../baseTemplate.js";

/**
 * Sent immediately after a password reset completes. Purely informational
 * — carries no link or token — so it's safe to send even if the request
 * that triggered it wasn't legitimate; it simply lets the real account
 * owner know a change occurred and every session was signed out.
 */
export function buildPasswordChangedEmail({ name }) {
  const safeName = escapeHtml(name || "there");

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;font-weight:600;color:#fafafa;">
      Your password was changed
    </p>
    <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
      Hi ${safeName}, this confirms that the password on your WebMonitor
      account was just changed. For your security, every active session —
      including this device — has been signed out.
    </p>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#52525b;">
      If you made this change, no further action is needed. If you didn't
      request this password change, please reset your password again
      immediately and consider whether your email account may have been
      compromised.
    </p>
  `;

  return {
    subject: "Your WebMonitor password was changed",
    html: renderBaseEmail({
      previewText: "Your WebMonitor account password was just changed.",
      bodyHtml,
    }),
    text:
      `Hi ${name || "there"},\n\n` +
      `This confirms that the password on your WebMonitor account was just changed. ` +
      `For your security, every active session — including this device — has been signed out.\n\n` +
      `If you made this change, no further action is needed. If you didn't request this ` +
      `password change, please reset your password again immediately and consider whether ` +
      `your email account may have been compromised.`,
  };
}
