import ExternalService from "../models/ExternalService.js";
import ServiceDependency from "../models/ServiceDependency.js";
import ApiError from "../utils/ApiError.js";

const resolveOwnerId = (user) => (user?._id || user?.id || user).toString();

export const createExternalService = async (payload, user) => {
  const owner = resolveOwnerId(user);
  const existing = await ExternalService.findOne({ owner, name: payload.name });
  if (existing) {
    throw ApiError.conflict(
      `An external service named "${payload.name}" already exists.`,
    );
  }

  const service = new ExternalService({
    ...payload,
    owner,
  });

  await service.save();
  return service;
};

export const getExternalServices = async (user) => {
  const owner = resolveOwnerId(user);
  return ExternalService.find({ owner }).sort({ name: 1 });
};

export const getExternalServiceById = async (id, user) => {
  const owner = resolveOwnerId(user);
  const service = await ExternalService.findOne({ _id: id, owner });
  if (!service) {
    throw ApiError.notFound(`External service not found with id: ${id}`);
  }
  return service;
};

export const updateExternalService = async (id, payload, user) => {
  const owner = resolveOwnerId(user);
  const service = await ExternalService.findOne({ _id: id, owner });
  if (!service) {
    throw ApiError.notFound(`External service not found with id: ${id}`);
  }

  if (payload.name && payload.name !== service.name) {
    const existing = await ExternalService.findOne({
      owner,
      name: payload.name,
      _id: { $ne: id },
    });
    if (existing) {
      throw ApiError.conflict(
        `An external service named "${payload.name}" already exists.`,
      );
    }
  }

  Object.assign(service, payload);
  await service.save();
  return service;
};

export const deleteExternalService = async (id, user) => {
  const owner = resolveOwnerId(user);
  const service = await ExternalService.findOne({ _id: id, owner });
  if (!service) {
    throw ApiError.notFound(`External service not found with id: ${id}`);
  }

  // Cascading cleanup of dependencies referencing this external service
  await Promise.all([
    ServiceDependency.deleteMany({
      owner,
      dependencyExternalService: service._id,
    }),
    service.deleteOne(),
  ]);

  return { success: true, deletedId: id };
};
