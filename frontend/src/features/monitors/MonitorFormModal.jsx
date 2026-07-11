import { useEffect } from "react";
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
}) {
  const isEdit = !!monitor;

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
      interval: 300,
      active: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (monitor) {
        reset({
          name: monitor.name || "",
          url: monitor.url || "",
          interval: monitor.interval || 300,
          active: monitor.active ?? true,
        });
      } else {
        reset({ name: "", url: "", interval: 300, active: true });
      }
    }
  }, [open, monitor, reset]);

  const handleFormSubmit = (data) => {
    onSubmit(data);
  };

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
          >
            <Select {...register("interval")} error={!!errors.interval}>
              {INTERVAL_PRESETS.map((s) => (
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
