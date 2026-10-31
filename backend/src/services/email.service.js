import env from "../config/env.js";
import logger from "../utils/logger.js";
import { getTransporter } from "../config/mail.js";
import { buildVerificationEmail } from "../utils/email/templates/verificationEmail.js";
import { buildPasswordResetEmail } from "../utils/email/templates/passwordResetEmail.js";
import { buildPasswordChangedEmail } from "../utils/email/templates/passwordChangedEmail.js";
import { buildPlanUpgradeApprovedEmail } from "../utils/email/templates/planUpgradeApprovedEmail.js";
import { buildPlanUpgradeRejectedEmail } from "../utils/email/templates/planUpgradeRejectedEmail.js";
import { buildPlanUpgradeRequestSubmittedEmail } from "../utils/email/templates/planUpgradeRequestSubmittedEmail.js";
import { buildSuggestionReplyEmail } from "../utils/email/templates/suggestionReplyEmail.js";

const sendMail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    html,
    text,
  });
};

/**
 * Sends the account-verification email issued at registration (and on
 * resend requests).
 */
export const sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${env.CLIENT_URL}/verify-email?token=${token}`;
  const expiresInHours = Math.round(
    env.EMAIL_VERIFICATION_TOKEN_EXPIRES_MS / (60 * 60 * 1000),
  );

  const { subject, html, text } = buildVerificationEmail({
    name: user.name,
    verificationUrl,
    expiresInHours,
  });

  await sendMail({ to: user.email, subject, html, text });

  logger.info(`Verification email sent to ${user.email}`);
};

/**
 * Sends the password-reset link issued by POST /auth/forgot-password.
 */
export const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;
  const expiresInMinutes = Math.round(
    env.PASSWORD_RESET_TOKEN_EXPIRES_MS / (60 * 1000),
  );

  const { subject, html, text } = buildPasswordResetEmail({
    name: user.name,
    resetUrl,
    expiresInMinutes,
  });

  await sendMail({ to: user.email, subject, html, text });

  logger.info(`Password reset email sent to ${user.email}`);
};

/**
 * Sends the post-reset security notification. Best-effort — callers
 * should not let a failure here fail the password-reset request itself.
 */
export const sendPasswordChangedEmail = async (user) => {
  const { subject, html, text } = buildPasswordChangedEmail({
    name: user.name,
  });

  await sendMail({ to: user.email, subject, html, text });

  logger.info(`Password-changed notification sent to ${user.email}`);
};

/**
 * Sends the "your upgrade request was approved" notification once an
 * admin approves a PlanUpgradeRequest (see
 * services/planUpgradeRequest.service.js#approveRequest). Best-effort —
 * the plan change has already been applied by the time this is called, so
 * a delivery failure here must never fail the approval itself.
 */
export const sendPlanUpgradeRequestApprovedEmail = async (user, plan) => {
  const billingUrl = `${env.CLIENT_URL}/billing`;

  const { subject, html, text } = buildPlanUpgradeApprovedEmail({
    name: user.name,
    plan,
    billingUrl,
  });

  await sendMail({ to: user.email, subject, html, text });

  logger.info(`Plan-upgrade-approved email sent to ${user.email}`);
};

/**
 * Sends the "your upgrade request was declined" notification once an
 * admin rejects a PlanUpgradeRequest, optionally including the admin's
 * reason. Best-effort — see sendPlanUpgradeRequestApprovedEmail above.
 */
export const sendPlanUpgradeRequestRejectedEmail = async (
  user,
  plan,
  reason,
) => {
  const billingUrl = `${env.CLIENT_URL}/billing`;

  const { subject, html, text } = buildPlanUpgradeRejectedEmail({
    name: user.name,
    plan,
    reason,
    billingUrl,
  });

  await sendMail({ to: user.email, subject, html, text });

  logger.info(`Plan-upgrade-rejected email sent to ${user.email}`);
};

/** Notifies an administrator that a new plan upgrade request is awaiting review. */
export const sendPlanUpgradeRequestSubmittedEmail = async (
  admin,
  requester,
  currentPlan,
  requestedPlan,
) => {
  const requestsUrl = `${env.CLIENT_URL}/admin/plan-requests`;
  const { subject, html, text } = buildPlanUpgradeRequestSubmittedEmail({
    adminName: admin.name,
    requesterName: requester.name,
    requesterEmail: requester.email,
    currentPlan,
    requestedPlan,
    requestsUrl,
  });

  await sendMail({ to: admin.email, subject, html, text });
  logger.info(`Plan-upgrade-request email sent to admin ${admin.email}`);
};

/** Sends the SiteWatch team reply to a user's suggestion. */
export const sendSuggestionReplyEmail = async (user, suggestion, reply) => {
  const suggestionsUrl = `${env.CLIENT_URL}/suggestions`;
  const { subject, html, text } = buildSuggestionReplyEmail({
    name: user.name,
    title: suggestion.title,
    reply,
    suggestionsUrl,
  });

  await sendMail({ to: user.email, subject, html, text });
  logger.info(`Suggestion reply email sent to ${user.email}`);
};

const escapeEmailText = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export const sendNotificationEmail = async (user, notification) => {
  const title = escapeEmailText(notification.title);
  const message = escapeEmailText(notification.message);
  const actionUrl = notification.link
    ? `${env.CLIENT_URL}${notification.link}`
    : env.CLIENT_URL;
  const html = `<div style="font-family:Arial,sans-serif;color:#18181b;max-width:600px"><h2>${title}</h2><p>${message}</p><p><a href="${escapeEmailText(actionUrl)}">View in SiteWatch</a></p></div>`;
  await sendMail({
    to: user.email,
    subject: notification.title.replace(/[\r\n]+/g, " "),
    html,
    text: `${notification.title}\n\n${notification.message}\n\n${actionUrl}`,
  });
};

export const sendNotificationDigestEmail = async (
  user,
  notifications,
  frequency,
) => {
  const rows = notifications
    .map(
      (item) =>
        `<li><strong>${escapeEmailText(item.title)}</strong><br/>${escapeEmailText(item.message)}</li>`,
    )
    .join("");
  const html = `<div style="font-family:Arial,sans-serif;color:#18181b;max-width:600px"><h2>Your ${frequency} monitoring digest</h2><ul>${rows}</ul><p><a href="${escapeEmailText(env.CLIENT_URL)}">Open SiteWatch</a></p></div>`;
  const text = [
    `Your ${frequency} monitoring digest`,
    ...notifications.map((item) => `${item.title}: ${item.message}`),
  ].join("\n\n");
  await sendMail({
    to: user.email,
    subject: `SiteWatch ${frequency} digest (${notifications.length})`,
    html,
    text,
  });
};

export const sendStatusSubscriberEmail = async ({
  to,
  subject,
  message,
  statusUrl,
  preferencesUrl,
  unsubscribeUrl,
}) => {
  const safe = (value = "") =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const html = `<div style="font-family:Arial,sans-serif;color:#18181b;max-width:600px"><h2>${safe(subject)}</h2><p>${safe(message)}</p><p><a href="${safe(statusUrl)}">View status page</a></p><p style="font-size:12px;color:#666">You received this because you subscribed to status updates. <a href="${safe(preferencesUrl)}">Manage preferences</a> · <a href="${safe(unsubscribeUrl)}">Unsubscribe</a>.</p></div>`;
  await sendMail({
    to,
    subject: subject.replace(/[\r\n]+/g, " "),
    html,
    text: `${message}\n\n${statusUrl}\n\nManage preferences: ${preferencesUrl}\nUnsubscribe: ${unsubscribeUrl}`,
  });
};

export const sendStatusVerificationEmail = async ({
  to,
  pageName,
  verificationUrl,
}) => {
  const safe = (value = "") =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const html = `<div style="font-family:Arial,sans-serif;color:#18181b;max-width:600px"><h2>Confirm your status updates</h2><p>Confirm your email to receive incident and maintenance updates for ${safe(pageName)}.</p><p><a href="${safe(verificationUrl)}">Verify subscription</a></p><p>This link expires in 24 hours.</p></div>`;
  await sendMail({
    to,
    subject: `Confirm status updates for ${pageName}`.replace(/[\r\n]+/g, " "),
    html,
    text: `Confirm your email to receive status updates for ${pageName}: ${verificationUrl}`,
  });
};
