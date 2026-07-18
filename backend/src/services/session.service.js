import mongoose from "mongoose";
import { SESSION_COLLECTION_NAME } from "../config/session.js";
import logger from "../utils/logger.js";

/**
 * connect-mongo owns this collection directly — there's no Mongoose model
 */
const getSessionsCollection = () =>
  mongoose.connection.collection(SESSION_COLLECTION_NAME);

const toSessionSummary = (doc, currentSessionId) => {
  const deviceInfo = doc.session?.deviceInfo || {};
  return {
    id: doc._id,
    current: doc._id === currentSessionId,
    ip: deviceInfo.ip || null,
    userAgent: deviceInfo.userAgent || null,
    loginAt: deviceInfo.loginAt || null,
    expiresAt: doc.expires || null,
  };
};

/**
 * List every active session belonging to a user, newest expiry first.
 */
export const listUserSessions = async (userId, currentSessionId) => {
  const docs = await getSessionsCollection()
    .find({ "session.passport.user": userId })
    .sort({ expires: -1 })
    .toArray();

  return docs.map((doc) => toSessionSummary(doc, currentSessionId));
};

/**
 * Revoke a single session by ID. Scoped to `userId` so one user can never
 */
export const destroySessionById = async (sessionId, userId) => {
  const result = await getSessionsCollection().deleteOne({
    _id: sessionId,
    "session.passport.user": userId,
  });
  return result.deletedCount > 0;
};

/**
 * Revoke every session belonging to a user. Pass `exceptSessionId` to keep
 */
export const destroyAllUserSessions = async (
  userId,
  { exceptSessionId } = {},
) => {
  const filter = { "session.passport.user": userId };
  if (exceptSessionId) {
    filter._id = { $ne: exceptSessionId };
  }

  const result = await getSessionsCollection().deleteMany(filter);

  logger.info(
    `Destroyed ${result.deletedCount} session(s) for user ${userId}${
      exceptSessionId ? " (current session preserved)" : ""
    }`,
  );

  return result.deletedCount;
};
