import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "../../components/ui/Modal";
import { FormField, Input, Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { formatInterval } from "../../utils/format";

const INTERVAL_PRESETS = [30, 60, 120, 300, 600, 900, 1800, 3600];

const monitorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name cannot exceed 120 characters"),
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .refine(
      (v) => {
        try {
          const p = new URL(v);
          return ["http:", "https:"].includes(p.protocol);
        } catch {
          return false;
        }
      },
      { message: "Must be a valid HTTP or HTTPS URL" },
    ),
  interval: z.coerce
    .number()
    .int()
    .refine((v) => INTERVAL_PRESETS.includes(v), {
      message: "Invalid interval",
    }),
  active: z.boolean(),
});

export default function MonitorFormModal({
  open,
  onClose,
  onSubmit,
  monitor,
  loading,
  // Fastest interval (seconds) the caller's plan allows. Faster presets
  // are hidden from the picker rather than disabled inline — the backend
  // remains the source of truth and re-validates on submit regardless of
  // what the client renders here.
  minIntervalSeconds = 30,
}) {
  const isEdit = !!monitor;

  const allowedPresets = useMemo(
    () => INTERVAL_PRESETS.filter((s) => s >= minIntervalSeconds),
    [minIntervalSeconds],
  );

  const defaultInterval = useMemo(() => {
    if (allowedPresets.includes(300)) return 300;
    return allowedPresets[0] ?? INTERVAL_PRESETS[INTERVAL_PRESETS.length - 1];
  }, [allowedPresets]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(monitorSchema),
    defaultValues: {
      name: "",
      url: "",
      interval: defaultInterval,
      active: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (monitor) {
        reset({
          name: monitor.name || "",
          url: monitor.url || "",
          interval: monitor.interval || defaultInterval,
          active: monitor.active ?? true,
        });
      } else {
        reset({ name: "", url: "", interval: defaultInterval, active: true });
      }
    }
  }, [open, monitor, reset, defaultInterval]);

  const handleFormSubmit = (data) => {
    onSubmit(data);
  };

  // When editing a monitor whose interval predates a plan downgrade, keep
  // it selectable in the list even though it's no longer offered for new
  // selections — otherwise the field would silently jump to a different
  // value on open.
  const intervalOptions = useMemo(() => {
    if (monitor && !allowedPresets.includes(monitor.interval)) {
      return [monitor.interval, ...allowedPresets].sort((a, b) => a - b);
    }
    return allowedPresets;
  }, [monitor, allowedPresets]);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title={isEdit ? "Edit Monitor" : "Add Monitor"}
        description={
          isEdit
            ? "Update the monitor configuration."
            : "Add a new website or API endpoint to monitor."
        }
        onClose={onClose}
      />
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <ModalBody className="space-y-4">
          <FormField label="Monitor name" error={errors.name?.message} required>
            <Input
              {...register("name")}
              placeholder="My Production API"
              error={!!errors.name}
              autoFocus
            />
          </FormField>

          <FormField
            label="URL"
            error={errors.url?.message}
            required
            hint="Must return a JSON health payload at this endpoint."
          >
            <Input
              {...register("url")}
              placeholder="https://api.example.com/health"
              error={!!errors.url}
            />
          </FormField>

          <FormField
            label="Check interval"
            error={errors.interval?.message}
            required
            hint={`Your plan allows checks as often as every ${minIntervalSeconds}s. Upgrade for faster polling.`}
          >
            <Select {...register("interval")} error={!!errors.interval}>
              {intervalOptions.map((s) => (
                <option key={s} value={s}>
                  Every {formatInterval(s)}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-elevated px-4 py-3">
            <input
              type="checkbox"
              id="active"
              {...register("active")}
              className="h-4 w-4 rounded border-border-strong bg-bg-subtle accent-emerald-500"
            />
            <div>
              <label
                htmlFor="active"
                className="text-sm font-medium text-white cursor-pointer"
              >
                Active monitoring
              </label>
              <p className="text-[11px] text-text-muted">
                Disable to pause checks without deleting the monitor
              </p>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            type="button"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            {isEdit ? "Save Changes" : "Add Monitor"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
