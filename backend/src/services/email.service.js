import env from "../config/env.js";
import logger from "../utils/logger.js";
import { getTransporter } from "../config/mail.js";
import { buildVerificationEmail } from "../utils/email/templates/verificationEmail.js";
import { buildPasswordResetEmail } from "../utils/email/templates/passwordResetEmail.js";
import { buildPasswordChangedEmail } from "../utils/email/templates/passwordChangedEmail.js";
import { buildPlanUpgradeApprovedEmail } from "../utils/email/templates/planUpgradeApprovedEmail.js";
import { buildPlanUpgradeRejectedEmail } from "../utils/email/templates/planUpgradeRejectedEmail.js";

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
