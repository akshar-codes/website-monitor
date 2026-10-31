import { HEALTH_STATUS, ROLES } from "../config/constants.js";
import User from "../models/User.js";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import Activity from "../models/Activity.js";

const PLANS = ["free", "pro", "unlimited"];
export async function getAdminDashboard({ startDate, endDate }) {
  const range = { $gte: startDate, $lte: endDate };
  const [
    _users,
    planCounts,
    monitorCountsByPlan,
    monitors,
    latestChecks,
    checks,
    recentRegistrations,
    activity,
  ] = await Promise.all([
    User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$active", true] }, 1, 0] } },
        },
      },
    ]),
    User.aggregate([
      { $match: { role: { $ne: ROLES.ADMIN } } },
      { $group: { _id: "$plan", count: { $sum: 1 } } },
    ]),
    Monitor.aggregate([
      {
        $lookup: {
          from: User.collection.name,
          localField: "owner",
          foreignField: "_id",
          as: "owner",
        },
      },
      { $unwind: "$owner" },
      { $match: { "owner.role": { $ne: ROLES.ADMIN } } },
      { $group: { _id: "$owner.plan", count: { $sum: 1 } } },
    ]),
    Monitor.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ["$active", 1, 0] } },
        },
      },
    ]),
    HealthCheck.aggregate([
      { $sort: { monitor: 1, checkedAt: -1 } },
      { $group: { _id: "$monitor", status: { $first: "$status" } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    HealthCheck.aggregate([
      { $match: { checkedAt: range } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          failed: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    [HEALTH_STATUS.DOWN, HEALTH_STATUS.DEGRADED],
                  ],
                },
                1,
                0,
              ],
            },
          },
          averageResponseTime: { $avg: "$responseTime" },
        },
      },
    ]),
    User.aggregate([
      { $match: { createdAt: range } },
      { $sort: { createdAt: -1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: Monitor.collection.name,
          localField: "_id",
          foreignField: "owner",
          as: "customerMonitors",
        },
      },
      { $addFields: { monitorCount: { $size: "$customerMonitors" } } },
      {
        $project: {
          name: 1,
          plan: 1,
          role: 1,
          active: 1,
          createdAt: 1,
          monitorCount: 1,
        },
      },
    ]),
    Activity.find({ category: "admin", createdAt: range })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("user action description entityType createdAt")
      .populate("user", "name")
      .lean(),
  ]);

  const statusCounts = Object.fromEntries(
    Object.values(HEALTH_STATUS).map((status) => [status, 0]),
  );
  for (const item of latestChecks) statusCounts[item._id] = item.count;
  const monitorTotal = monitors[0]?.total || 0;
  const classified = Object.values(statusCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  statusCounts.unknown += Math.max(0, monitorTotal - classified);
  const checkStats = checks[0] || {
    total: 0,
    failed: 0,
    averageResponseTime: 0,
  };

  return {
    range: { startDate, endDate },
    users: {
      total: await User.countDocuments({ role: { $ne: ROLES.ADMIN } }),
      active: await User.countDocuments({
        role: { $ne: ROLES.ADMIN },
        active: true,
      }),
      byPlan: Object.fromEntries(
        PLANS.map((plan) => [
          plan,
          {
            users: planCounts.find((item) => item._id === plan)?.count || 0,
            monitors:
              monitorCountsByPlan.find((item) => item._id === plan)?.count || 0,
          },
        ]),
      ),
      registeredInRange: await User.countDocuments({
        role: { $ne: ROLES.ADMIN },
        createdAt: range,
      }),
    },
    monitors: {
      total: monitorTotal,
      active: monitors[0]?.active || 0,
      statuses: statusCounts,
    },
    system: {
      checksInRange: checkStats.total,
      failedChecksInRange: checkStats.failed,
      failureRate: checkStats.total
        ? Number(((checkStats.failed / checkStats.total) * 100).toFixed(2))
        : 0,
      averageResponseTime: Math.round(checkStats.averageResponseTime || 0),
    },
    recentRegistrations: recentRegistrations.map(
      ({ _id, name, plan, role, active, createdAt, monitorCount }) => ({
        id: String(_id),
        name,
        plan,
        role,
        active,
        createdAt,
        monitorCount,
      }),
    ),
    recentAdminActivity: activity.map(
      ({ _id, user, action, description, entityType, createdAt }) => ({
        id: String(_id),
        actor: user?.name || "Former user",
        action,
        description,
        entityType,
        createdAt,
      }),
    ),
  };
}
