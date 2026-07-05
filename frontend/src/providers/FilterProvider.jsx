import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

const FilterContext = createContext(null);

const DEFAULT_FILTERS = {
  monitors: {
    active: undefined,
    sortBy: "createdAt",
    order: "desc",
    page: 1,
    limit: 20,
  },
  incidents: {
    severity: undefined,
    status: "active",
    page: 1,
    limit: 20,
  },
};

function getInitialFilters() {
  try {
    const stored = localStorage.getItem("dashboard_filters");
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        monitors: { ...DEFAULT_FILTERS.monitors, ...parsed.monitors },
        incidents: { ...DEFAULT_FILTERS.incidents, ...parsed.incidents },
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_FILTERS;
}

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState(getInitialFilters);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem("dashboard_filters", JSON.stringify(filters));
  }, [filters]);

  const setMonitorFilters = useCallback((updates) => {
    setFilters((prev) => ({
      ...prev,
      monitors:
        typeof updates === "function"
          ? updates(prev.monitors)
          : { ...prev.monitors, ...updates },
    }));
  }, []);

  const setIncidentFilters = useCallback((updates) => {
    setFilters((prev) => ({
      ...prev,
      incidents:
        typeof updates === "function"
          ? updates(prev.incidents)
          : { ...prev.incidents, ...updates },
    }));
  }, []);

  const resetMonitorFilters = useCallback(() => {
    setFilters((prev) => ({ ...prev, monitors: DEFAULT_FILTERS.monitors }));
  }, []);

  const resetIncidentFilters = useCallback(() => {
    setFilters((prev) => ({ ...prev, incidents: DEFAULT_FILTERS.incidents }));
  }, []);

  const value = {
    monitorFilters: filters.monitors,
    incidentFilters: filters.incidents,
    setMonitorFilters,
    setIncidentFilters,
    resetMonitorFilters,
    resetIncidentFilters,
  };

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return ctx;
}

export default FilterContext;
