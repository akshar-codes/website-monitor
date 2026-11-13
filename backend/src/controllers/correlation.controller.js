import * as correlationService from "../services/correlation.service.js";

/**
 * GET /api/incidents/:id/correlation
 * Returns deterministic failure correlation candidates and evidence for an incident.
 */
export const getIncidentCorrelation = async (req, res, next) => {
  try {
    const result = await correlationService.correlateIncident(
      req.params.id,
      req.user,
      req.query,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/monitors/:id/correlation
 * Returns correlation analysis for the latest or active incident of a monitor.
 */
export const getMonitorCorrelation = async (req, res, next) => {
  try {
    const result = await correlationService.correlateMonitorOutage(
      req.params.id,
      req.user,
      req.query,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
