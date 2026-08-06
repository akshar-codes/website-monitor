import { Modal } from "./Modal";
import Button from "./Button";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "../../utils/cn";

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  confirmVariant = "danger",
  loading = false,
}) {
  const isDanger = confirmVariant === "danger";
  const Icon = isDanger ? AlertTriangle : Info;

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-[440px]">
      <div className="relative overflow-hidden">
        {/* Subtle background glow for a premium glassmorphic feel */}
        <div
          className={cn(
            "pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-[0.15] blur-3xl",
            isDanger ? "bg-red-500" : "bg-emerald-500"
          )}
        />

        <div className="relative p-6 sm:p-7">
          <div className="flex gap-4 sm:gap-5">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-sm",
                isDanger
                  ? "border-red-500/20 bg-red-500/10 text-red-500 shadow-red-500/10"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-emerald-500/10"
              )}
            >
              <Icon size={22} strokeWidth={2.5} />
            </div>

            <div className="flex-1 pt-0.5">
              <h2 className="text-base font-semibold tracking-tight text-white sm:text-[17px]">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {description || "This action cannot be undone."}
              </p>
            </div>
          </div>

          <div className="mt-8 flex w-full flex-col-reverse justify-end gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto sm:px-5"
            >
              Cancel
            </Button>
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              loading={loading}
              className="w-full shadow-lg sm:w-auto sm:px-6"
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
