import { useMemo, useState } from "react";
import { useActivityList, useActivitySummary } from "../hooks/useActivity";
import {
  Page,
  Panel,
  Button,
  Select,
  Input,
  Metric,
} from "../components/ui/Primitives";
import { RefreshCw, Activity as ActivityIcon } from "lucide-react";

export default function Activity() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [windowFilter, setWindowFilter] = useState("all");

  const listParams = useMemo(() => {
    const params = { page, limit: 20, window: windowFilter };
    if (categoryFilter !== "all") params.category = categoryFilter;
    if (search.trim()) params.search = search.trim();
    return params;
  }, [page, categoryFilter, windowFilter, search]);

  const { data: activityData, loading, refetch } = useActivityList(listParams);
  const activities = activityData?.data || [];
  const pagination = activityData?.pagination;

  const {
    data: summaryData,
    loading: _summaryLoading,
    refetch: refetchSummary,
  } = useActivitySummary(6);
  const summary = summaryData?.data;

  const hasActiveFilters =
    categoryFilter !== "all" || windowFilter !== "all" || !!search.trim();

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleCategoryFilterChange = (value) => {
    setCategoryFilter(value);
    setPage(1);
  };

  const handleWindowFilterChange = (value) => {
    setWindowFilter(value);
    setPage(1);
  };

  const handleRefresh = () => {
    refetch();
    refetchSummary();
  };

  const rows = activities.map((item) => ({
    ...item,
    when: item.createdAt || item.timestamp,
    kind: item.category || item.action || "activity",
    summary:
      item.description || item.message || item.action || "Account activity",
    actor: item.actor?.name || item.user?.name || "You",
  }));
  return (
    <Page
      title="Activity"
      description="A record of changes and events across your account."
      actions={
        <Button variant="secondary" onClick={handleRefresh}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <div className="sw-metric-grid">
        {(summary?.categories || []).slice(0, 4).map((item) => (
          <Metric
            key={item.category || item._id}
            label={item.category || item._id}
            value={item.count}
            icon={ActivityIcon}
            note="Recent events"
          />
        ))}
        {!summary?.categories?.length && (
          <Metric
            label="Events in period"
            value={summary?.total ?? "—"}
            icon={ActivityIcon}
            note="Across your account"
          />
        )}
      </div>
      <Panel title="Recent activity" subtitle="Filter the event history">
        <div className="toolbar-row">
          <Input
            aria-label="Search events"
            placeholder="Search activity"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <Select
            aria-label="Category"
            value={categoryFilter}
            onChange={(e) => handleCategoryFilterChange(e.target.value)}
          >
            <option value="all">All categories</option>
            {[
              "monitor",
              "incident",
              "account",
              "security",
              "billing",
              "notification",
            ].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Time period"
            value={windowFilter}
            onChange={(e) => handleWindowFilterChange(e.target.value)}
          >
            <option value="all">All time</option>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
          </Select>
        </div>
        {loading ? (
          <div className="sw-loading">Loading activity…</div>
        ) : (
          <div className="timeline-list">
            {rows.map((item, index) => (
              <div className="timeline-item" key={item.id || item._id || index}>
                <i />
                <div>
                  <b>{item.summary}</b>
                  <p>
                    {item.actor} · {item.kind}
                  </p>
                </div>
                <time>
                  {item.when ? new Date(item.when).toLocaleString() : "—"}
                </time>
              </div>
            ))}
            {!rows.length && (
              <div className="sw-empty">
                <b>No activity in this period</b>
                <p>
                  {hasActiveFilters
                    ? "Try changing your filters."
                    : "Account events will appear here."}
                </p>
              </div>
            )}
          </div>
        )}
        {pagination && (
          <div className="pagination-bar">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div>
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </Page>
  );
}
