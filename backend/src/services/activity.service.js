import mongoose from "mongoose";
import Activity from "../models/Activity.js";
import { WINDOW_MS } from "../config/constants.js";
import { msBefore } from "../utils/dateUtils.js";
import { escapeRegExp } from "../utils/regex.js";

const resolveOwnerId = (user) => user.id || user._id.toString();

/**
 * Narrows a list query to the window param, mirroring the
 * requireWindowWithinRetention pattern's reuse of WINDOW_MS as the single
 * source of truth for what "24h"/"7d"/"30d" mean. "all" (the default)
 * applies no time bound.
 */
const applyWindowFilter = (filter, window) => {
  if (!window || window === "all") return filter;
  const ms = WINDOW_MS[window];
  if (!ms) return filter;
  return { ...filter, createdAt: { $gte: msBefore(ms) } };
};

// ── List (paginated, filtered, searchable) ──────────────────────────────────

export const getActivities = async (
  { page, limit, category, action, search, window },
  user,
) => {
  const ownerId = resolveOwnerId(user);

  let filter = { user: ownerId };
  if (category) filter.category = category;
  if (action) filter.action = action;
  filter = applyWindowFilter(filter, window);

  if (search) {
    filter.description = new RegExp(escapeRegExp(search), "i");
  }

  const skip = (page - 1) * limit;

  const [activities, total] = await Promise.all([
    Activity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Activity.countDocuments(filter),
  ]);

  return {
    activities,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

// ── Recent activity summary ─────────────────────────────────────────────────

/**
 * Powers the "recent activity" panel: the last `limit` entries plus a
 * category breakdown and total count over the trailing 30 days — enough
 * for an at-a-glance summary without the caller needing to paginate
 * through the full list.
 */
export const getRecentActivitySummary = async (user, { limit = 10 } = {}) => {
  const ownerId = resolveOwnerId(user);
  const since = msBefore(WINDOW_MS["30d"]);

  const [recent, categoryBreakdown, totalLast30d] = await Promise.all([
    Activity.find({ user: ownerId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),

    Activity.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(ownerId),
          createdAt: { $gte: since },
        },
      },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    Activity.countDocuments({ user: ownerId, createdAt: { $gte: since } }),
  ]);

  return {
    recent,
    totalLast30Days: totalLast30d,
    byCategory: categoryBreakdown.map((c) => ({
      category: c._id,
      count: c.count,
    })),
  };
};
