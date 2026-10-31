import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { getRegionsForUser } from "../services/regionalProbe.service.js";

export const listRegions = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await getRegionsForUser(req.user) });
});
