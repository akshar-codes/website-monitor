import { cn } from "../../utils/cn";

export default function PageHeader({ title, subtitle, actions, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-[#71717a]">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
