import { getJobStatusBadgeProps } from "../../utils/jobFormat.js";

export default function JobStatusBadge({
  status,
  active = true,
  className = "",
}) {
  const { label, bgClass, dotClass } = getJobStatusBadgeProps(status, active);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${bgClass} ${className}`}
      data-testid="job-status-badge"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotClass}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
