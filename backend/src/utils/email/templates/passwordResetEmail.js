import { renderBaseEmail, renderButton, escapeHtml } from "../baseTemplate.js";

export function buildPasswordResetEmail({ name, resetUrl, expiresInMinutes }) {
  const safeName = escapeHtml(name || "there");

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;font-weight:600;color:#fafafa;">
      Reset your password
    </p>
    <p style="margin:0 0 20px 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
      Hi ${safeName}, we received a request to reset the password for your
      WebMonitor account. Click the button below to choose a new password.
    </p>
    ${renderButton(resetUrl, "Reset password")}
    <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:#71717a;">
      This link expires in ${expiresInMinutes} minute${expiresInMinutes === 1 ? "" : "s"}.
      If the button doesn't work, copy and paste this URL into your browser:
    </p>
    <p style="margin:8px 0 0 0;font-size:12px;line-height:1.6;word-break:break-all;color:#10b981;">
      ${resetUrl}
    </p>
    <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:#52525b;">
      If you didn't request a password reset, you can safely ignore this
      email — your password will not be changed.
    </p>
  `;

  return {
    subject: "Reset your WebMonitor password",
    html: renderBaseEmail({
      previewText: "Reset the password for your WebMonitor account.",
      bodyHtml,
    }),
    text:
      `Hi ${name || "there"},\n\n` +
      `We received a request to reset the password for your WebMonitor account. ` +
      `Reset it by visiting the link below:\n\n` +
      `${resetUrl}\n\n` +
      `This link expires in ${expiresInMinutes} minute${expiresInMinutes === 1 ? "" : "s"}.\n\n` +
      `If you didn't request a password reset, you can safely ignore this email — your password will not be changed.`,
  };
}
