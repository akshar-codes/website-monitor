import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as service from "../services/statusPage.service.js";
import {
  readSubscriberPreferences,
  updateSubscriberPreferences as saveSubscriberPreferences,
} from "../services/statusNotification.service.js";

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
export const preview = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.getPreview(
      req.params.id,
      req.user,
      req.query.window || "90d",
    ),
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
  res.set("Cache-Control", "public, max-age=0, must-revalidate");
  sendSuccess(res, {
    data: await service.getPublic(
      req.params.slug,
      req.validatedQuery?.window || "90d",
    ),
  });
});
export const getPublicServices = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: (await service.getPublic(req.params.slug)).services,
  }),
);
export const getPublicIncidents = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: (await service.getPublic(req.params.slug)).incidents,
  }),
);
export const getPublicMaintenance = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: (await service.getPublic(req.params.slug)).maintenance,
  }),
);
export const getPublicUptime = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: (
      await service.getPublic(req.params.slug, req.validatedQuery.window)
    ).services.map(({ name, uptimePercentage, uptimeDays, uptimeWindow }) => ({
      name,
      uptimePercentage,
      uptimeDays,
      uptimeWindow,
    })),
  }),
);
export const reorderServices = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.reorderServices(
      req.params.id,
      req.user,
      req.body.serviceIds,
    ),
  }),
);
export const listIncidents = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.listIncidents(req.params.id, req.user),
  }),
);
export const getIncident = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.getIncident(
      req.params.id,
      req.params.incidentId,
      req.user,
    ),
  }),
);
export const createIncident = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    statusCode: 201,
    data: await service.createIncident(req.params.id, req.user, req.body),
  }),
);
export const updateIncident = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.updateIncident(
      req.params.id,
      req.params.incidentId,
      req.user,
      req.body,
    ),
  }),
);
export const addIncidentUpdate = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.addIncidentUpdate(
      req.params.id,
      req.params.incidentId,
      req.user,
      req.body,
    ),
  }),
);
export const publishIncident = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.publishIncident(
      req.params.id,
      req.params.incidentId,
      req.user,
    ),
  }),
);
export const resolveIncident = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.resolveIncident(
      req.params.id,
      req.params.incidentId,
      req.user,
      req.body.message,
    ),
  }),
);
export const listMaintenance = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.listMaintenance(req.params.id, req.user),
  }),
);
export const createMaintenance = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    statusCode: 201,
    data: await service.createMaintenance(req.params.id, req.user, req.body),
  }),
);
export const updateMaintenance = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.updateMaintenance(
      req.params.id,
      req.params.maintenanceId,
      req.user,
      req.body,
    ),
  }),
);
export const removeMaintenance = asyncHandler(async (req, res) => {
  await service.removeMaintenance(
    req.params.id,
    req.params.maintenanceId,
    req.user,
  );
  sendSuccess(res, { message: "Maintenance removed" });
});
export const subscriberStats = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    data: await service.subscriberStats(req.params.id, req.user),
  }),
);
export const subscribe = asyncHandler(async (req, res) => {
  await service.subscribe(
    req.params.slug,
    req.body.email,
    req.body.preferences,
  );
  sendSuccess(res, {
    message:
      "Your subscription request has been processed. Check your inbox if email confirmation is required.",
  });
});
export const verifySubscription = asyncHandler(async (req, res) => {
  if (!(await service.verifySubscription(req.body.token)))
    return res.status(400).json({
      success: false,
      message: "This verification link is invalid or has expired.",
    });
  sendSuccess(res, {
    message: "Your email is confirmed. You’ll receive status updates.",
  });
});
export const unsubscribe = asyncHandler(async (req, res) => {
  if (!(await service.unsubscribe(req.body.token)))
    return res
      .status(400)
      .json({ success: false, message: "This unsubscribe link is invalid." });
  sendSuccess(res, {
    message: "You have been unsubscribed from status updates.",
  });
});
export const getSubscriberPreferences = asyncHandler(async (req, res) => {
  const data = await readSubscriberPreferences(req.body.token);
  if (!data)
    return res
      .status(400)
      .json({ success: false, message: "This preferences link is invalid." });
  sendSuccess(res, { data });
});
export const updateSubscriberPreferences = asyncHandler(async (req, res) => {
  if (!(await saveSubscriberPreferences(req.body.token, req.body.preferences)))
    return res
      .status(400)
      .json({ success: false, message: "This preferences link is invalid." });
  sendSuccess(res, {
    message: "Your notification preferences have been saved.",
  });
});
