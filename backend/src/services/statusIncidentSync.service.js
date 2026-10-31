import Incident from "../models/Incident.js";
import Monitor from "../models/Monitor.js";
import StatusPage from "../models/StatusPage.js";
import StatusIncident from "../models/StatusIncident.js";
import { enqueueBestEffort } from "./statusNotification.service.js";
import logger from "../utils/logger.js";

const publicSeverity = (severity) =>
  ({ critical: "critical", major: "major", minor: "minor" })[severity] ||
  "major";
const publicStatus = (status) =>
  ({
    ongoing: "investigating",
    investigating: "investigating",
    identified: "identified",
    resolved: "resolved",
  })[status] || "investigating";

/** Mirror monitor-generated incidents into each visible status-page service.
 * Public text is deliberately generic: internal diagnostics stay private. */
export async function syncMonitorIncident(incident, action = "updated") {
  try {
    const monitor = await Monitor.findById(incident.monitor)
      .select("owner name")
      .lean();
    if (!monitor) return;
    const pages = await StatusPage.find({
      owner: monitor.owner,
      "services.monitor": monitor._id,
    }).lean();
    for (const page of pages) {
      const service = (page.services || []).find(
        (item) =>
          item.isVisible && String(item.monitor) === String(monitor._id),
      );
      if (!service) continue;
      let publicIncident = await StatusIncident.findOne({
        statusPage: page._id,
        sourceIncidentId: incident._id,
      });
      const status = publicStatus(incident.status);
      const created = !publicIncident;
      if (!publicIncident) {
        publicIncident = await StatusIncident.create({
          statusPage: page._id,
          sourceIncidentId: incident._id,
          title: `${service.displayName} incident`,
          description:
            "We detected an issue affecting this service and are investigating.",
          severity: publicSeverity(incident.severity),
          status: "investigating",
          affectedServices: [service._id],
          startedAt: incident.startedAt || new Date(),
          isPublished: Boolean(page.isPublished),
          createdBy: monitor.owner,
          updates: [
            {
              eventId: `${incident._id}:opened`,
              message: "We are investigating a service issue.",
              status: "investigating",
              authorLabel: "Monitoring system",
            },
          ],
        });
      }
      const changed =
        publicIncident.status !== status ||
        publicIncident.severity !== publicSeverity(incident.severity);
      if (!created && changed) {
        publicIncident.status = status;
        publicIncident.severity = publicSeverity(incident.severity);
        if (status === "resolved")
          publicIncident.resolvedAt = incident.endedAt || new Date();
        const eventId = `${incident._id}:${status}:${new Date(incident.updatedAt || Date.now()).getTime()}`;
        if (
          !publicIncident.updates.some((update) => update.eventId === eventId)
        ) {
          publicIncident.updates.push({
            eventId,
            message:
              status === "resolved"
                ? "The service issue has been resolved."
                : "We have updated the status of this service issue.",
            status,
            authorLabel: "Monitoring system",
          });
        }
        await publicIncident.save();
      }
      if (
        (created || changed) &&
        page.isPublished &&
        publicIncident.isPublished
      ) {
        await enqueueBestEffort(page._id, {
          eventType:
            status === "resolved"
              ? "incident_resolved"
              : created
                ? "incident_created"
                : "incident_update",
          eventId: `${publicIncident._id}:${status}:${incident.updatedAt || incident.startedAt}`,
          subject: `${publicIncident.title}: ${status}`,
          message:
            status === "resolved"
              ? "The service issue has been resolved."
              : created
                ? "We are investigating a service issue."
                : "The status of a service issue has changed.",
        });
      }
    }
  } catch (error) {
    // Status page delivery must never block the monitoring state machine.
    logger.error(
      `Automatic status incident synchronization failed: ${error.message}`,
      { incidentId: String(incident._id || "") },
    );
  }
}

export async function syncIncidentById(incidentId, action) {
  const incident = await Incident.findById(incidentId).lean();
  if (incident) await syncMonitorIncident(incident, action);
}
