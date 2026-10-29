import { useMemo, useState } from "react";
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

  return null;
}
