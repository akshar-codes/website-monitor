import { memo } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import OfflineBanner from "../shared/OfflineBanner";

function Layout() {
  return (
    <div className="min-h-screen" style={{ background: "var(--surface)" }}>
      {/* Offline banner — fixed at very top */}
      <OfflineBanner />

      {/* Sidebar */}
      <Sidebar />

      {/* Top bar — offset by sidebar width on desktop, full width on mobile */}
      <TopBar />

      {/* Main content area */}
      <main
        className="animate-fade-in w-full p-4 md:p-6 lg:p-8"
        style={{
          paddingTop: `calc(var(--topbar-height) + 1rem)`,
          minHeight: "100vh",
        }}
      >
        {/*Desktop: push content right by sidebar width.*/}
        <div className="md:ml-[260px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default memo(Layout);
