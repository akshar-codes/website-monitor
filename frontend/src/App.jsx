import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Monitors from "./pages/Monitors";
import Insights from "./pages/Insights";
import { Skeleton } from "./components/ui/Skeleton";

function PageFallback() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="mt-4 grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-72 rounded-xl" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#18181b",
            border: "1px solid #27272a",
            color: "#fafafa",
            fontSize: "13px",
            borderRadius: "12px",
          },
          classNames: {
            success: "!text-emerald-400",
            error: "!text-red-400",
          },
        }}
        richColors
      />
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={
              <Suspense fallback={<PageFallback />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="/monitors"
            element={
              <Suspense fallback={<PageFallback />}>
                <Monitors />
              </Suspense>
            }
          />
          <Route
            path="/insights"
            element={
              <Suspense fallback={<PageFallback />}>
                <Insights />
              </Suspense>
            }
          />
          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
