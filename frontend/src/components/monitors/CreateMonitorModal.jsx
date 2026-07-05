import { memo, useCallback, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import InputLabel from "@mui/material/InputLabel";
import FormHelperText from "@mui/material/FormHelperText";
import CircularProgress from "@mui/material/CircularProgress";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import { useCreateMonitor } from "../../hooks/mutations/useCreateMonitor";
import { INTERVAL_PRESETS } from "../../utils/constants";

// For Zod v4 we use z.string() with refinements
const monitorSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(120, "Name must be 120 characters or fewer"),
  url: z.string().min(1, "URL is required").url("Please enter a valid URL"),
  interval: z.coerce
    .number()
    .refine(
      (val) => [30, 60, 120, 300, 600, 900, 1800, 3600].includes(val),
      "Please select a valid interval",
    ),
  active: z.boolean(),
});

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    fontFamily: "var(--font-sans)",
    fontSize: "0.875rem",
    color: "var(--text-primary)",
    "& fieldset": {
      borderColor: "var(--border)",
      borderRadius: "var(--radius-md)",
    },
    "&:hover fieldset": {
      borderColor: "var(--border-hover)",
    },
    "&.Mui-focused fieldset": {
      borderColor: "var(--primary)",
    },
  },
  "& .MuiInputLabel-root": {
    fontFamily: "var(--font-sans)",
    fontSize: "0.85rem",
    color: "var(--text-secondary)",
    "&.Mui-focused": {
      color: "var(--primary)",
    },
  },
  "& .MuiFormHelperText-root": {
    fontFamily: "var(--font-sans)",
    fontSize: "0.75rem",
  },
};

const selectSx = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.875rem",
  color: "var(--text-primary)",
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--border)",
    borderRadius: "var(--radius-md)",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--border-hover)",
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--primary)",
  },
};

function CreateMonitorModal({ open, onClose }) {
  const createMutation = useCreateMonitor();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isValid },
  } = useForm({
    defaultValues: {
      name: "",
      url: "",
      interval: 60,
      active: true,
    },
    mode: "onChange",
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      reset({
        name: "",
        url: "",
        interval: 60,
        active: true,
      });
    }
  }, [open, reset]);

  const onSubmit = useCallback(
    async (formData) => {
      // Validate with zod
      const result = monitorSchema.safeParse(formData);
      if (!result.success) return;

      try {
        await createMutation.mutateAsync(result.data);
        onClose();
      } catch {
        // Error handling is done in the mutation hook
      }
    },
    [createMutation, onClose],
  );

  return (
    <Dialog
      open={open}
      onClose={createMutation.isPending ? undefined : onClose}
      maxWidth="sm"
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
          fontWeight: 700,
          fontSize: "1.15rem",
          color: "var(--text-primary)",
          pb: 0.5,
        }}
      >
        <DnsRoundedIcon sx={{ color: "var(--primary)", fontSize: 26 }} />
        Add Monitor
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ pt: 1, pb: 2 }}>
          <div className="space-y-4">
            {/* Name */}
            <TextField
              id="create-monitor-name"
              {...register("name", {
                required: "Name is required",
                maxLength: { value: 120, message: "Max 120 characters" },
              })}
              label="Monitor Name"
              placeholder="My Website"
              fullWidth
              error={!!errors.name}
              helperText={errors.name?.message}
              sx={textFieldSx}
              autoFocus
            />

            {/* URL */}
            <TextField
              id="create-monitor-url"
              {...register("url", {
                required: "URL is required",
                pattern: {
                  value: /^https?:\/\/.+/i,
                  message:
                    "Please enter a valid URL starting with http:// or https://",
                },
              })}
              label="URL"
              placeholder="https://example.com"
              fullWidth
              error={!!errors.url}
              helperText={errors.url?.message}
              sx={textFieldSx}
            />

            {/* Interval */}
            <FormControl fullWidth error={!!errors.interval}>
              <InputLabel
                id="create-monitor-interval-label"
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  "&.Mui-focused": { color: "var(--primary)" },
                }}
              >
                Check Interval
              </InputLabel>
              <Controller
                name="interval"
                control={control}
                rules={{ required: "Interval is required" }}
                render={({ field }) => (
                  <Select
                    {...field}
                    id="create-monitor-interval"
                    labelId="create-monitor-interval-label"
                    label="Check Interval"
                    sx={selectSx}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          bgcolor: "var(--surface-raised)",
                          border: "1px solid var(--border)",
                          boxShadow: "var(--shadow-lg)",
                          "& .MuiMenuItem-root": {
                            fontFamily: "var(--font-sans)",
                            fontSize: "0.85rem",
                            color: "var(--text-primary)",
                            "&:hover": { bgcolor: "var(--primary-light)" },
                            "&.Mui-selected": {
                              bgcolor: "var(--primary-light)",
                              color: "var(--primary)",
                              fontWeight: 600,
                            },
                          },
                        },
                      },
                    }}
                  >
                    {INTERVAL_PRESETS.map((preset) => (
                      <MenuItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              {errors.interval && (
                <FormHelperText>{errors.interval.message}</FormHelperText>
              )}
            </FormControl>

            {/* Active */}
            <Controller
              name="active"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      id="create-monitor-active"
                      checked={field.value}
                      onChange={field.onChange}
                      sx={{
                        "& .MuiSwitch-switchBase.Mui-checked": {
                          color: "var(--status-up)",
                        },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                          {
                            backgroundColor: "var(--status-up)",
                          },
                      }}
                    />
                  }
                  label={
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Start monitoring immediately
                    </span>
                  }
                />
              )}
            />
          </div>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            id="create-monitor-cancel"
            onClick={onClose}
            disabled={createMutation.isPending}
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
            id="create-monitor-submit"
            type="submit"
            disabled={createMutation.isPending || !isValid}
            variant="contained"
            startIcon={
              createMutation.isPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
            sx={{
              bgcolor: "var(--primary)",
              fontWeight: 600,
              minWidth: 120,
              "&:hover": {
                bgcolor: "var(--primary-hover)",
              },
              "&.Mui-disabled": {
                bgcolor: "var(--border)",
                color: "var(--text-tertiary)",
              },
            }}
          >
            {createMutation.isPending ? "Creating…" : "Create Monitor"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default memo(CreateMonitorModal);
