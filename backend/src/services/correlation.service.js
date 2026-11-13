import mongoose from "mongoose";
import Incident from "../models/Incident.js";
import Monitor from "../models/Monitor.js";
import ServiceDependency from "../models/ServiceDependency.js";
import HealthCheck from "../models/HealthCheck.js";
import DeploymentEvent from "../models/DeploymentEvent.js";
import RegionalCheck from "../models/RegionalCheck.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { getOwnedMonitorIds } from "./monitor.service.js";
import {
  scoreCorrelationCandidate,
  SCORING_VERSION,
  HEURISTIC_DISCLAIMER,
  CLASSIFICATIONS,
} from "./correlationScoring.service.js";

const DEFAULT_LOOKBACK_MINUTES = 30;
const DEFAULT_LOOKAHEAD_MINUTES = 10;
const MAX_CANDIDATE_LIMIT = 50;
const MAX_GRAPH_DEPTH = 5;

/**
 * Builds an in-memory graph from active dependencies to resolve paths between nodes.
 */
const buildDependencyGraphHelper = (dependencies) => {
  const outgoing = new Map(); // dependent -> [ { toId, type, isHard, toName } ]
  const incoming = new Map(); // dependency -> [ { fromId, type, isHard, fromName } ]

  for (const dep of dependencies) {
    if (!dep.enabled) continue;

    const fromId = String(dep.dependentMonitor?._id || dep.dependentMonitor);
    const fromName = dep.dependentMonitor?.name || fromId;

    let toId = null;
    let toName = null;

    if (dep.toType === "monitor" && dep.dependencyMonitor) {
      toId = String(dep.dependencyMonitor._id || dep.dependencyMonitor);
      toName = dep.dependencyMonitor.name || toId;
    } else if (
      dep.toType === "external_service" &&
      dep.dependencyExternalService
    ) {
      toId = String(
        dep.dependencyExternalService._id || dep.dependencyExternalService,
      );
      toName = dep.dependencyExternalService.name || toId;
    }

    if (!toId) continue;

    if (!outgoing.has(fromId)) outgoing.set(fromId, []);
    outgoing.get(fromId).push({
      toId,
      toName,
      isHard: dep.dependencyType === "hard",
    });

    if (!incoming.has(toId)) incoming.set(toId, []);
    incoming.get(toId).push({
      fromId,
      fromName,
      isHard: dep.dependencyType === "hard",
    });
  }

  return {
    getOutgoing: (id) => outgoing.get(String(id)) || [],
    getIncoming: (id) => incoming.get(String(id)) || [],
  };
};

/**
 * Resolves the topological relationship from targetMonitorId to candidateMonitorId.
 */
export const resolveGraphRelationship = (
  graph,
  targetMonitorId,
  candidateMonitorId,
) => {
  const tId = String(targetMonitorId);
  const cId = String(candidateMonitorId);

  if (tId === cId) {
    return { type: "self", depth: 0, isDirect: false, isHard: false, path: [] };
  }

  // 1. Check direct upstream: target depends on candidate
  const directUpstream = graph
    .getOutgoing(tId)
    .find((edge) => edge.toId === cId);
  if (directUpstream) {
    return {
      type: "direct_upstream",
      depth: 1,
      isDirect: true,
      isHard: directUpstream.isHard,
      path: [tId, cId],
    };
  }

  // 2. Check direct downstream: candidate depends on target
  const directDownstream = graph
    .getIncoming(tId)
    .find((edge) => edge.fromId === cId);
  if (directDownstream) {
    return {
      type: "downstream_dependent",
      depth: 1,
      isDirect: true,
      isHard: directDownstream.isHard,
      path: [cId, tId],
    };
  }

  // 3. BFS search for indirect upstream path: target -> ... -> candidate
  const queue = [{ id: tId, depth: 0, path: [tId], isHard: true }];
  const visited = new Set([tId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.depth >= MAX_GRAPH_DEPTH) continue;

    for (const edge of graph.getOutgoing(current.id)) {
      if (edge.toId === cId) {
        return {
          type: "indirect_upstream",
          depth: current.depth + 1,
          isDirect: false,
          isHard: current.isHard && edge.isHard,
          path: [...current.path, cId],
        };
      }

      if (!visited.has(edge.toId)) {
        visited.add(edge.toId);
        queue.push({
          id: edge.toId,
          depth: current.depth + 1,
          path: [...current.path, edge.toId],
          isHard: current.isHard && edge.isHard,
        });
      }
    }
  }

  // 4. Check shared upstream: target -> X and candidate -> X
  const targetUpstreamIds = new Set(graph.getOutgoing(tId).map((e) => e.toId));
  const candidateUpstream = graph
    .getOutgoing(cId)
    .find((e) => targetUpstreamIds.has(e.toId));
  if (candidateUpstream) {
    return {
      type: "shared_upstream",
      depth: 2,
      isDirect: false,
      isHard: candidateUpstream.isHard,
      sharedDependencyId: candidateUpstream.toId,
      sharedDependencyName: candidateUpstream.toName,
      path: [tId, candidateUpstream.toId, cId],
    };
  }

  return { type: "none", depth: 0, isDirect: false, isHard: false, path: [] };
};

/**
 * Performs full failure correlation analysis for an incident.
 *
 * @param {string} incidentId - ObjectId of target incident
 * @param {Object} user - Authenticated user context
 * @param {Object} [options]
 * @param {number} [options.lookbackMinutes=30] - Prior window in minutes
 * @param {number} [options.lookaheadMinutes=10] - Forward window in minutes
 * @returns {Promise<Object>} Correlation analysis result
 */
export const correlateIncident = async (incidentId, user, options = {}) => {
  const lookbackMinutes = options.lookbackMinutes || DEFAULT_LOOKBACK_MINUTES;
  const lookaheadMinutes =
    options.lookaheadMinutes || DEFAULT_LOOKAHEAD_MINUTES;

  // 1. Fetch target incident with monitor population
  const targetIncident = await Incident.findById(incidentId)
    .populate("monitor", "name url interval timeout owner type kind")
    .populate("jobMonitor", "name owner")
    .populate("triggerCheck")
    .lean();

  if (!targetIncident) {
    throw ApiError.notFound(`Incident not found with id: ${incidentId}`);
  }

  // Tenant Isolation: verify owner
  const ownedMonitorIds = await getOwnedMonitorIds(user);
  const targetMonitorId = targetIncident.monitor?._id || targetIncident.monitor;

  const isOwner =
    (targetIncident.monitor &&
      ownedMonitorIds.some((id) =>
        id.equals(new mongoose.Types.ObjectId(targetMonitorId)),
      )) ||
    (targetIncident.jobMonitor &&
      String(targetIncident.jobMonitor.owner) === String(user._id || user.id));

  if (!isOwner) {
    throw ApiError.forbidden(
      "You do not have access to correlate this incident.",
    );
  }

  const targetStartTime = new Date(targetIncident.startedAt);
  const windowStart = new Date(
    targetStartTime.getTime() - lookbackMinutes * 60 * 1000,
  );
  const windowEnd = new Date(
    targetStartTime.getTime() + lookaheadMinutes * 60 * 1000,
  );

  // 2. Fetch concurrent candidate incidents owned by the SAME user within the time window
  const candidateIncidents = await Incident.find({
    _id: { $ne: targetIncident._id },
    monitor: { $in: ownedMonitorIds },
    startedAt: { $gte: windowStart, $lte: windowEnd },
    // Exclude resolved incidents that ended before the correlation window began
    $or: [{ endedAt: null }, { endedAt: { $gte: windowStart } }],
  })
    .sort({ startedAt: 1 })
    .limit(MAX_CANDIDATE_LIMIT)
    .populate("monitor", "name url interval timeout owner type kind")
    .populate("triggerCheck")
    .lean();

  if (candidateIncidents.length === 0) {
    return {
      targetIncident: {
        id: targetIncident._id,
        monitorId: targetMonitorId,
        monitorName: targetIncident.monitor?.name || "Unknown",
        startedAt: targetIncident.startedAt,
        endedAt: targetIncident.endedAt,
        status: targetIncident.status,
        severity: targetIncident.severity,
      },
      correlationWindow: {
        start: windowStart,
        end: windowEnd,
        lookbackMinutes,
        lookaheadMinutes,
      },
      candidatesCount: 0,
      candidates: [],
      probableRootCauses: [],
      scoringVersion: SCORING_VERSION,
      disclaimer: HEURISTIC_DISCLAIMER,
    };
  }

  // 3. Fetch all active dependencies for this owner to build the DAG
  const dependencies = await ServiceDependency.find({
    owner: user._id || user.id,
    enabled: true,
  })
    .populate("dependentMonitor", "name")
    .populate("dependencyMonitor", "name")
    .populate("dependencyExternalService", "name")
    .lean();

  const graph = buildDependencyGraphHelper(dependencies);

  // 4. Collect candidate monitor IDs for batch telemetry queries
  const candidateMonitorIds = candidateIncidents
    .map((c) => c.monitor?._id || c.monitor)
    .filter(Boolean);

  // Batch load recent pre-outage checks (for latency deterioration detection)
  const preOutageChecksByMonitor = new Map();
  const recentChecks = await HealthCheck.find({
    monitor: { $in: candidateMonitorIds },
    checkedAt: {
      $gte: new Date(windowStart.getTime() - 60 * 60 * 1000),
      $lte: windowEnd,
    },
  })
    .sort({ checkedAt: -1 })
    .select("monitor responseTime checkedAt status")
    .lean();

  for (const check of recentChecks) {
    const mId = String(check.monitor);
    if (!preOutageChecksByMonitor.has(mId)) {
      preOutageChecksByMonitor.set(mId, []);
    }
    if (preOutageChecksByMonitor.get(mId).length < 5) {
      preOutageChecksByMonitor.get(mId).push(check);
    }
  }

  // Batch load recent deployments for candidates
  const deploymentsByMonitor = new Map();
  const recentDeployments = await DeploymentEvent.find({
    owner: user._id || user.id,
    monitors: { $in: candidateMonitorIds },
    deployedAt: {
      $gte: new Date(windowStart.getTime() - 90 * 60 * 1000),
      $lte: windowEnd,
    },
  })
    .sort({ deployedAt: -1 })
    .lean();

  for (const dep of recentDeployments) {
    for (const mId of dep.monitors || []) {
      const sId = String(mId);
      if (!deploymentsByMonitor.has(sId)) {
        deploymentsByMonitor.set(sId, []);
      }
      deploymentsByMonitor.get(sId).push(dep);
    }
  }

  // Batch load regional check telemetry
  const regionalChecksByMonitor = new Map();
  const recentRegionalChecks = await RegionalCheck.find({
    monitor: { $in: [targetMonitorId, ...candidateMonitorIds] },
    completedAt: { $gte: windowStart, $lte: windowEnd },
  })
    .select("monitor regionId healthStatus responseTime completedAt")
    .lean();

  for (const rc of recentRegionalChecks) {
    const mId = String(rc.monitor);
    if (!regionalChecksByMonitor.has(mId)) {
      regionalChecksByMonitor.set(mId, []);
    }
    regionalChecksByMonitor.get(mId).push(rc);
  }

  const targetRegionalChecks =
    regionalChecksByMonitor.get(String(targetMonitorId)) || [];

  // 5. Score every candidate incident
  const scoredCandidates = [];

  for (const candidate of candidateIncidents) {
    const cMonitorId = String(candidate.monitor?._id || candidate.monitor);
    const graphRel = resolveGraphRelationship(
      graph,
      targetMonitorId,
      cMonitorId,
    );

    const scored = scoreCorrelationCandidate({
      targetIncident,
      candidateIncident: candidate,
      graphRelationship: graphRel,
      targetHealthCheck: targetIncident.triggerCheck,
      candidateHealthCheck: candidate.triggerCheck,
      candidatePreOutageChecks: preOutageChecksByMonitor.get(cMonitorId) || [],
      candidateDeployments: deploymentsByMonitor.get(cMonitorId) || [],
      targetRegionalChecks,
      candidateRegionalChecks: regionalChecksByMonitor.get(cMonitorId) || [],
    });

    scoredCandidates.push(scored);
  }

  // Sort candidates by score descending, then by temporal precedence
  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.deltaSeconds - a.deltaSeconds;
  });

  // Identify probable root cause candidates (score >= 75)
  const probableRootCauses = scoredCandidates.filter(
    (c) => c.classification === CLASSIFICATIONS.PROBABLE_ROOT_CAUSE,
  );

  const result = {
    targetIncident: {
      id: targetIncident._id,
      monitorId: targetMonitorId,
      monitorName: targetIncident.monitor?.name || "Unknown",
      startedAt: targetIncident.startedAt,
      endedAt: targetIncident.endedAt,
      status: targetIncident.status,
      severity: targetIncident.severity,
    },
    correlationWindow: {
      start: windowStart,
      end: windowEnd,
      lookbackMinutes,
      lookaheadMinutes,
    },
    candidatesCount: scoredCandidates.length,
    probableRootCauses,
    candidates: scoredCandidates,
    scoringVersion: SCORING_VERSION,
    disclaimer: HEURISTIC_DISCLAIMER,
  };

  // Safely persist summary snapshot back to incident record asynchronously
  void (async () => {
    try {
      await Incident.findByIdAndUpdate(targetIncident._id, {
        $set: {
          correlationSummary: {
            scoredAt: new Date(),
            candidatesCount: scoredCandidates.length,
            topCandidate: scoredCandidates[0] || null,
            probableRootCausesCount: probableRootCauses.length,
          },
          correlatedCandidateCount: scoredCandidates.length,
          probableRootCauseIncident: probableRootCauses[0]?.candidateId || null,
        },
      });
    } catch (err) {
      logger.warn(
        `Failed to cache correlation summary for incident ${targetIncident._id}: ${err.message}`,
      );
    }
  })();

  return result;
};

/**
 * On-demand correlation analysis for a monitor's latest or active outage.
 *
 * @param {string} monitorId
 * @param {Object} user
 * @param {Object} [options]
 */
export const correlateMonitorOutage = async (monitorId, user, options = {}) => {
  const ownedMonitorIds = await getOwnedMonitorIds(user);
  const targetId = new mongoose.Types.ObjectId(monitorId);

  const isOwner = ownedMonitorIds.some((id) => id.equals(targetId));
  if (!isOwner) {
    throw ApiError.notFound(
      `Monitor not found or unauthorized with id: ${monitorId}`,
    );
  }

  // Find latest active or recent incident on this monitor
  const incident = await Incident.findOne({ monitor: targetId })
    .sort({ startedAt: -1 })
    .lean();

  if (!incident) {
    return {
      hasIncident: false,
      message: "No recorded incidents found for this monitor.",
      candidates: [],
    };
  }

  const correlation = await correlateIncident(incident._id, user, options);
  return {
    hasIncident: true,
    ...correlation,
  };
};
