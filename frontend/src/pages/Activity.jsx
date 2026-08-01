import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import SectionLabel from "../components/ui/SectionLabel";
import Pagination from "../components/ui/Pagination";
import ActivityFilters from "../features/activity/ActivityFilters";
import ActivityTimeline from "../features/activity/ActivityTimeline";
import RecentActivitySummary from "../features/activity/RecentActivitySummary";
import { useActivityList, useActivitySummary } from "../hooks/useActivity";

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
    loading: summaryLoading,
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

  return (
    <PageContainer>
      <PageHeader
        title="Activity"
        subtitle="A complete history of actions taken on your account"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        }
        className="mb-6"
      />

      <div className="mb-6">
        <SectionLabel className="mb-3">Overview</SectionLabel>
        <RecentActivitySummary summary={summary} loading={summaryLoading} />
      </div>

      <div>
        <SectionLabel className="mb-3">Full history</SectionLabel>

        <ActivityFilters
          search={search}
          onSearchChange={handleSearchChange}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={handleCategoryFilterChange}
          windowFilter={windowFilter}
          onWindowFilterChange={handleWindowFilterChange}
          totalCount={pagination?.total}
        />

        <ActivityTimeline
          activities={activities}
          loading={loading}
          hasActiveFilters={hasActiveFilters}
        />

        {pagination && pagination.totalPages > 1 && (
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
            className="mt-4"
          />
        )}
      </div>
    </PageContainer>
  );
}
