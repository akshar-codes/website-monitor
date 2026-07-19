import { renderBaseEmail, renderButton, escapeHtml } from "../baseTemplate.js";

export function buildVerificationEmail({
  name,
  verificationUrl,
  expiresInHours,
}) {
  const safeName = escapeHtml(name || "there");

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;font-weight:600;color:#fafafa;">
      Verify your email address
    </p>
    <p style="margin:0 0 20px 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
      Hi ${safeName}, thanks for signing up for WebMonitor. Confirm your email
      address to activate your account and start monitoring your services.
    </p>
    ${renderButton(verificationUrl, "Verify email address")}
    <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:#71717a;">
      This link expires in ${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}.
      If the button doesn't work, copy and paste this URL into your browser:
    </p>
    <p style="margin:8px 0 0 0;font-size:12px;line-height:1.6;word-break:break-all;color:#10b981;">
      ${verificationUrl}
    </p>
    <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:#52525b;">
      If you didn't create a WebMonitor account, you can safely ignore this email.
    </p>
  `;

  return {
    subject: "Verify your WebMonitor email address",
    html: renderBaseEmail({
      previewText:
        "Confirm your email address to activate your WebMonitor account.",
      bodyHtml,
    }),
    text:
      `Hi ${name || "there"},\n\n` +
      `Thanks for signing up for WebMonitor. Verify your email address by visiting the link below:\n\n` +
      `${verificationUrl}\n\n` +
      `This link expires in ${expiresInHours} hour${expiresInHours === 1 ? "" : "s"}.\n\n` +
      `If you didn't create a WebMonitor account, you can safely ignore this email.`,
  };
}
