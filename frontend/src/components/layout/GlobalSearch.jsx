import { memo, useEffect, useState } from "react";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { useUI } from "../../providers/UIProvider";

function GlobalSearch() {
  const { openCommandPalette } = useUI();
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(
      /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent),
    );
  }, []);

  return (
    <button
      id="global-search-trigger"
      type="button"
      onClick={openCommandPalette}
      className="flex items-center gap-2 rounded-lg text-sm w-9 sm:w-auto justify-center sm:justify-start px-0 sm:px-3"
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text-tertiary)",
        height: 36,
        transition: "border-color var(--transition-fast)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
      }}
      aria-label="Open global search (Ctrl+K)"
    >
      <SearchRoundedIcon sx={{ fontSize: 18, flexShrink: 0 }} />
      <span className="hidden lg:inline whitespace-nowrap">
        Search monitors, incidents…
      </span>
      <span
        className="hidden lg:inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ml-2"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          color: "var(--text-tertiary)",
        }}
      >
        {isMac ? "⌘" : "Ctrl"} K
      </span>
    </button>
  );
}

export default memo(GlobalSearch);
