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

      {/*
        Content column — offset by the sidebar's current width on desktop.
        Kept as a single flex column (main + footer) so the footer sits
        at the bottom of the viewport even on short pages.
      */}
      <div
        className={`flex-1 flex flex-col w-full ${
          sidebarCollapsed
            ? "md:ml-[var(--sidebar-collapsed)]"
            : "md:ml-[var(--sidebar-width)]"
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
