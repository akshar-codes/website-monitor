import { renderBaseEmail, renderButton, escapeHtml } from "../baseTemplate.js";
import { getPlanDefinition } from "../../../config/plans.js";

export function buildPlanUpgradeRejectedEmail({
  name,
  plan,
  reason,
  billingUrl,
}) {
  const safeName = escapeHtml(name || "there");
  const definition = getPlanDefinition(plan);
  const planName = escapeHtml(definition?.name || plan);
  const safeReason = reason ? escapeHtml(reason) : null;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;font-weight:600;color:#fafafa;">
      Your plan upgrade request was declined
    </p>
    <p style="margin:0 0 ${safeReason ? "12px" : "20px"} 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
      Hi ${safeName}, your request to upgrade to the
      <strong style="color:#e4e4e7;">${planName}</strong> plan was reviewed
      by an administrator and was not approved.
    </p>
    ${
      safeReason
        ? `<p style="margin:0 0 20px 0;padding:12px 14px;border-radius:10px;background-color:#18181b;border:1px solid #27272a;font-size:13px;line-height:1.6;color:#d4d4d8;">
            ${safeReason}
          </p>`
        : ""
    }
    ${renderButton(billingUrl, "View billing")}
    <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:#52525b;">
      You're welcome to submit a new request at any time.
    </p>
  `;

  return {
    subject: `Your WebMonitor upgrade request to ${definition?.name || plan} was declined`,
    html: renderBaseEmail({
      previewText: `Your upgrade request to the ${definition?.name || plan} plan was declined.`,
      bodyHtml,
    }),
    text:
      `Hi ${name || "there"},\n\n` +
      `Your request to upgrade to the ${definition?.name || plan} plan was reviewed by an administrator and was not approved.` +
      (safeReason ? `\n\nReason: ${reason}` : "") +
      `\n\nYou're welcome to submit a new request at any time.\n\n` +
      `View billing: ${billingUrl}`,
  };
}
