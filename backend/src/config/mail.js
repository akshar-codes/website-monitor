import nodemailer from "nodemailer";
import env from "./env.js";
import logger from "../utils/logger.js";

let transporter = null;

/**
 * Lazily creates (and memoizes) the nodemailer transport from SMTP_* env
 * config. Lazy so importing this module never has side effects, and so
 * a single instance is reused for every outgoing email.
 */
export const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return transporter;
};

/**
 * Verifies SMTP connectivity at startup. Deliberately non-fatal — a
 * misconfigured/unreachable mail server shouldn't prevent the API from
 * serving traffic, it should just be logged loudly so it gets noticed.
 */
export const verifyMailTransport = async () => {
  try {
    await getTransporter().verify();
    logger.info("SMTP transport verified — email sending is available");
  } catch (error) {
    logger.error(`SMTP transport verification failed: ${error.message}`, {
      stack: error.stack,
    });
  }
};
