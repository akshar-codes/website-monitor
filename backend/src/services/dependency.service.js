import mongoose from "mongoose";
import ServiceDependency from "../models/ServiceDependency.js";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import Incident from "../models/Incident.js";
import ExternalService from "../models/ExternalService.js";
import ApiError from "../utils/ApiError.js";
import {
  GRAPH_LIMITS,
  DEPENDENCY_TARGET_TYPES,
  HEALTH_STATUS,
  INCIDENT_STATUS,
} from "../config/constants.js";
import { getPlanDefinition } from "../config/plans.js";
import { validateAcyclic, detectCycle } from "../utils/dagValidator.js";

const resolveOwnerId = (user) => (user?._id || user?.id || user).toString();

const MONITOR_SUMMARY_FIELDS = "name url kind interval active lastCheckedAt";
const EXTERNAL_SERVICE_FIELDS = "name type description host status isActive";

/**
 * Counts total dependencies owned by the user.
 */
export const countOwnedDependencies = async (user) => {
  const owner = resolveOwnerId(user);
  return ServiceDependency.countDocuments({ owner });
};

/**
 * Validates plan limits before adding a new dependency.
 */
const assertDependencyLimit = async (user) => {
  const definition = getPlanDefinition(user?.plan);
  const maxDependencies = definition?.limits?.maxDependencies;
  if (maxDependencies === null || maxDependencies === undefined) {
    return; // Unlimited tier
  }

  const currentCount = await countOwnedDependencies(user);
  if (currentCount >= maxDependencies) {
    throw ApiError.upgradeRequired(
      `You have reached the maximum allowed dependencies (${maxDependencies}) for your ${definition.name} plan. Upgrade to configure more service relationships.`,
      "pro",
    );
  }
};

/**
 * Helper to compute health state for a monitor node based on its latest check,
 * staleness threshold, active state, and concurrent incidents.
 */
export const deriveMonitorHealthState = (
  monitor,
  latestCheck,
  activeIncident,
) => {
  if (!monitor.active) {
    return {
      healthState: "disabled",
      isStale: false,
      lastCheckedAt: latestCheck?.checkedAt || monitor.lastCheckedAt || null,
      responseTime: latestCheck?.responseTime ?? null,
      httpStatus: latestCheck?.httpStatus ?? null,
      failureReason: latestCheck?.failureReason ?? null,
    };
  }

  // Never treat missing health data as healthy
  if (!latestCheck || !latestCheck.checkedAt) {
    return {
      healthState: "unknown",
      isStale: false,
      lastCheckedAt: null,
      responseTime: null,
      httpStatus: null,
      failureReason: null,
    };
  }

  const checkedAt = new Date(latestCheck.checkedAt);
  const now = Date.now();
  const intervalSeconds = Number(monitor.interval) || 300;
  const stalenessThresholdMs = Math.max(
    intervalSeconds * GRAPH_LIMITS.HEALTH_DATA_STALENESS_FACTOR * 1000,
    GRAPH_LIMITS.MIN_STALENESS_SECONDS * 1000,
  );

  const isStale = now - checkedAt.getTime() > stalenessThresholdMs;

  let healthState = "unknown";
  if (isStale) {
    healthState = "stale";
  } else if (activeIncident) {
    healthState =
      activeIncident.severity === "minor" ? "degraded" : "unhealthy";
  } else if (latestCheck.status === HEALTH_STATUS.UP) {
    healthState = "healthy";
  } else if (latestCheck.status === HEALTH_STATUS.DEGRADED) {
    healthState = "degraded";
  } else if (latestCheck.status === HEALTH_STATUS.DOWN) {
    healthState = "unhealthy";
  }

  return {
    healthState,
    isStale,
    lastCheckedAt: checkedAt,
    responseTime: latestCheck.responseTime ?? null,
    httpStatus: latestCheck.httpStatus ?? null,
    failureReason: latestCheck.failureReason ?? null,
  };
};

/**
 * Create a new service dependency with strict tenant isolation, self-dependency rejection,
 * duplicate prevention, DAG cycle detection, and concurrent modification protection.
 */
export const createDependency = async (payload, user) => {
  const owner = resolveOwnerId(user);
  await assertDependencyLimit(user);

  const {
    dependentMonitorId,
    toType = DEPENDENCY_TARGET_TYPES.MONITOR,
    dependencyMonitorId,
    dependencyExternalServiceId,
    dependencyType = "hard",
    description = "",
  } = payload;

  // 1. Verify dependent monitor exists and belongs to the authorized tenant
  const dependentMonitor = await Monitor.findOne({
    _id: dependentMonitorId,
    owner,
  });
  if (!dependentMonitor) {
    throw ApiError.notFound(
      `Dependent monitor not found or unauthorized with id: ${dependentMonitorId}`,
    );
  }

  let targetMonitor = null;
  let targetExternalService = null;

  if (toType === DEPENDENCY_TARGET_TYPES.MONITOR) {
    // 2. Reject self-dependency
    if (String(dependentMonitorId) === String(dependencyMonitorId)) {
      throw ApiError.badRequest(
        "A service cannot depend on itself (self-dependency rejected).",
        "SELF_DEPENDENCY_REJECTED",
      );
    }

    // 3. Verify dependency monitor exists and belongs to the authorized tenant
    targetMonitor = await Monitor.findOne({
      _id: dependencyMonitorId,
      owner,
    });
    if (!targetMonitor) {
      throw ApiError.notFound(
        `Dependency monitor not found or unauthorized with id: ${dependencyMonitorId}`,
      );
    }

    // 4. Duplicate edge check
    const existing = await ServiceDependency.findOne({
      owner,
      dependentMonitor: dependentMonitor._id,
      dependencyMonitor: targetMonitor._id,
    });
    if (existing) {
      throw ApiError.conflict(
        `A dependency between "${dependentMonitor.name}" and "${targetMonitor.name}" already exists.`,
        "DUPLICATE_DEPENDENCY",
      );
    }

    // 5. Graph Cycle Detection (Pre-insert check)
    const activeEdges = await ServiceDependency.find({
      owner,
      isActive: true,
      toType: DEPENDENCY_TARGET_TYPES.MONITOR,
    })
      .select("dependentMonitor dependencyMonitor")
      .lean();

    const monitors = await Monitor.find({ owner }).select("name").lean();
    const nameMap = new Map(monitors.map((m) => [String(m._id), m.name]));

    validateAcyclic(
      activeEdges,
      {
        dependentMonitor: dependentMonitor._id,
        dependencyMonitor: targetMonitor._id,
      },
      { nodeNameMap: nameMap },
    );
  } else if (toType === DEPENDENCY_TARGET_TYPES.EXTERNAL_SERVICE) {
    // Verify external service exists and belongs to authorized tenant
    targetExternalService = await ExternalService.findOne({
      _id: dependencyExternalServiceId,
      owner,
    });
    if (!targetExternalService) {
      throw ApiError.notFound(
        `External service not found or unauthorized with id: ${dependencyExternalServiceId}`,
      );
    }

    // Duplicate check
    const existing = await ServiceDependency.findOne({
      owner,
      dependentMonitor: dependentMonitor._id,
      dependencyExternalService: targetExternalService._id,
    });
    if (existing) {
      throw ApiError.conflict(
        `A dependency between "${dependentMonitor.name}" and external service "${targetExternalService.name}" already exists.`,
        "DUPLICATE_DEPENDENCY",
      );
    }
  }

  // 6. Persist dependency edge
  const dependency = new ServiceDependency({
    owner,
    dependentMonitor: dependentMonitor._id,
    toType,
    dependencyMonitor: targetMonitor?._id || null,
    dependencyExternalService: targetExternalService?._id || null,
    dependencyType,
    description,
    isActive: true,
  });

  await dependency.save();

  // 7. Post-insert cycle verification guard against race conditions
  if (toType === DEPENDENCY_TARGET_TYPES.MONITOR) {
    const postEdges = await ServiceDependency.find({
      owner,
      isActive: true,
      toType: DEPENDENCY_TARGET_TYPES.MONITOR,
    })
      .select("dependentMonitor dependencyMonitor")
      .lean();

    const { hasCycle } = detectCycle(postEdges);
    if (hasCycle) {
      // Rollback newly inserted edge immediately
      await ServiceDependency.deleteOne({ _id: dependency._id });
      throw ApiError.conflict(
        "A concurrent modification introduced a circular dependency loop. The operation has been safely rolled back.",
        "CONCURRENT_CYCLE_DETECTED",
      );
    }
  }

  return ServiceDependency.findById(dependency._id)
    .populate("dependentMonitor", MONITOR_SUMMARY_FIELDS)
    .populate("dependencyMonitor", MONITOR_SUMMARY_FIELDS)
    .populate("dependencyExternalService", EXTERNAL_SERVICE_FIELDS);
};

/**
 * Pre-flight validation of a proposed dependency without committing to the database.
 */
export const validateProposedDependency = async (payload, user) => {
  const owner = resolveOwnerId(user);
  const {
    dependentMonitorId,
    toType = DEPENDENCY_TARGET_TYPES.MONITOR,
    dependencyMonitorId,
    dependencyExternalServiceId,
  } = payload;

  const dependentMonitor = await Monitor.findOne({
    _id: dependentMonitorId,
    owner,
  });
  if (!dependentMonitor) {
    return {
      isValid: false,
      code: "NOT_FOUND",
      message: `Dependent monitor not found with id: ${dependentMonitorId}`,
    };
  }

  if (toType === DEPENDENCY_TARGET_TYPES.MONITOR) {
    if (String(dependentMonitorId) === String(dependencyMonitorId)) {
      return {
        isValid: false,
        code: "SELF_DEPENDENCY_REJECTED",
        message: "A monitor cannot depend on itself.",
      };
    }

    const targetMonitor = await Monitor.findOne({
      _id: dependencyMonitorId,
      owner,
    });
    if (!targetMonitor) {
      return {
        isValid: false,
        code: "NOT_FOUND",
        message: `Dependency monitor not found with id: ${dependencyMonitorId}`,
      };
    }

    const existing = await ServiceDependency.findOne({
      owner,
      dependentMonitor: dependentMonitor._id,
      dependencyMonitor: targetMonitor._id,
    });
    if (existing) {
      return {
        isValid: false,
        code: "DUPLICATE_DEPENDENCY",
        message: "A dependency between these monitors already exists.",
      };
    }

    const activeEdges = await ServiceDependency.find({
      owner,
      isActive: true,
      toType: DEPENDENCY_TARGET_TYPES.MONITOR,
    })
      .select("dependentMonitor dependencyMonitor")
      .lean();

    const monitors = await Monitor.find({ owner }).select("name").lean();
    const nameMap = new Map(monitors.map((m) => [String(m._id), m.name]));

    try {
      const result = validateAcyclic(
        activeEdges,
        {
          dependentMonitor: dependentMonitor._id,
          dependencyMonitor: targetMonitor._id,
        },
        { nodeNameMap: nameMap },
      );
      return {
        isValid: true,
        maxDepth: result.maxDepth,
        message: "Valid dependency configuration.",
      };
    } catch (err) {
      return {
        isValid: false,
        code: err.code || "CYCLE_DETECTED",
        message: err.message,
      };
    }
  } else {
    const ext = await ExternalService.findOne({
      _id: dependencyExternalServiceId,
      owner,
    });
    if (!ext) {
      return {
        isValid: false,
        code: "NOT_FOUND",
        message: `External service not found with id: ${dependencyExternalServiceId}`,
      };
    }
    return {
      isValid: true,
      maxDepth: 1,
      message: "Valid external dependency configuration.",
    };
  }
};

/**
 * List dependencies with filtering and pagination.
 */
export const getDependencies = async (query = {}, user) => {
  const owner = resolveOwnerId(user);
  const {
    page = 1,
    limit = 50,
    monitorId,
    dependentMonitorId,
    dependencyMonitorId,
    dependencyType,
    isActive,
    sortBy = "createdAt",
    order = "desc",
  } = query;

  const filter = { owner };

  if (monitorId) {
    const mId = new mongoose.Types.ObjectId(monitorId);
    filter.$or = [{ dependentMonitor: mId }, { dependencyMonitor: mId }];
  }
  if (dependentMonitorId) {
    filter.dependentMonitor = new mongoose.Types.ObjectId(dependentMonitorId);
  }
  if (dependencyMonitorId) {
    filter.dependencyMonitor = new mongoose.Types.ObjectId(dependencyMonitorId);
  }
  if (dependencyType) {
    filter.dependencyType = dependencyType;
  }
  if (isActive !== undefined) {
    filter.isActive = Boolean(isActive);
  }

  const sortDirection = order === "asc" ? 1 : -1;
  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));

  const [dependencies, total] = await Promise.all([
    ServiceDependency.find(filter)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(Number(limit))
      .populate("dependentMonitor", MONITOR_SUMMARY_FIELDS)
      .populate("dependencyMonitor", MONITOR_SUMMARY_FIELDS)
      .populate("dependencyExternalService", EXTERNAL_SERVICE_FIELDS),
    ServiceDependency.countDocuments(filter),
  ]);

  return { dependencies, total, page: Number(page) };
};

/**
 * Retrieves a monitor's direct dependencies (services it depends on)
 * and direct dependents (services that depend on it).
 */
export const getMonitorDependencies = async (monitorId, user) => {
  const owner = resolveOwnerId(user);

  // Validate monitor ownership
  const monitor = await Monitor.findOne({ _id: monitorId, owner }).select(
    MONITOR_SUMMARY_FIELDS,
  );
  if (!monitor) {
    throw ApiError.notFound(`Monitor not found with id: ${monitorId}`);
  }

  const [dependencies, dependents] = await Promise.all([
    // Services this monitor depends on (upstream)
    ServiceDependency.find({
      owner,
      dependentMonitor: monitor._id,
      isActive: true,
    })
      .populate("dependencyMonitor", MONITOR_SUMMARY_FIELDS)
      .populate("dependencyExternalService", EXTERNAL_SERVICE_FIELDS),

    // Services that depend on this monitor (downstream)
    ServiceDependency.find({
      owner,
      dependencyMonitor: monitor._id,
      isActive: true,
    }).populate("dependentMonitor", MONITOR_SUMMARY_FIELDS),
  ]);

  return {
    monitor,
    dependencies,
    dependents,
  };
};

/**
 * Update relationship metadata or enabled status.
 */
export const updateDependency = async (id, payload, user) => {
  const owner = resolveOwnerId(user);
  const dependency = await ServiceDependency.findOne({ _id: id, owner });
  if (!dependency) {
    throw ApiError.notFound(`Dependency not found with id: ${id}`);
  }

  // If re-activating an inactive monitor dependency, run cycle detection
  if (
    payload.isActive === true &&
    dependency.isActive === false &&
    dependency.toType === DEPENDENCY_TARGET_TYPES.MONITOR
  ) {
    const otherActiveEdges = await ServiceDependency.find({
      owner,
      _id: { $ne: dependency._id },
      isActive: true,
      toType: DEPENDENCY_TARGET_TYPES.MONITOR,
    })
      .select("dependentMonitor dependencyMonitor")
      .lean();

    validateAcyclic(otherActiveEdges, {
      dependentMonitor: dependency.dependentMonitor,
      dependencyMonitor: dependency.dependencyMonitor,
    });
  }

  if (payload.dependencyType !== undefined) {
    dependency.dependencyType = payload.dependencyType;
  }
  if (payload.description !== undefined) {
    dependency.description = payload.description;
  }
  if (payload.isActive !== undefined) {
    dependency.isActive = payload.isActive;
  }

  await dependency.save();

  return ServiceDependency.findById(dependency._id)
    .populate("dependentMonitor", MONITOR_SUMMARY_FIELDS)
    .populate("dependencyMonitor", MONITOR_SUMMARY_FIELDS)
    .populate("dependencyExternalService", EXTERNAL_SERVICE_FIELDS);
};

/**
 * Remove a dependency relationship.
 */
export const deleteDependency = async (id, user) => {
  const owner = resolveOwnerId(user);
  const result = await ServiceDependency.findOneAndDelete({ _id: id, owner });
  if (!result) {
    throw ApiError.notFound(`Dependency not found with id: ${id}`);
  }
  return { success: true, deletedId: id };
};

/**
 * Retrieves the complete dependency graph for the authenticated user,
 * avoiding N+1 queries through bounded single-pass aggregations.
 */
export const getDependencyGraph = async (user, options = {}) => {
  const owner = resolveOwnerId(user);
  const {
    connectedOnly = false,
    includeExternal = true,
    activeOnly = false,
  } = options;

  // 1. Fetch dependencies for user
  const edgeFilter = { owner };
  if (activeOnly) {
    edgeFilter.isActive = true;
  }

  const dependencies = await ServiceDependency.find(edgeFilter).lean();

  // 2. Collect unique monitor IDs
  const monitorIdSet = new Set();
  const externalServiceIdSet = new Set();

  for (const dep of dependencies) {
    if (dep.dependentMonitor) {
      monitorIdSet.add(dep.dependentMonitor.toString());
    }
    if (
      dep.toType === DEPENDENCY_TARGET_TYPES.MONITOR &&
      dep.dependencyMonitor
    ) {
      monitorIdSet.add(dep.dependencyMonitor.toString());
    } else if (
      dep.toType === DEPENDENCY_TARGET_TYPES.EXTERNAL_SERVICE &&
      dep.dependencyExternalService
    ) {
      externalServiceIdSet.add(dep.dependencyExternalService.toString());
    }
  }

  // If not connectedOnly, fetch all monitors owned by user to populate complete topology
  let monitorQuery = { owner };
  if (connectedOnly) {
    monitorQuery = {
      owner,
      _id: {
        $in: Array.from(monitorIdSet).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    };
  }

  const monitors = await Monitor.find(monitorQuery)
    .select(MONITOR_SUMMARY_FIELDS)
    .limit(GRAPH_LIMITS.MAX_GRAPH_NODES_PER_USER)
    .lean();

  const allMonitorIds = monitors.map((m) => m._id);

  // 3. Single bounded query for latest health check per monitor (Avoids N+1 query)
  const [latestChecksAgg, activeIncidents] = await Promise.all([
    HealthCheck.aggregate([
      { $match: { monitor: { $in: allMonitorIds } } },
      { $sort: { checkedAt: -1, _id: -1 } },
      {
        $group: {
          _id: "$monitor",
          status: { $first: "$status" },
          responseTime: { $first: "$responseTime" },
          httpStatus: { $first: "$httpStatus" },
          failureReason: { $first: "$failureReason" },
          checkedAt: { $first: "$checkedAt" },
        },
      },
    ]),
    Incident.find({
      monitor: { $in: allMonitorIds },
      status: { $ne: INCIDENT_STATUS.RESOLVED },
    })
      .select("monitor status severity startedAt rootCause")
      .lean(),
  ]);

  const latestChecksMap = new Map(
    latestChecksAgg.map((item) => [String(item._id), item]),
  );
  const activeIncidentsMap = new Map(
    activeIncidents.map((inc) => [String(inc.monitor), inc]),
  );

  // 4. Fetch external services if requested
  let externalServices = [];
  if (includeExternal && externalServiceIdSet.size > 0) {
    externalServices = await ExternalService.find({
      owner,
      _id: {
        $in: Array.from(externalServiceIdSet).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      },
    }).lean();
  }

  // 5. Degree calculation
  const inDegreeMap = new Map();
  const outDegreeMap = new Map();

  for (const dep of dependencies) {
    const src = String(dep.dependentMonitor);
    const tgt = String(dep.dependencyMonitor || dep.dependencyExternalService);
    outDegreeMap.set(src, (outDegreeMap.get(src) || 0) + 1);
    inDegreeMap.set(tgt, (inDegreeMap.get(tgt) || 0) + 1);
  }

  // 6. Build nodes
  const nodes = [];
  const summary = {
    totalNodes: 0,
    totalEdges: dependencies.length,
    healthyCount: 0,
    unhealthyCount: 0,
    degradedCount: 0,
    staleCount: 0,
    disabledCount: 0,
    unknownCount: 0,
  };

  for (const monitor of monitors) {
    const id = String(monitor._id);
    const latestCheck = latestChecksMap.get(id);
    const activeIncident = activeIncidentsMap.get(id);

    const health = deriveMonitorHealthState(
      monitor,
      latestCheck,
      activeIncident,
    );

    // Update summary counts
    switch (health.healthState) {
      case "healthy":
        summary.healthyCount++;
        break;
      case "unhealthy":
        summary.unhealthyCount++;
        break;
      case "degraded":
        summary.degradedCount++;
        break;
      case "stale":
        summary.staleCount++;
        break;
      case "disabled":
        summary.disabledCount++;
        break;
      default:
        summary.unknownCount++;
        break;
    }

    nodes.push({
      id,
      name: monitor.name,
      url: monitor.url,
      kind: monitor.kind || "website",
      nodeType: "monitor",
      active: monitor.active,
      healthState: health.healthState,
      isStale: health.isStale,
      lastCheckedAt: health.lastCheckedAt,
      responseTime: health.responseTime,
      httpStatus: health.httpStatus,
      failureReason: health.failureReason,
      activeIncident: activeIncident
        ? {
            id: String(activeIncident._id),
            status: activeIncident.status,
            severity: activeIncident.severity,
            startedAt: activeIncident.startedAt,
            rootCause: activeIncident.rootCause,
          }
        : null,
      inDegree: inDegreeMap.get(id) || 0,
      outDegree: outDegreeMap.get(id) || 0,
    });
  }

  for (const ext of externalServices) {
    const id = String(ext._id);
    nodes.push({
      id,
      name: ext.name,
      nodeType: "external_service",
      category: ext.type,
      description: ext.description,
      host: ext.host,
      healthState: ext.status || "unknown",
      isStale: false,
      lastCheckedAt: null,
      responseTime: null,
      httpStatus: null,
      failureReason: null,
      activeIncident: null,
      inDegree: inDegreeMap.get(id) || 0,
      outDegree: 0,
    });
  }

  summary.totalNodes = nodes.length;

  // 7. Build edges
  const edges = dependencies.map((dep) => ({
    id: String(dep._id),
    source: String(dep.dependentMonitor),
    target: String(dep.dependencyMonitor || dep.dependencyExternalService),
    targetType: dep.toType,
    dependencyType: dep.dependencyType,
    direction: "depends_on", // Explicit directional semantics: source depends on target
    description: dep.description || "",
    isActive: dep.isActive,
    createdAt: dep.createdAt,
    updatedAt: dep.updatedAt,
  }));

  return {
    nodes,
    edges,
    summary,
  };
};
