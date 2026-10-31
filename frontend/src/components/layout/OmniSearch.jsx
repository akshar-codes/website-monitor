import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, ArrowUpRight } from "lucide-react";
import { useTranslation } from "../../i18n";

const destinations = [
  ["Dashboard", "/", "Overview and monitor health"],
  ["Monitors", "/monitors", "Manage website checks"],
  ["Incidents", "/incidents", "Investigate downtime"],
  ["Insights", "/insights", "Reliability analytics"],
  ["SSL monitoring", "/ssl", "Certificates and domains"],
  ["Activity", "/activity", "Account event history"],
  ["Notifications", "/notifications", "Your alerts"],
  ["Account settings", "/settings/account", "Profile and account details"],
  ["Security settings", "/settings/security", "Password and sessions"],
  ["Billing", "/billing", "Plan and subscription"],
  ["Admin overview", "/admin", "Platform administration"],
  ["Users", "/admin/users", "Customer accounts"],
  ["Plan requests", "/admin/plan-requests", "Upgrade approval queue"],
  ["Audit logs", "/admin/audit-logs", "Privileged activity"],
];

export default function OmniSearch() {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const filtered = useMemo(
    () =>
      destinations
        .filter(([name, path, hint]) =>
          `${name} ${path} ${hint}`.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 8),
    [query],
  );
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const go = (path) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };
  return (
    <>
      <button
        className="global-search omni-trigger"
        onClick={() => setOpen(true)}
      >
        <Search size={16} />
        <span>{t("Search monitors, pages...")}</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open && (
        <div
          className="omni-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="omni-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Search SiteWatch")}
          >
            <div className="omni-input">
              <Search size={17} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Search pages and actions...")}
              />
              <button
                onClick={() => setOpen(false)}
                aria-label={t("Close search")}
              >
                <X size={16} />
              </button>
            </div>
            <div className="omni-results">
              {filtered.map(([name, path, hint]) => (
                <button key={path} onClick={() => go(path)}>
                  <span>
                    <b>{t(name)}</b>
                    <small>{t(hint)}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
              {!filtered.length && <p>No pages match “{query}”.</p>}
            </div>
            <footer>
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> Navigate
              </span>
              <span>
                <kbd>Esc</kbd> Close
              </span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
