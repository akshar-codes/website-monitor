import Monitor from "../models/Monitor.js";
import ApiError from "../utils/ApiError.js";

// ── Service methods ───────────────────────────────────────────────────────────

export const createMonitor = async (data) => {
  const existing = await Monitor.findOne({ url: data.url });
  if (existing) {
    throw ApiError.conflict(`A monitor for "${data.url}" already exists`);
  }

  return Monitor.create(data);
};

export const getMonitors = async ({ page, limit, active, sortBy, order }) => {
  const filter = {};
  if (active !== undefined) filter.active = active;

  const sort = { [sortBy]: order === "asc" ? 1 : -1 };
  const skip = (page - 1) * limit;

  const [monitors, total] = await Promise.all([
    Monitor.find(filter).sort(sort).skip(skip).limit(limit),
    Monitor.countDocuments(filter),
  ]);

  return {
    monitors,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

export const getMonitorById = async (id) => {
  const monitor = await Monitor.findById(id);
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${id}`);
  }
  return monitor;
};

export const updateMonitor = async (id, data) => {
  if (data.url) {
    const existing = await Monitor.findOne({
      url: data.url,
      _id: { $ne: id },
    });
    if (existing) {
      throw ApiError.conflict(`A monitor for "${data.url}" already exists`);
    }
  }

  // Reactivating a monitor schedules an immediate re-check.
  if (data.active === true) {
    data.nextCheckAt = new Date();
  }

  const monitor = await Monitor.findByIdAndUpdate(id, data, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${id}`);
  }

  return monitor;
};

export const deleteMonitor = async (id) => {
  const monitor = await Monitor.findByIdAndDelete(id);
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${id}`);
  }
  return monitor;
};
