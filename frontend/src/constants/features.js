/**
 * Client-side mirror of backend/src/config/features.js. Feature
 * availability is derived from the current plan's `limits` (fetched from
 * GET /api/plans/current — see services/api/plans.js and
 * context/PermissionsContext.jsx) rather than duplicated as a second
 * true/false table, so the two can't drift independently of pricing
 * changes.
 */
export const FEATURES = Object.freeze({
  TEAM_ACCESS: "teamAccess",
  EXTENDED_RETENTION: "extendedRetention",
  UNLIMITED_MONITORS: "unlimitedMonitors",
  FAST_POLLING: "fastPolling",
  RESPONSE_INSPECTION: "responseInspection",
  API_MONITORING: "apiMonitoring",
  SLO_MANAGEMENT: "sloManagement",
  JOB_MONITORING: "jobMonitoring",
});

/**
 * @param {{ limits: object } | null | undefined} planDefinition
 * @param {string} featureKey
 */
export function planHasFeature(planDefinition, featureKey) {
  if (!planDefinition) return false;
  const { limits } = planDefinition;

  switch (featureKey) {
    case FEATURES.TEAM_ACCESS:
      return limits.teamMembers === null || limits.teamMembers > 1;
    case FEATURES.EXTENDED_RETENTION:
      return limits.dataRetentionDays > 7;
    case FEATURES.UNLIMITED_MONITORS:
      return limits.maxMonitors === null;
    case FEATURES.FAST_POLLING:
      return limits.minCheckIntervalSeconds < 300;
    case FEATURES.RESPONSE_INSPECTION:
      return planDefinition.rank >= 1;
    case FEATURES.API_MONITORING:
      return (limits.maxApiMonitors ?? 0) > 0;
    case FEATURES.SLO_MANAGEMENT:
      return limits.maxSlos === null || (limits.maxSlos ?? 0) > 0;
    case FEATURES.JOB_MONITORING:
      return limits.maxJobMonitors === null || (limits.maxJobMonitors ?? 0) > 0;
    default:
      return false;
  }
}
