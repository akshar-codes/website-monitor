import { renderBaseEmail, renderButton, escapeHtml } from "../baseTemplate.js";
import { getPlanDefinition } from "../../../config/plans.js";

export function buildPlanUpgradeRequestSubmittedEmail({
  adminName,
  requesterName,
  requesterEmail,
  currentPlan,
  requestedPlan,
  requestsUrl,
}) {
  const safeAdminName = escapeHtml(adminName || "Administrator");
  const safeRequesterName = escapeHtml(requesterName || "A user");
  const safeRequesterEmail = escapeHtml(requesterEmail || "");
  const currentPlanName = escapeHtml(
    getPlanDefinition(currentPlan)?.name || currentPlan,
  );
  const requestedPlanName = escapeHtml(
    getPlanDefinition(requestedPlan)?.name || requestedPlan,
  );

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;font-weight:600;color:#fafafa;">
      A plan upgrade request needs review
    </p>
    <p style="margin:0 0 20px 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
      Hi ${safeAdminName}, ${safeRequesterName} (${safeRequesterEmail}) requested an upgrade
      from <strong style="color:#e4e4e7;">${currentPlanName}</strong> to
      <strong style="color:#e4e4e7;">${requestedPlanName}</strong>.
    </p>
    ${renderButton(requestsUrl, "Review plan request")}
  `;

  return {
    subject: `Plan upgrade request: ${getPlanDefinition(requestedPlan)?.name || requestedPlan}`,
    html: renderBaseEmail({
      previewText: `${requesterName || "A user"} requested a plan upgrade.`,
      bodyHtml,
    }),
    text:
      `Hi ${adminName || "Administrator"},\n\n` +
      `${requesterName || "A user"} (${requesterEmail || "unknown email"}) requested an upgrade ` +
      `from ${getPlanDefinition(currentPlan)?.name || currentPlan} to ` +
      `${getPlanDefinition(requestedPlan)?.name || requestedPlan}.\n\n` +
      `Review the request: ${requestsUrl}`,
  };
}
