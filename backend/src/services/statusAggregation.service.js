const PRECEDENCE = [
  "major_outage",
  "partial_outage",
  "degraded",
  "maintenance",
  "unknown",
  "operational",
];

export function mapMonitorStatus({
  active,
  stale,
  status,
  consecutiveFailures = 0,
  failureThreshold = 1,
}) {
  if (!active || stale || !status || status === "unknown") return "unknown";
  if (status === "up") return "operational";
  if (status === "degraded") return "degraded";
  if (status === "down")
    return consecutiveFailures >= failureThreshold
      ? "major_outage"
      : "degraded";
  return "unknown";
}

export function calculateOverallStatus(
  serviceStatuses = [],
  activeIncidents = [],
) {
  let status = serviceStatuses.length
    ? serviceStatuses.reduce(
        (worst, current) =>
          PRECEDENCE.indexOf(current) < PRECEDENCE.indexOf(worst)
            ? current
            : worst,
        "operational",
      )
    : "unknown";
  const downCount = serviceStatuses.filter(
    (item) => item === "major_outage",
  ).length;
  if (downCount > 0 && downCount < serviceStatuses.length)
    status = "partial_outage";
  const incidentStatus = activeIncidents.reduce((worst, incident) => {
    const mapped =
      { critical: "major_outage", major: "partial_outage", minor: "degraded" }[
        incident.severity
      ] || "degraded";
    return PRECEDENCE.indexOf(mapped) < PRECEDENCE.indexOf(worst)
      ? mapped
      : worst;
  }, "operational");
  return PRECEDENCE.indexOf(incidentStatus) < PRECEDENCE.indexOf(status)
    ? incidentStatus
    : status;
}
