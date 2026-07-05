import { memo, useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed? This action cannot be undone.",
  confirmText = "Delete",
  confirmColor = "error",
  loading = false,
}) {
  const handleConfirm = useCallback(() => {
    onConfirm?.();
  }, [onConfirm]);

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "var(--surface-raised)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-xl)",
        },
      }}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: "var(--surface-overlay)" },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          fontSize: "1.1rem",
          color: "var(--text-primary)",
          pb: 0.5,
        }}
      >
        <WarningAmberRoundedIcon
          sx={{
            color:
              confirmColor === "error"
                ? "var(--status-down)"
                : "var(--status-degraded)",
            fontSize: 28,
          }}
        />
        {title}
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {message}
        </p>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          id="confirm-dialog-cancel"
          onClick={onClose}
          disabled={loading}
          variant="outlined"
          sx={{
            color: "var(--text-secondary)",
            borderColor: "var(--border)",
            "&:hover": {
              borderColor: "var(--border-hover)",
              bgcolor: "var(--surface)",
            },
          }}
        >
          Cancel
        </Button>
        <Button
          id="confirm-dialog-confirm"
          onClick={handleConfirm}
          disabled={loading}
          variant="contained"
          color={confirmColor}
          startIcon={
            loading ? <CircularProgress size={16} color="inherit" /> : null
          }
          sx={{
            minWidth: 100,
            fontWeight: 600,
          }}
        >
          {loading ? "Processing…" : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default memo(ConfirmDialog);
