import StatusPage from "../models/StatusPage.js";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import ApiError from "../utils/ApiError.js";

const RESERVED = new Set([
  "api",
  "admin",
  "login",
  "register",
  "status",
  "settings",
  "dashboard",
  "monitors",
]);
const id = (value) => String(value?._id || value);
const serialize = (page) => page.toJSON();

export async function list(owner) {
  return (await StatusPage.find({ owner }).sort({ createdAt: -1 })).map(
    serialize,
  );
}
export async function getOwned(pageId, owner) {
  const page = await StatusPage.findOne({ _id: pageId, owner });
  if (!page) throw ApiError.notFound("Status page not found");
  return page;
}
export async function create(owner, data) {
  if (RESERVED.has(data.slug))
    throw ApiError.badRequest("This slug is reserved");
  try {
    return serialize(await StatusPage.create({ ...data, owner }));
  } catch (error) {
    if (error.code === 11000)
      throw ApiError.conflict("That status page URL is already in use");
    throw error;
  }
}
export async function update(pageId, owner, data) {
  const page = await getOwned(pageId, owner);
  if (data.slug && RESERVED.has(data.slug))
    throw ApiError.badRequest("This slug is reserved");
  Object.assign(page, data);
  try {
    return serialize(await page.save());
  } catch (error) {
    if (error.code === 11000)
      throw ApiError.conflict("That status page URL is already in use");
    throw error;
  }
}
export async function remove(pageId, owner) {
  await StatusPage.deleteOne({ _id: (await getOwned(pageId, owner))._id });
}
export async function setPublished(pageId, owner, publish) {
  const page = await getOwned(pageId, owner);
  page.isPublished = publish;
  page.publishedAt = publish ? new Date() : page.publishedAt;
  return serialize(await page.save());
}
export async function addService(pageId, owner, data) {
  const page = await getOwned(pageId, owner);
  const monitor = await Monitor.findOne({ _id: data.monitorId, owner });
  if (!monitor) throw ApiError.notFound("Monitor not found");
  if (page.services.some((service) => id(service.monitor) === data.monitorId))
    throw ApiError.conflict("Monitor is already on this page");
  page.services.push({
    monitor: monitor._id,
    displayName: data.displayName || monitor.name,
    description: data.description || "",
    displayOrder: page.services.length,
    isVisible: data.isVisible ?? true,
  });
  return serialize(await page.save());
}
export async function updateService(pageId, serviceId, owner, data) {
  const page = await getOwned(pageId, owner);
  const service = page.services.id(serviceId);
  if (!service) throw ApiError.notFound("Status page service not found");
  Object.assign(service, data);
  return serialize(await page.save());
}
export async function removeService(pageId, serviceId, owner) {
  const page = await getOwned(pageId, owner);
  const service = page.services.id(serviceId);
  if (!service) throw ApiError.notFound("Status page service not found");
  service.deleteOne();
  page.services.forEach((item, index) => {
    item.displayOrder = index;
  });
  return serialize(await page.save());
}
export async function getPublic(slug) {
  const page = await StatusPage.findOne({ slug, isPublished: true })
    .populate({
      path: "services.monitor",
      select: "owner active interval lastCheckedAt",
    })
    .lean();
  if (!page) throw ApiError.notFound("Status page not found");
  const services = (page.services || [])
    .filter(
      (service) =>
        service.isVisible &&
        service.monitor &&
        String(service.monitor.owner) === String(page.owner),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const snapshots = await Promise.all(
    services.map(async (service) => {
      const monitor = service.monitor;
      const check = await HealthCheck.findOne({ monitor: monitor._id })
        .sort({ checkedAt: -1 })
        .select("status checkedAt")
        .lean();
      const stale =
        !check ||
        Date.now() - new Date(check.checkedAt).getTime() >
          (monitor.interval || 300) * 3000;
      const status =
        !monitor.active || stale
          ? "unknown"
          : { up: "operational", degraded: "degraded", down: "major_outage" }[
              check.status
            ] || "unknown";
      const uptime = await HealthCheck.uptimePercent(
        monitor._id,
        90 * 24 * 60 * 60 * 1000,
      );
      return {
        id: String(service._id),
        name: service.displayName,
        description: service.description,
        status,
        uptime90d: uptime,
        lastCheckedAt: check?.checkedAt || null,
      };
    }),
  );
  const order = ["major_outage", "degraded", "unknown", "operational"];
  const status = snapshots.length
    ? snapshots.reduce(
        (worst, item) =>
          order.indexOf(item.status) < order.indexOf(worst)
            ? item.status
            : worst,
        "operational",
      )
    : "unknown";
  return {
    name: page.name,
    slug: page.slug,
    description: page.description,
    logo: page.logo,
    timezone: page.timezone,
    status,
    updatedAt: page.updatedAt,
    services: snapshots,
  };
}
