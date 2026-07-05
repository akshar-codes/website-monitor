import { memo, useState, useCallback } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FindInPageIcon from "@mui/icons-material/FindInPage";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import StatusBadge from "../shared/StatusBadge";

/* ──────────────────────── constants ──────────────────────── */

const NEXT_ACTIONS = {
  ongoing: {
    label: "Start Investigating",
    nextStatus: "investigating",
    icon: SearchIcon,
    color: "var(--status-degraded)",
    variant: "outlined",
  },
  investigating: {
    label: "Mark as Identified",
    nextStatus: "identified",
    icon: FindInPageIcon,
    color: "var(--severity-major)",
    variant: "outlined",
  },
  identified: {
    label: "Resolve Incident",
    nextStatus: "resolved",
    icon: CheckCircleIcon,
    color: "var(--status-up)",
    variant: "contained",
  },
};

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    fontFamily: "var(--font-sans)",
    fontSize: "0.875rem",
    "& fieldset": { borderColor: "var(--border)" },
    "&:hover fieldset": { borderColor: "var(--border-hover)" },
    "&.Mui-focused fieldset": { borderColor: "var(--primary)" },
  },
  "& .MuiInputLabel-root": {
    fontFamily: "var(--font-sans)",
    color: "var(--text-tertiary)",
  },
};

/* ──────────────────────── component ──────────────────────── */

function IncidentStatusActions({ incident, onStatusUpdate, loading }) {
  const [resolveOpen, setResolveOpen] = useState(false);
  const [rootCause, setRootCause] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const status = incident?.status;
  const action = NEXT_ACTIONS[status];
  const incidentId = incident?._id || incident?.id;

  const handleQuickTransition = useCallback(() => {
    if (!action || action.nextStatus === "resolved") return;
    onStatusUpdate(incidentId, { status: action.nextStatus });
  }, [action, incidentId, onStatusUpdate]);

  const handleResolve = useCallback(() => {
    onStatusUpdate(incidentId, {
      status: "resolved",
      ...(rootCause.trim() && { rootCause: rootCause.trim() }),
      ...(resolutionNotes.trim() && {
        resolutionNotes: resolutionNotes.trim(),
      }),
    });
    setResolveOpen(false);
    setRootCause("");
    setResolutionNotes("");
  }, [incidentId, rootCause, resolutionNotes, onStatusUpdate]);

  const handleCloseDialog = useCallback(() => {
    setResolveOpen(false);
    setRootCause("");
    setResolutionNotes("");
  }, []);

  if (!incident) return null;

  return (
    <div
      id="incident-status-actions"
      className="rounded-xl p-6"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
      }}
    >
      <h3
        className="text-sm font-semibold mb-4"
        style={{ color: "var(--text-secondary)" }}
      >
        Actions
      </h3>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Current status:
        </span>
        <StatusBadge status={status} />
      </div>

      {status === "resolved" ? (
        <div
          className="flex items-center gap-2 p-3 rounded-lg text-sm"
          style={{
            background: "var(--status-up-bg)",
            color: "var(--status-up)",
            border: "1px solid var(--status-up)",
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 18 }} />
          This incident has been resolved
        </div>
      ) : action ? (
        <Button
          onClick={
            action.nextStatus === "resolved"
              ? () => setResolveOpen(true)
              : handleQuickTransition
          }
          variant={action.variant}
          startIcon={<action.icon />}
          disabled={loading}
          sx={{
            fontFamily: "var(--font-sans)",
            textTransform: "none",
            fontWeight: 600,
            color: action.variant === "contained" ? "#fff" : action.color,
            borderColor: action.color,
            bgcolor:
              action.variant === "contained" ? action.color : "transparent",
            "&:hover": {
              borderColor: action.color,
              bgcolor:
                action.variant === "contained"
                  ? action.color
                  : `${action.color}15`,
              opacity: 0.9,
            },
          }}
        >
          {loading ? "Updating…" : action.label}
        </Button>
      ) : null}

      {/* ── Resolve Dialog ── */}
      <Dialog
        open={resolveOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "var(--surface-raised)",
            color: "var(--text-primary)",
            borderRadius: "var(--radius-xl)",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: "1.125rem",
            color: "var(--text-primary)",
          }}
        >
          Resolve Incident
        </DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
            pt: "8px !important",
          }}
        >
          <TextField
            label="Root Cause"
            placeholder="What caused this incident?"
            multiline
            rows={3}
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            inputProps={{ maxLength: 2000 }}
            fullWidth
            sx={textFieldSx}
          />
          <TextField
            label="Resolution Notes"
            placeholder="What was done to fix it?"
            multiline
            rows={4}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            inputProps={{ maxLength: 5000 }}
            fullWidth
            sx={textFieldSx}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={handleCloseDialog}
            sx={{
              fontFamily: "var(--font-sans)",
              textTransform: "none",
              color: "var(--text-secondary)",
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            variant="contained"
            disabled={loading}
            startIcon={<CheckCircleIcon />}
            sx={{
              fontFamily: "var(--font-sans)",
              textTransform: "none",
              fontWeight: 600,
              bgcolor: "var(--status-up)",
              "&:hover": { bgcolor: "var(--status-up)", opacity: 0.9 },
            }}
          >
            {loading ? "Resolving…" : "Resolve"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default memo(IncidentStatusActions);
