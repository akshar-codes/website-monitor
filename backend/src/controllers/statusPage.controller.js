import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as service from "../services/statusPage.service.js";

export const list = asyncHandler(async (req, res) =>
  sendSuccess(res, { data: await service.list(req.user._id) }),
);
export const create = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    statusCode: 201,
    data: await service.create(req.user._id, req.body),
  }),
);
export const get = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: (await service.getOwned(req.params.id, req.user._id)).toJSON(),
  }),
);
export const update = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.update(req.params.id, req.user._id, req.body),
  }),
);
export const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, req.user._id);
  sendSuccess(res, { message: "Status page deleted" });
});
export const publish = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.setPublished(req.params.id, req.user._id, true),
  }),
);
export const unpublish = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.setPublished(req.params.id, req.user._id, false),
  }),
);
export const addService = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    statusCode: 201,
    data: await service.addService(req.params.id, req.user._id, req.body),
  }),
);
export const updateService = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.updateService(
      req.params.id,
      req.params.serviceId,
      req.user._id,
      req.body,
    ),
  }),
);
export const removeService = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.removeService(
      req.params.id,
      req.params.serviceId,
      req.user._id,
    ),
  }),
);
export const getPublic = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=30");
  sendSuccess(res, { data: await service.getPublic(req.params.slug) });
});
