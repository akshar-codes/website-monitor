import { useQuery } from "./useQuery";
import * as incidentsApi from "../services/api/incidents";
import * as dashboardApi from "../services/api/dashboard";
import * as monitorsApi from "../services/api/monitors";

export function useDowntimeStats(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => incidentsApi.getDowntimeStats(params), [paramsKey]);
}

export function useIncidentList(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => incidentsApi.getIncidents(params), [paramsKey]);
}

export function useAllMonitorStats(monitorIds = [], window = "7d") {
  const key = JSON.stringify({ monitorIds, window });
  return useQuery(
    async () => {
      if (!monitorIds.length) return [];
      const results = await Promise.allSettled(
        monitorIds.map((id) => dashboardApi.getMonitorStats(id, { window })),
      );
      return results
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value.data);
    },
    [key],
    { immediate: monitorIds.length > 0 },
  );
}

export function useMonitorsWithStats(window = "7d") {
  return useQuery(async () => {
    const monitorsRes = await monitorsApi.getMonitors({ limit: 100 });
    const monitors = monitorsRes.data || [];

    if (!monitors.length) return { monitors: [], statsMap: {} };

    const statsResults = await Promise.allSettled(
      monitors.map((m) => dashboardApi.getMonitorStats(m.id, { window })),
    );

    const statsMap = {};
    monitors.forEach((m, i) => {
      if (statsResults[i].status === "fulfilled") {
        statsMap[m.id] = statsResults[i].value.data;
      }
    });

    return { monitors, statsMap };
  }, [window]);
}
