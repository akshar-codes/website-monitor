import Suggestion from "../models/Suggestion.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import ApiError from "../utils/ApiError.js";
import Notification from "../models/Notification.js";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
} from "../config/notificationConstants.js";
import { sendSuggestionReplyEmail } from "../services/email.service.js";
import logger from "../utils/logger.js";

export const createSuggestion = asyncHandler(async (req, res) => {
  const suggestion = await Suggestion.create({
    ...req.body,
    user: req.user._id,
  });

  sendSuccess(res, {
    statusCode: 201,
    message: "Thanks for sharing your suggestion.",
    data: { id: suggestion.id, status: suggestion.status },
  });
});

export const listSuggestions = asyncHandler(async (_req, res) => {
  const suggestions = await Suggestion.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("user", "name email")
    .lean();

  sendSuccess(res, { data: suggestions });
});

export const listMySuggestions = asyncHandler(async (req, res) => {
  const suggestions = await Suggestion.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  sendSuccess(res, { data: suggestions });
});

export const markSuggestionReviewed = asyncHandler(async (req, res) => {
  const suggestion = await Suggestion.findByIdAndUpdate(
    req.params.id,
    { status: "reviewed" },
    { new: true, runValidators: true },
  );

  if (!suggestion) throw ApiError.notFound("Suggestion not found");
  sendSuccess(res, { message: "Suggestion marked as reviewed." });
});

export const replyToSuggestion = asyncHandler(async (req, res) => {
  const suggestion = await Suggestion.findById(req.params.id).populate(
    "user",
    "name email",
  );
  if (!suggestion) throw ApiError.notFound("Suggestion not found");

  suggestion.adminReply = req.body.reply;
  suggestion.repliedAt = new Date();
  suggestion.status = "replied";
  await suggestion.save();

  let notification = null;
  try {
    notification = await Notification.create({
      owner: suggestion.user._id,
      type: NOTIFICATION_TYPES.SUGGESTION_REPLY,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      title: "We replied to your suggestion",
      message: `Our team replied to “${suggestion.title}”. Open Suggestions to read the response.`,
      link: "/suggestions",
      relatedResource: {
        resourceType: "suggestion",
        resourceId: suggestion._id,
      },
      channels: { inApp: { sent: true, sentAt: new Date() } },
    });
  } catch (error) {
    logger.warn(
      `In-app suggestion reply notification failed: ${error.message}`,
    );
  }

  let emailSent = false;
  try {
    await sendSuggestionReplyEmail(
      suggestion.user,
      suggestion,
      suggestion.adminReply,
    );
    emailSent = true;
    if (notification) {
      notification.channels.email = {
        sent: true,
        sentAt: new Date(),
        error: null,
      };
    }
  } catch (error) {
    if (notification) {
      notification.channels.email = {
        sent: false,
        sentAt: null,
        error: error.message,
      };
    }
    logger.warn(
      `Suggestion reply email failed for ${suggestion.user.email}: ${error.message}`,
    );
  }
  if (notification) {
    try {
      await notification.save();
    } catch (error) {
      logger.warn(
        `Suggestion reply delivery status could not be saved: ${error.message}`,
      );
    }
  }

  sendSuccess(res, {
    message: "Reply saved.",
    data: { suggestion, emailSent, inAppNotified: Boolean(notification) },
  });
});
