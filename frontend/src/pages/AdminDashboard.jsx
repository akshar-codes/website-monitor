import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useAdminDashboard } from "../hooks/useAdmin";

("rounded-lg border border-[#303034] bg-bg-surface px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500");

export default function AdminDashboard() {
  const [days, setDays] = useState(30);
  // Keep the query key stable across renders. Recomputing `new Date()` here
  // changed the ISO strings on every render, causing useQuery to refetch
  // after every response and quickly exhaust the API rate limit.
  const params = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }, [days]);
  const { data, loading, error, refetch } = useAdminDashboard(params);
  const usersByPlan = Object.entries(data?.users?.byPlan || {}).map(
    ([name, stats]) => ({
      name,
      users: stats.users || 0,
      monitors: stats.monitors || 0,
    }),
  );
  const statuses = Object.entries(data?.monitors?.statuses || {});
  const hasRows =
    data?.recentRegistrations?.length ||
    data?.incidents?.active?.length ||
    data?.recentAdminActivity?.length;

  return null;
}
