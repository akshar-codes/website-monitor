export function renderBaseEmail({
  previewText = "",
  bodyHtml,
  footerNote = "",
}) {
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WebMonitor</title>
  </head>
  <body style="margin:0;padding:0;background-color:#09090b;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:#09090b;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      ${escapeHtml(previewText)}
    </span>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090b;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#111113;border:1px solid #27272a;border-radius:14px;overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="padding:28px 32px 20px 32px;border-bottom:1px solid #1f1f23;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:36px;height:36px;background-color:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:10px;text-align:center;vertical-align:middle;">
                      <span style="color:#10b981;font-size:16px;font-weight:700;line-height:36px;">W</span>
                    </td>
                    <td style="padding-left:12px;">
                      <p style="margin:0;font-size:14px;font-weight:600;color:#fafafa;">WebMonitor</p>
                      <p style="margin:0;font-size:11px;color:#71717a;">Uptime Platform</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                ${bodyHtml}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #1f1f23;">
                <p style="margin:0 0 4px 0;font-size:11px;color:#52525b;">
                  ${footerNote || "This is an automated message — please don't reply directly to this email."}
                </p>
                <p style="margin:0;font-size:11px;color:#3f3f46;">
                  &copy; ${year} WebMonitor. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Minimal HTML-escaping for values interpolated into email markup (names,
 * preview text) — prevents malformed markup if a user's display name
 * happens to contain HTML-significant characters.
 */
export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Shared button markup used across email templates — table-based so it
 * renders reliably in Outlook's Word rendering engine.
 */
export function renderButton(url, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:#10b981;border-radius:10px;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#052e1f;text-decoration:none;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}
