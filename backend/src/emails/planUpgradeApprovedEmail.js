import { renderBaseEmail, renderButton, escapeHtml } from "../baseTemplate.js";
import { getPlanDefinition } from "../../../config/plans.js";

export function buildPlanUpgradeApprovedEmail({ name, plan, billingUrl }) {
  const safeName = escapeHtml(name || "there");
  const definition = getPlanDefinition(plan);
  const planName = escapeHtml(definition?.name || plan);

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;font-weight:600;color:#fafafa;">
      Your plan upgrade was approved
    </p>
    <p style="margin:0 0 20px 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
      Hi ${safeName}, good news — an administrator has approved your request
      to upgrade to the <strong style="color:#e4e4e7;">${planName}</strong> plan.
      Your account has already been updated and the new limits are active.
    </p>
    ${renderButton(billingUrl, "View your plan")}
    <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:#52525b;">
      If you have any questions about your new plan, reach out to support.
    </p>
  `;

  return {
    subject: `Your WebMonitor upgrade to ${definition?.name || plan} was approved`,
    html: renderBaseEmail({
      previewText: `Your upgrade to the ${definition?.name || plan} plan is now active.`,
      bodyHtml,
    }),
    text:
      `Hi ${name || "there"},\n\n` +
      `An administrator has approved your request to upgrade to the ${definition?.name || plan} plan. ` +
      `Your account has already been updated and the new limits are active.\n\n` +
      `View your plan: ${billingUrl}`,
  };
}
