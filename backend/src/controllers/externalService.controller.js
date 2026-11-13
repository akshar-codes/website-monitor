import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as externalServiceService from "../services/externalService.service.js";

export const createExternalService = asyncHandler(async (req, res) => {
  const data = await externalServiceService.createExternalService(
    req.body,
    req.user,
  );
  sendSuccess(res, {
    statusCode: 201,
    message: "External service created successfully",
    data,
  });
});

export const getExternalServices = asyncHandler(async (req, res) => {
  const data = await externalServiceService.getExternalServices(req.user);
  sendSuccess(res, { data });
});

export const getExternalServiceById = asyncHandler(async (req, res) => {
  const data = await externalServiceService.getExternalServiceById(
    req.params.id,
    req.user,
  );
  sendSuccess(res, { data });
});

export const updateExternalService = asyncHandler(async (req, res) => {
  const data = await externalServiceService.updateExternalService(
    req.params.id,
    req.body,
    req.user,
  );
  sendSuccess(res, {
    message: "External service updated successfully",
    data,
  });
});

export const deleteExternalService = asyncHandler(async (req, res) => {
  const data = await externalServiceService.deleteExternalService(
    req.params.id,
    req.user,
  );
  sendSuccess(res, {
    message: "External service deleted successfully",
    data,
  });
});
