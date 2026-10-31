import { escapeHtml } from "../baseTemplate.js";

export function buildSuggestionReplyEmail({
  name,
  title,
  reply,
  suggestionsUrl,
}) {
  const safeName = escapeHtml(name || "there");
  const safeTitle = escapeHtml(title);
  const safeReply = escapeHtml(reply).replace(/\r?\n/g, "<br />");
  const safeUrl = escapeHtml(suggestionsUrl);
  const subject = "The SiteWatch team replied to your suggestion";

  return {
    subject,
    html: `<!doctype html><html><body style="margin:0;background:#f4f8fb;font-family:Arial,sans-serif;color:#203754"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 14px;background:#f4f8fb"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e1e9ef;border-radius:14px"><tr><td style="padding:28px"><p style="margin:0 0 8px;color:#078b68;font-size:12px;font-weight:bold;letter-spacing:1px">SITEWATCH · SUGGESTION REPLY</p><h1 style="margin:0 0 18px;font-size:22px">We replied to your suggestion</h1><p style="color:#536987">Hi ${safeName},</p><p style="color:#536987">Our team replied to <strong>${safeTitle}</strong>:</p><div style="padding:16px;border:1px solid #dcece5;border-radius:10px;background:#f6fbf8;line-height:1.65">${safeReply}</div><p style="margin:24px 0"><a href="${safeUrl}" style="display:inline-block;padding:11px 17px;border-radius:8px;background:#078b68;color:#fff;text-decoration:none;font-weight:bold">View in SiteWatch</a></p><p style="margin:0;color:#8294a7;font-size:12px">You can also find this reply on your Suggestions page.</p></td></tr></table></td></tr></table></body></html>`,
    text: `Hi ${name || "there"},\n\nOur team replied to your suggestion “${title}”:\n\n${reply}\n\nView in SiteWatch: ${suggestionsUrl}`,
  };
}
