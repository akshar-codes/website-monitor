import { useMemo, useState } from "react";
import ChartCard from "../../components/cards/ChartCard";
import ResponseTimeChart from "../../components/charts/ResponseTimeChart";
import UptimeChart from "../../components/charts/UptimeChart";
import DateRangePicker from "../../components/ui/DateRangePicker";
import ErrorState from "../../components/ui/ErrorState";
import PerformanceSummaryCards from "./PerformanceSummaryCards";
import AvailabilityBreakdown from "./AvailabilityBreakdown";
import { useMonitorAnalytics } from "../../hooks/useMonitors";

/**
 * Monitor analytics / performance insights section — the frontend half of
 * GET /api/dashboard/monitors/:id/analytics. Renders a date-range picker
 */
export default function MonitorAnalytics({ monitorId, retentionDays }) {
  const [range, setRange] = useState({ mode: "preset", window: "7d" });

  const queryParams = useMemo(() => {
    if (range.mode === "custom") {
      return { startDate: range.startDate, endDate: range.endDate };
    }
    return { window: range.window };
  }, [range]);

  const { data, loading, error, refetch } = useMonitorAnalytics(
    monitorId,
    queryParams,
  );
  const analytics = data?.data;

  // Chart bucket granularity decides which axis-label format the shared
  // chart components should use — hourly buckets read as "24h" (HH:mm
  // ticks), daily buckets read as anything longer (MMM d ticks).
  const chartWindow =
    analytics?.range?.granularity === "hourly" ? "24h" : "30d";

  const isInitialLoad = loading && !analytics;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            Performance Insights
          </p>
          <p className="text-xs text-text-muted">
            Uptime, response time, and availability over a custom range
          </p>
        </div>
        <DateRangePicker
          value={range}
          onChange={setRange}
          maxRangeDays={retentionDays}
        />
      </div>

      {error && !analytics ? (
        <ErrorState
          title="Couldn't load analytics"
          description="Something went wrong while fetching performance data for this range."
          onRetry={refetch}
        />
      ) : (
        <>
          <PerformanceSummaryCards
            overview={analytics?.overview}
            range={analytics?.range}
            loading={isInitialLoad}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <ChartCard
                title="Response Time"
                subtitle="Average response time across the selected range"
                loading={isInitialLoad}
                height={240}
              >
                <ResponseTimeChart
                  data={analytics?.chart || []}
                  window={chartWindow}
                />
              </ChartCard>

              <ChartCard
                title="Uptime"
                subtitle="Uptime percentage across the selected range"
                loading={isInitialLoad}
                height={200}
              >
                <UptimeChart
                  data={analytics?.chart || []}
                  window={chartWindow}
                />
              </ChartCard>
            </div>

            <AvailabilityBreakdown
              availability={analytics?.availability}
              loading={isInitialLoad}
            />
          </div>
        </>
      )}
    </div>
  );
}
