import { useState, useEffect, useCallback, useRef } from "react";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const wasOfflineRef = useRef(!navigator.onLine);

  const handleOnline = useCallback(() => {
    setIsOffline(false);
    if (wasOfflineRef.current) {
      setShowReconnected(true);
      setIsExiting(false);
      // Start exit animation after 2.5s, then hide after animation completes
      const exitTimer = setTimeout(() => setIsExiting(true), 2500);
      const hideTimer = setTimeout(() => {
        setShowReconnected(false);
        setIsExiting(false);
      }, 3000);
      return () => {
        clearTimeout(exitTimer);
        clearTimeout(hideTimer);
      };
    }
    wasOfflineRef.current = false;
  }, []);

  const handleOffline = useCallback(() => {
    setIsOffline(true);
    setShowReconnected(false);
    setIsExiting(false);
    wasOfflineRef.current = true;
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Offline banner
  if (isOffline) {
    return (
      <div
        id="offline-banner"
        className="animate-slide-down fixed top-0 left-0 right-0 z-9999 flex items-center justify-center gap-2 px-4 py-2.5"
        role="alert"
        style={{
          backgroundColor: "var(--status-degraded)",
          color: "#fff",
          fontWeight: 600,
          fontSize: "0.85rem",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <WifiOffRoundedIcon sx={{ fontSize: 18 }} />
        <span>Connection lost. Showing cached data.</span>
      </div>
    );
  }

  // Reconnected banner
  if (showReconnected) {
    return (
      <div
        id="reconnected-banner"
        className={isExiting ? "" : "animate-slide-down"}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "8px 16px",
          backgroundColor: "var(--status-up)",
          color: "#fff",
          fontWeight: 600,
          fontSize: "0.85rem",
          boxShadow: "var(--shadow-lg)",
          animation: isExiting
            ? "slideUp var(--transition-slow) ease-in forwards"
            : undefined,
        }}
        role="status"
      >
        <WifiRoundedIcon sx={{ fontSize: 18 }} />
        <span>Reconnected!</span>
      </div>
    );
  }

  return null;
}

export default OfflineBanner;
