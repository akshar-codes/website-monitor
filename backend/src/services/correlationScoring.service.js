import {
  compareFailureSignatures,
  normalizeFailureSignature,
} from "../utils/failureSignature.js";
import {
  extractEndpointIdentity,
  compareEndpointIdentities,
} from "../utils/endpointIdentity.js";

export const SCORING_VERSION = "1.0.0";
export const HEURISTIC_DISCLAIMER =
  "A score is a ranking heuristic based on observed evidence, not a statistically calibrated probability. Correlation does not prove causation.";

export const CLASSIFICATIONS = Object.freeze({
  PROBABLE_ROOT_CAUSE: "probable_root_cause", // Score >= 75
  LIKELY_CORRELATED: "likely_correlated", // Score 50 - 74
  WEAK_CORRELATION: "weak_correlation", // Score 30 - 49
  UNLIKELY: "unlikely", // Score < 30
});

/**
 * Evaluates candidate failure against the affected target incident and produces an explainable,
 * deterministic correlation result with supporting, conflicting, and missing signals.
 *
 * @param {Object} params
 * @param {Object} params.targetIncident - The incident on the affected service
 * @param {Object} params.candidateIncident - The candidate incident to evaluate
 * @param {Object} params.graphRelationship - Relationship from dependency graph
 * @param {Object} [params.targetHealthCheck] - HealthCheck on target monitor
 * @param {Object} [params.candidateHealthCheck] - HealthCheck on candidate monitor
 * @param {Array}  [params.candidatePreOutageChecks] - Recent checks on candidate prior to outage
 * @param {Array}  [params.candidateDeployments] - Recent deployment events for candidate
 * @param {Array}  [params.targetRegionalChecks] - Regional checks for target
 * @param {Array}  [params.candidateRegionalChecks] - Regional checks for candidate
 * @returns {Object} Structured correlation candidate evaluation
 */
export const scoreCorrelationCandidate = ({
  targetIncident,
  candidateIncident,
  graphRelationship = {
    type: "none",
    depth: 0,
    isDirect: false,
    isHard: false,
    path: [],
  },
  targetHealthCheck = null,
  candidateHealthCheck = null,
  candidatePreOutageChecks = [],
  candidateDeployments = [],
  targetRegionalChecks = [],
  candidateRegionalChecks = [],
}) => {
  const supportingSignals = [];
  const conflictingSignals = [];
  const missingSignals = [];

  let rawScore = 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Dependency Graph Topology (Weight: 40%)
  // ─────────────────────────────────────────────────────────────────────────────
  let graphPoints = 0;
  const relType = graphRelationship.type || "none";
  const depth = graphRelationship.depth || 0;

  if (relType === "direct_upstream") {
    // Target directly depends on candidate
    graphPoints = graphRelationship.isHard ? 40 : 28;
    supportingSignals.push({
      signal: "direct_upstream_dependency",
      points: graphPoints,
      weight: "40%",
      description: `Target service directly depends on candidate (${graphRelationship.isHard ? "hard / critical" : "soft"} dependency).`,
    });
  } else if (relType === "indirect_upstream") {
    // Target indirectly depends on candidate (depth 2 or 3+)
    graphPoints = depth === 2 ? 22 : 14;
    supportingSignals.push({
      signal: "transitive_upstream_dependency",
      points: graphPoints,
      weight: "25%",
      description: `Candidate is an indirect upstream dependency of target at depth ${depth}. Path: ${graphRelationship.path.join(" -> ")}.`,
    });
  } else if (relType === "shared_upstream") {
    // Both target and candidate depend on a common third-party upstream
    graphPoints = 10;
    supportingSignals.push({
      signal: "shared_upstream_dependency",
      points: graphPoints,
      weight: "10%",
      description: `Target and candidate share a common upstream dependency (${graphRelationship.sharedDependencyName || "upstream provider"}).`,
    });
  } else if (relType === "downstream_dependent") {
    // Candidate depends on target (reversed dependency!)
    // Candidate cannot be the root cause of the target failure
    conflictingSignals.push({
      signal: "reversed_dependency_direction",
      penalty: -15,
      description:
        "Candidate depends on target service. Target's failure explains candidate, not vice versa.",
    });
    rawScore -= 15;
  } else {
    // No dependency relationship found
    missingSignals.push("dependency_relationship");
  }

  rawScore += graphPoints;

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Temporal Precedence & Propagation Window (Weight: 25%)
  // ─────────────────────────────────────────────────────────────────────────────
  const targetStartTime = new Date(targetIncident.startedAt).getTime();
  const candidateStartTime = new Date(candidateIncident.startedAt).getTime();
  const deltaSeconds = Math.round(
    (targetStartTime - candidateStartTime) / 1000,
  );

  if (deltaSeconds >= 5 && deltaSeconds <= 180) {
    // Classic cascading failure propagation (5s to 3 minutes earlier)
    const timePoints = 25;
    supportingSignals.push({
      signal: "temporal_propagation_precedence",
      points: timePoints,
      weight: "25%",
      description: `Candidate failed ${deltaSeconds}s before target service, consistent with cascading propagation delay.`,
    });
    rawScore += timePoints;
  } else if (deltaSeconds > 180 && deltaSeconds <= 900) {
    // Slower cascade or delayed check interval (3 to 15 minutes earlier)
    const timePoints = 15;
    supportingSignals.push({
      signal: "temporal_precedence_delayed",
      points: timePoints,
      weight: "15%",
      description: `Candidate failed ${Math.round(deltaSeconds / 60)}m before target service.`,
    });
    rawScore += timePoints;
  } else if (deltaSeconds > 900 && deltaSeconds <= 1800) {
    // Extended window (15 to 30 minutes earlier)
    const timePoints = 8;
    supportingSignals.push({
      signal: "temporal_precedence_extended",
      points: timePoints,
      weight: "8%",
      description: `Candidate failed ${Math.round(deltaSeconds / 60)}m prior to target failure.`,
    });
    rawScore += timePoints;
  } else if (Math.abs(deltaSeconds) < 5) {
    // Near-simultaneous outage (within 5 seconds)
    const timePoints = 10;
    supportingSignals.push({
      signal: "simultaneous_failure",
      points: timePoints,
      weight: "10%",
      description: `Target and candidate failed within ${Math.abs(deltaSeconds)}s of each other (possible shared external cause).`,
    });
    rawScore += timePoints;
  } else if (deltaSeconds < -15) {
    // REVERSED failure order: Candidate failed noticeably AFTER target!
    // A subsequent failure cannot be the root cause of an earlier outage.
    const penalty = -20;
    conflictingSignals.push({
      signal: "reversed_temporal_order",
      penalty,
      description: `Candidate failed ${Math.abs(deltaSeconds)}s AFTER the target service outage had already started.`,
    });
    rawScore += penalty;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Failure Signature Compatibility (Weight: 15%)
  // ─────────────────────────────────────────────────────────────────────────────
  const targetCheck = targetHealthCheck || targetIncident.triggerCheckSnapshot;
  const candidateCheck =
    candidateHealthCheck || candidateIncident.triggerCheckSnapshot;

  if (targetCheck && candidateCheck) {
    const targetSig = normalizeFailureSignature(targetCheck);
    const candidateSig = normalizeFailureSignature(candidateCheck);
    const isUpstream =
      relType === "direct_upstream" || relType === "indirect_upstream";

    const sigComparison = compareFailureSignatures(
      targetSig,
      candidateSig,
      isUpstream,
    );
    if (sigComparison.score > 0) {
      supportingSignals.push({
        signal: sigComparison.matchType,
        points: sigComparison.score,
        weight: "15%",
        description: sigComparison.description,
      });
      rawScore += sigComparison.score;
    } else {
      missingSignals.push("failure_signature_match");
    }
  } else {
    missingSignals.push("failure_signature_telemetry");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Pre-Outage Latency Deterioration (Weight: 10%)
  // ─────────────────────────────────────────────────────────────────────────────
  if (candidatePreOutageChecks && candidatePreOutageChecks.length >= 2) {
    const sorted = [...candidatePreOutageChecks].sort(
      (a, b) => new Date(a.checkedAt) - new Date(b.checkedAt),
    );
    const baseline = sorted[0].responseTime || 100;
    const preOutage = sorted[sorted.length - 1].responseTime || 100;

    // Check if latency deteriorated by >= 50% prior to full outage
    if (preOutage >= baseline * 1.5 && preOutage - baseline >= 100) {
      const latencyPoints = 10;
      supportingSignals.push({
        signal: "pre_outage_latency_degradation",
        points: latencyPoints,
        weight: "10%",
        description: `Candidate response time degraded from ${baseline}ms to ${preOutage}ms prior to failing.`,
      });
      rawScore += latencyPoints;
    }
  } else {
    missingSignals.push("pre_outage_latency_telemetry");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Host / Infrastructure Proximity (Weight: 10%)
  // ─────────────────────────────────────────────────────────────────────────────
  const targetIdentity = extractEndpointIdentity(targetIncident.monitor);
  const candidateIdentity = extractEndpointIdentity(candidateIncident.monitor);

  if (targetIdentity.isAvailable && candidateIdentity.isAvailable) {
    const hostComparison = compareEndpointIdentities(
      targetIdentity,
      candidateIdentity,
    );
    if (hostComparison.score > 0) {
      supportingSignals.push({
        signal: hostComparison.matchType,
        points: hostComparison.score,
        weight: "10%",
        description: hostComparison.description,
      });
      rawScore += hostComparison.score;
    }
  } else {
    missingSignals.push("host_identity");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Regional Correlation (Weight: 10%)
  // ─────────────────────────────────────────────────────────────────────────────
  const targetRegions = (targetRegionalChecks || [])
    .filter((r) => r.healthStatus === "down" || r.healthStatus === "degraded")
    .map((r) => r.regionId);
  const candidateRegions = (candidateRegionalChecks || [])
    .filter((r) => r.healthStatus === "down" || r.healthStatus === "degraded")
    .map((r) => r.regionId);

  if (targetRegions.length > 0 && candidateRegions.length > 0) {
    const sharedRegions = targetRegions.filter((r) =>
      candidateRegions.includes(r),
    );
    if (sharedRegions.length > 0) {
      const regionPoints =
        sharedRegions.length === 1 && targetRegions.length === 1 ? 10 : 6;
      supportingSignals.push({
        signal: "shared_regional_outage",
        points: regionPoints,
        weight: "10%",
        description: `Both services failed in shared regional probe location(s): ${sharedRegions.join(", ")}.`,
      });
      rawScore += regionPoints;
    } else {
      // Disjoint regions: Target failed only in Region X, candidate failed only in Region Y
      const penalty = -5;
      conflictingSignals.push({
        signal: "disjoint_regions",
        penalty,
        description: `Services failed in disjoint regions without overlap (${targetRegions.join(", ")} vs ${candidateRegions.join(", ")}).`,
      });
      rawScore += penalty;
    }
  } else {
    missingSignals.push("regional_telemetry");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Deployment Event Recency (Weight: 10%)
  // ─────────────────────────────────────────────────────────────────────────────
  if (candidateDeployments && candidateDeployments.length > 0) {
    // Find deployment within 45 minutes prior to candidate outage
    const relevantDeployment = candidateDeployments.find((d) => {
      const depTime = new Date(d.deployedAt).getTime();
      const diffMinutes = (candidateStartTime - depTime) / (60 * 1000);
      return diffMinutes >= -5 && diffMinutes <= 45;
    });

    if (relevantDeployment) {
      const depPoints = 10;
      supportingSignals.push({
        signal: "recent_candidate_deployment",
        points: depPoints,
        weight: "10%",
        description: `Candidate service had release ${relevantDeployment.version} deployed shortly before failing (${new Date(relevantDeployment.deployedAt).toISOString()}).`,
      });
      rawScore += depPoints;
    }
  } else {
    missingSignals.push("deployment_events");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Final Score Normalization & Classification
  // ─────────────────────────────────────────────────────────────────────────────
  // Total potential raw score is ~120; normalized to 0 - 100
  const normalizedScore = Math.min(
    100,
    Math.max(0, Math.round((rawScore / 100) * 100)),
  );

  let classification = CLASSIFICATIONS.UNLIKELY;
  if (normalizedScore >= 75) {
    classification = CLASSIFICATIONS.PROBABLE_ROOT_CAUSE;
  } else if (normalizedScore >= 50) {
    classification = CLASSIFICATIONS.LIKELY_CORRELATED;
  } else if (normalizedScore >= 30) {
    classification = CLASSIFICATIONS.WEAK_CORRELATION;
  }

  // Generate plain-English explanation
  const candidateName =
    candidateIncident.monitor?.name ||
    candidateIncident.jobMonitor?.name ||
    String(candidateIncident.monitor || "Candidate Service");

  let explanation = `Candidate "${candidateName}" received a score of ${normalizedScore}/100. `;
  if (classification === CLASSIFICATIONS.PROBABLE_ROOT_CAUSE) {
    explanation += `Strong evidence indicates this failure preceded and directly cascaded into the affected service.`;
  } else if (classification === CLASSIFICATIONS.LIKELY_CORRELATED) {
    explanation += `Moderate evidence indicates these incidents are likely correlated through shared dependencies or temporal proximity.`;
  } else if (classification === CLASSIFICATIONS.WEAK_CORRELATION) {
    explanation += `Weak correlation detected based primarily on temporal overlap without definitive causal links.`;
  } else {
    explanation += `Insufficient or conflicting evidence to correlate this failure with the affected service.`;
  }

  return {
    candidateId: candidateIncident._id || candidateIncident.id,
    candidateMonitorId:
      candidateIncident.monitor?._id || candidateIncident.monitor,
    candidateName,
    candidateResourceType: candidateIncident.resourceType || "monitor",
    candidateStartedAt: candidateIncident.startedAt,
    candidateEndedAt: candidateIncident.endedAt,
    candidateStatus: candidateIncident.status,
    candidateSeverity: candidateIncident.severity,
    score: normalizedScore,
    rawScore,
    classification,
    label: "Heuristic ranking score (not a statistical probability)",
    scoringVersion: SCORING_VERSION,
    disclaimer: HEURISTIC_DISCLAIMER,
    explanation,
    relationship: {
      type: relType,
      depth,
      isHard: Boolean(graphRelationship.isHard),
      path: graphRelationship.path || [],
    },
    deltaSeconds,
    supportingSignals,
    conflictingSignals,
    missingSignals,
  };
};
