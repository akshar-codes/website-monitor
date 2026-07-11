import { forwardRef } from "react";
import { cn } from "../../utils/cn";

export const Label = forwardRef(function Label(
  { children, className, required, ...props },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn(
        "block text-[11px] font-medium uppercase tracking-wider text-[#71717a]",
        className,
      )}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );
});

export const Input = forwardRef(function Input(
  { className, error, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border bg-bg-elevated px-3 text-sm text-white placeholder:text-text-disabled outline-none transition-all",
        "border-border-default focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10",
        error &&
          "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea(
  { className, error, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border bg-bg-elevated px-3 py-2 text-sm text-white placeholder:text-text-disabled outline-none transition-all resize-none",
        "border-border-default focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10",
        error && "border-red-500/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select(
  { className, error, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg border bg-bg-elevated px-3 text-sm text-white outline-none transition-all appearance-none",
        "border-border-default focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10",
        error && "border-red-500/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function FormField({ label, error, required, children, hint }) {
  return (
    <div className="space-y-1.5">
      {label && <Label required={required}>{label}</Label>}
      {children}
      {hint && !error && <p className="text-[11px] text-text-muted">{hint}</p>}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
