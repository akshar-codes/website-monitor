import { memo } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Footer from "./Footer";
import PageContainer from "./PageContainer";
import CommandPalette from "./CommandPalette";
import OfflineBanner from "../shared/OfflineBanner";
import { useUI } from "../../providers/UIProvider";

function Layout() {
  const { sidebarCollapsed } = useUI();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--surface)" }}
    >
      {/* Offline banner — fixed at very top */}
      <OfflineBanner />

      {/* Sidebar — desktop fixed rail / mobile drawer */}
      <Sidebar />

      {/* Top bar */}
      <TopBar />

      {/* Command palette — mounted globally so Ctrl+K works from any page */}
      <CommandPalette />

      {/* Content column — offset by the sidebar's current width on desktop*/}
      <div
        className={`app-content-shell flex-1 flex flex-col w-full ${
          sidebarCollapsed
            ? "app-content-shell--collapsed"
            : "app-content-shell--expanded"
        }`}
        style={{
          paddingTop: "var(--topbar-height)",
          transition: "margin-left var(--transition-slow)",
        }}
      >
        <main className="animate-fade-in w-full flex-1 p-4 md:p-6 lg:p-8">
          <PageContainer>
            <Outlet />
          </PageContainer>
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default memo(Layout);
