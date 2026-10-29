import { useMemo } from "react";
import { useDashboardSummary } from "../hooks/useMonitors";
import { formatResponseTime, formatUptime } from "../utils/format";
import { usePreferences } from "../hooks/usePreferences";

/**
 * The dashboard page is powered by a single aggregated request
 * (GET /api/dashboard/summary — see backend/src/services/dashboard.service.js
 * #getDashboardSummary) rather than assembling itself from several
 * independent, overlapping queries.
 */
export default function Dashboard() {
  const { preferences } = usePreferences();
  const dashboardPrefs = preferences?.dashboard;
  const { data, loading, error, refetch } = useDashboardSummary(
    (dashboardPrefs?.autoRefreshInterval || 30) * 1000,
  );

  const overview = data?.data?.overview;
  const monitorStatuses = data?.data?.monitorStatusList || [];
  const chartData = data?.data?.chartData || {};

  const checks = overview?.recentChecks || [];
  const incidentsList = overview?.activeIncidents?.latest || [];
  const incidentCount = overview?.activeIncidents?.count || 0;

  const isInitialLoad = loading && !data;
  const defaultWidgetOrder = [
    "quickActions",
    "overviewChart",
    "recentActivity",
    "activeIncidents",
    "monitorStatusGrid",
  ];
  const widgetOrder = dashboardPrefs?.widgetOrder || defaultWidgetOrder;
  const visibleWidgets = widgetOrder.filter(
    (key) =>
      dashboardPrefs?.widgets?.[
        `show${key[0].toUpperCase()}${key.slice(1)}`
      ] !== false,
  );

  const kpiData = useMemo(
    () => ({
      totalMonitors: overview?.monitors?.total ?? 0,
      activeMonitors: overview?.monitors?.active ?? 0,
      online: overview?.currentStatus?.up ?? 0,
      offline:
        (overview?.currentStatus?.down ?? 0) +
        (overview?.currentStatus?.degraded ?? 0),
      avgResponse: formatResponseTime(overview?.responseTime?.average),
    }),
    [overview],
  );

  return null;
}
