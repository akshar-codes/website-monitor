import { useQuery } from "./useQuery";
import * as activityApi from "../services/api/activity";

export function useActivityList(params = {}) {
  const paramsKey = JSON.stringify(params);
  return useQuery(() => activityApi.getActivities(params), [paramsKey]);
}

export function useActivitySummary(limit = 8) {
  return useQuery(() => activityApi.getActivitySummary({ limit }), [limit]);
}
