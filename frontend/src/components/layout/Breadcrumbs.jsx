import { memo, useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { useMonitor } from "../../hooks/queries/useMonitor";
import { useIncident } from "../../hooks/queries/useIncident";
import { SEGMENT_LABELS } from "../../utils/navigation";

function useDynamicSegmentLabel(pathname, id) {
  const isMonitorDetail = pathname.startsWith("/monitors/") && !!id;
  const isIncidentDetail = pathname.startsWith("/incidents/") && !!id;

  const monitorQuery = useMonitor(isMonitorDetail ? id : undefined);
  const incidentQuery = useIncident(isIncidentDetail ? id : undefined);

  if (isMonitorDetail) {
    return monitorQuery.data?.name || null;
  }
  if (isIncidentDetail) {
    return incidentQuery.data?.monitor?.name
      ? `Incident — ${incidentQuery.data.monitor.name}`
      : null;
  }
  return null;
}

function Breadcrumbs() {
  const { pathname } = useLocation();
  const { id } = useParams();

  const dynamicLabel = useDynamicSegmentLabel(pathname, id);

  const crumbs = useMemo(() => {
    if (pathname === "/") return [];

    const segments = pathname.split("/").filter(Boolean);
    const result = [];
    let accumulatedPath = "";

    segments.forEach((segment, index) => {
      accumulatedPath += `/${segment}`;
      const isLast = index === segments.length - 1;
      const isDynamicSegment = index === 1 && id === segment;

      result.push({
        path: accumulatedPath,
        label: isDynamicSegment
          ? dynamicLabel || "Details"
          : SEGMENT_LABELS[segment] || segment,
        isLast,
      });
    });

    return result;
  }, [pathname, id, dynamicLabel]);

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden sm:flex items-center gap-1.5 min-w-0"
    >
      <Link
        to="/"
        className="flex items-center shrink-0"
        style={{
          color:
            crumbs.length === 0
              ? "var(--text-primary)"
              : "var(--text-tertiary)",
        }}
        aria-label="Dashboard"
      >
        <HomeRoundedIcon sx={{ fontSize: 16 }} />
      </Link>

      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1.5 min-w-0">
          <ChevronRightRoundedIcon
            sx={{ fontSize: 14, color: "var(--text-tertiary)", flexShrink: 0 }}
          />
          {crumb.isLast ? (
            <span
              className="text-sm font-semibold truncate max-w-55"
              style={{ color: "var(--text-primary)" }}
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="text-sm font-medium truncate max-w-40 hover:underline"
              style={{ color: "var(--text-tertiary)" }}
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export default memo(Breadcrumbs);
