import { memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Tooltip,
} from "@mui/material";
import StatusBadge from "../shared/StatusBadge";
import SeverityBadge from "../shared/SeverityBadge";
import RelativeTime from "../shared/RelativeTime";
import LoadingSkeleton from "../shared/LoadingSkeleton";
import EmptyState from "../shared/EmptyState";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { formatDuration } from "../../utils/formatters";
import { FAILURE_REASONS } from "../../utils/constants";

function IncidentTable({ incidents, loading }) {
  const navigate = useNavigate();

  if (loading) return <LoadingSkeleton variant="table" count={5} />;

  if (!incidents || incidents.length === 0) {
    return (
      <EmptyState
        icon={<WarningAmberIcon sx={{ fontSize: 48 }} />}
        title="No incidents"
        message="No incidents match the current filters"
      />
    );
  }

  return (
    <TableContainer
      className="rounded-xl"
      sx={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Monitor</TableCell>
            <TableCell>Severity</TableCell>
            <TableCell>Status</TableCell>
            <TableCell className="hidden md:table-cell">Root Cause</TableCell>
            <TableCell>Started</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell className="hidden md:table-cell">Trigger</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {incidents.map((incident) => (
            <TableRow
              key={incident._id || incident.id}
              id={`incident-row-${incident._id || incident.id}`}
              hover
              onClick={() =>
                navigate(`/incidents/${incident._id || incident.id}`)
              }
              sx={{ cursor: "pointer", "&:last-child td": { borderBottom: 0 } }}
            >
              <TableCell>
                <span
                  className="font-medium text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  {incident.monitor?.name || "—"}
                </span>
              </TableCell>
              <TableCell>
                <SeverityBadge severity={incident.severity} size="sm" />
              </TableCell>
              <TableCell>
                <StatusBadge status={incident.status} size="sm" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {incident.rootCause ? (
                  <Tooltip title={incident.rootCause} arrow>
                    <span
                      className="text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {incident.rootCause.length > 50
                        ? incident.rootCause.slice(0, 50) + "..."
                        : incident.rootCause}
                    </span>
                  </Tooltip>
                ) : (
                  <span style={{ color: "var(--text-tertiary)" }}>—</span>
                )}
              </TableCell>
              <TableCell>
                <RelativeTime date={incident.startedAt} />
              </TableCell>
              <TableCell>
                <span
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {formatDuration(incident.startedAt, incident.endedAt)}
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span
                  className="text-xs"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {incident.triggerCheck?.failureReason
                    ? FAILURE_REASONS[incident.triggerCheck.failureReason] ||
                      incident.triggerCheck.failureReason
                    : "—"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default memo(IncidentTable);
