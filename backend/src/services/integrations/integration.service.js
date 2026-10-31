import NotificationIntegration from "../../models/NotificationIntegration.js";
import NotificationDelivery from "../../models/NotificationDelivery.js";
import { encryptCredential } from "../../utils/credentialEncryption.js";
import {
  deliverToProvider,
  validatePublicHttpsUrl,
} from "./deliveryProvider.service.js";
import ApiError from "../../utils/ApiError.js";

const ownerId = (user) => user.id || user._id;
const publicIntegration = (doc) => {
  const row = doc.toObject ? doc.toObject() : doc;
  const hasCustomHeaders = Boolean(row.credentials?.customHeaders);
  delete row.credentials;
  return { ...row, hasCredentials: true, hasCustomHeaders };
};

const validateProviderTarget = async (provider, target) => {
  if (!target) return;
  const { url } = await validatePublicHttpsUrl(target);
  if (provider === "slack" && url.hostname !== "hooks.slack.com")
    throw ApiError.badRequest("Slack webhook must use hooks.slack.com");
  if (
    provider === "discord" &&
    !["discord.com", "discordapp.com"].includes(url.hostname)
  )
    throw ApiError.badRequest("Discord webhook must use discord.com");
};

const encodeInput = async (provider, data, existing = null) => {
  const config = { ...(existing?.config || {}) };
  const credentials = { ...(existing?.credentials || {}) };
  if (data.username !== undefined) config.username = data.username;
  if (data.chatId !== undefined) config.chatId = data.chatId;
  if (data.endpointUrl !== undefined) config.endpointUrl = data.endpointUrl;
  if (data.webhookUrl !== undefined) {
    await validateProviderTarget(provider, data.webhookUrl);
    credentials.webhookUrl = encryptCredential(data.webhookUrl);
  }
  if (data.botToken !== undefined)
    credentials.botToken = encryptCredential(data.botToken);
  if (data.signingSecret !== undefined)
    credentials.signingSecret = encryptCredential(data.signingSecret);
  if (data.customHeaders !== undefined) {
    if (provider !== "webhook")
      throw ApiError.badRequest(
        "Custom headers are supported only for custom webhooks",
      );
    credentials.customHeaders = encryptCredential(
      JSON.stringify(data.customHeaders),
    );
  }
  if (provider === "webhook" && config.endpointUrl)
    await validatePublicHttpsUrl(config.endpointUrl);
  return { config, credentials };
};

export const listIntegrations = async (user) =>
  (
    await NotificationIntegration.find({ owner: ownerId(user) }).sort({
      createdAt: -1,
    })
  ).map(publicIntegration);

export const createIntegration = async (data, user) => {
  const { config, credentials } = await encodeInput(data.provider, data);
  const integration = await NotificationIntegration.create({
    owner: ownerId(user),
    name: data.name,
    provider: data.provider,
    config,
    credentials,
  });
  return publicIntegration(integration);
};

export const updateIntegration = async (id, data, user) => {
  const integration = await NotificationIntegration.findOne({
    _id: id,
    owner: ownerId(user),
  }).select("+credentials");
  if (!integration) throw ApiError.notFound("Integration not found");
  const { config, credentials } = await encodeInput(
    integration.provider,
    data,
    integration,
  );
  if (data.name !== undefined) integration.name = data.name;
  if (data.isActive !== undefined) integration.isActive = data.isActive;
  integration.config = config;
  integration.credentials = credentials;
  integration.lastError = null;
  await integration.save();
  return publicIntegration(integration);
};

export const setIntegrationActive = async (id, isActive, user) => {
  const integration = await NotificationIntegration.findOneAndUpdate(
    { _id: id, owner: ownerId(user) },
    { $set: { isActive } },
    { returnDocument: "after" },
  );
  if (!integration) throw ApiError.notFound("Integration not found");
  if (!isActive)
    await NotificationDelivery.updateMany(
      {
        integration: id,
        owner: ownerId(user),
        status: { $in: ["pending", "failed"] },
      },
      { $set: { status: "cancelled" } },
    );
  return publicIntegration(integration);
};

export const deleteIntegration = async (id, user) => {
  const integration = await NotificationIntegration.findOneAndDelete({
    _id: id,
    owner: ownerId(user),
  });
  if (!integration) throw ApiError.notFound("Integration not found");
  await NotificationDelivery.updateMany(
    {
      integration: id,
      owner: ownerId(user),
      status: { $in: ["pending", "failed"] },
    },
    { $set: { status: "cancelled" } },
  );
  return { deleted: true };
};

export const testIntegration = async (id, user) => {
  const integration = await NotificationIntegration.findOne({
    _id: id,
    owner: ownerId(user),
  }).select("+credentials");
  if (!integration) throw ApiError.notFound("Integration not found");
  const now = new Date();
  try {
    await deliverToProvider(integration, {
      eventId: `test_${now.getTime()}`,
      type: "integration.test",
      title: "SiteWatch test alert",
      message:
        "Your notification integration is connected and ready to receive alerts.",
      priority: "normal",
      createdAt: now.toISOString(),
    });
    integration.lastTestedAt = now;
    integration.lastSuccessAt = now;
    integration.lastError = null;
    await integration.save();
    return { success: true, testedAt: now };
  } catch (error) {
    integration.lastTestedAt = now;
    integration.lastError =
      "Test delivery failed. Check the destination and try again.";
    await integration.save();
    return { success: false, testedAt: now };
  }
};
