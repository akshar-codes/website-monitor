import asyncHandler from "../utils/asyncHandler.js";
import * as apiKeyService from "../services/apiKey.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const listApiKeys = asyncHandler(async (req, res) =>
  sendSuccess(res, { data: await apiKeyService.listApiKeys(req.user) }),
);
export const createApiKey = asyncHandler(async (req, res) => {
  const result = await apiKeyService.createApiKey(req.user, req.body);
  sendSuccess(res, {
    statusCode: 201,
    message:
      "API key created. Copy the secret now; it will not be shown again.",
    data: result,
  });
});
export const revokeApiKey = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: "API key revoked",
    data: await apiKeyService.revokeApiKey(req.user, req.params.id),
  }),
);
export const deleteApiKey = asyncHandler(async (req, res) => {
  await apiKeyService.deleteApiKey(req.user, req.params.id);
  sendSuccess(res, { message: "API key deleted" });
});
