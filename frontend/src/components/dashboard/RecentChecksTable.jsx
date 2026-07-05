import { memo } from "react";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import StatusBadge from "../shared/StatusBadge";
import ComponentStatusDots from "../shared/ComponentStatusDots";
import RelativeTime from "../shared/RelativeTime";
import { formatResponseTime } from "../../utils/formatters";

const cellSx = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.8125rem",
  py: 1.5,
  px: 2,
  borderBottom: "1px solid var(--border)",
};

const headCellSx = {
  ...cellSx,
  color: "var(--text-secondary)",
  fontWeight: 600,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  backgroundColor: "var(--surface)",
};

function RecentChecksTable({ checks }) {
  const hasChecks = checks && checks.length > 0;

  return (
    <div
      id="recent-checks-table"
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="px-5 py-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Recent Health Checks
        </h3>
      </div>

      {!hasChecks ? (
        <div className="py-10 text-center">
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            No health checks recorded yet.
          </p>
        </div>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={headCellSx}>Monitor</TableCell>
                <TableCell sx={headCellSx}>Status</TableCell>
                <TableCell sx={headCellSx} className="hidden md:table-cell">
                  Components
                </TableCell>
                <TableCell sx={headCellSx}>Response</TableCell>
                <TableCell sx={headCellSx} className="hidden md:table-cell">
                  HTTP
                </TableCell>
                <TableCell sx={headCellSx}>Checked</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {checks.slice(0, 10).map((check, idx) => (
                <TableRow
                  key={check._id || idx}
                  sx={{
                    transition: "background-color var(--transition-fast)",
                    "&:hover": {
                      backgroundColor: "var(--surface)",
                    },
                    "&:last-child td": {
                      borderBottom: "none",
                    },
                  }}
                >
                  <TableCell
                    sx={{
                      ...cellSx,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    <span className="truncate block max-w-40 sm:max-w-55">
                      {check.monitor?.name || "Unknown"}
                    </span>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <StatusBadge status={check.status} size="sm" />
                  </TableCell>
                  <TableCell sx={cellSx} className="hidden md:table-cell">
                    <ComponentStatusDots
                      frontendStatus={check.frontendStatus}
                      backendStatus={check.backendStatus}
                      databaseStatus={check.databaseStatus}
                    />
                  </TableCell>
                  <TableCell
                    sx={{ ...cellSx, fontVariantNumeric: "tabular-nums" }}
                  >
                    <span style={{ color: "var(--text-primary)" }}>
                      {formatResponseTime(check.responseTime)}
                    </span>
                  </TableCell>
                  <TableCell sx={cellSx} className="hidden md:table-cell">
                    <span
                      className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-mono font-medium"
                      style={{
                        backgroundColor:
                          check.httpStatus >= 200 && check.httpStatus < 300
                            ? "var(--status-up-bg)"
                            : check.httpStatus >= 400
                              ? "var(--status-down-bg)"
                              : "var(--status-unknown-bg)",
                        color:
                          check.httpStatus >= 200 && check.httpStatus < 300
                            ? "var(--status-up)"
                            : check.httpStatus >= 400
                              ? "var(--status-down)"
                              : "var(--status-unknown)",
                      }}
                    >
                      {check.httpStatus ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <RelativeTime date={check.checkedAt} className="text-xs!" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}

export default memo(RecentChecksTable);
