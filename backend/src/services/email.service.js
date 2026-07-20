import env from "../config/env.js";
import logger from "../utils/logger.js";
import { getTransporter } from "../config/mail.js";
import { buildVerificationEmail } from "../utils/email/templates/verificationEmail.js";
import { buildPasswordResetEmail } from "../utils/email/templates/passwordResetEmail.js";
import { buildPasswordChangedEmail } from "../utils/email/templates/passwordChangedEmail.js";

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
