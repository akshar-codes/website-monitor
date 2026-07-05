import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import CircularProgress from "@mui/material/CircularProgress";
import { AuthProvider } from "./providers/AuthProvider";
import { UIProvider } from "./providers/UIProvider";
import { FilterProvider } from "./providers/FilterProvider";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/shared/ProtectedRoute";

// Lazy-loaded page components
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const MonitorsPage = lazy(() => import("./pages/MonitorsPage"));
const MonitorDetailPage = lazy(() => import("./pages/MonitorDetailPage"));
const IncidentsPage = lazy(() => import("./pages/IncidentsPage"));
const IncidentDetailPage = lazy(() => import("./pages/IncidentDetailPage"));

// QueryClient with sensible defaults for a monitoring dashboard
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
    },
  },
});

function LoadingFallback() {
  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: "60vh" }}
    >
      <CircularProgress
        size={40}
        thickness={4}
        sx={{ color: "var(--primary)" }}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UIProvider>
          <FilterProvider>
            <BrowserRouter>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route element={<Layout />}>
                    <Route element={<ProtectedRoute />}>
                      <Route index element={<DashboardPage />} />
                      <Route path="monitors" element={<MonitorsPage />} />
                      <Route
                        path="monitors/:id"
                        element={<MonitorDetailPage />}
                      />
                      <Route path="incidents" element={<IncidentsPage />} />
                      <Route
                        path="incidents/:id"
                        element={<IncidentDetailPage />}
                      />
                    </Route>
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: "var(--surface-raised)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                },
              }}
            />
          </FilterProvider>
        </UIProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
