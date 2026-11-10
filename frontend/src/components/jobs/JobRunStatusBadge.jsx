import { getJobRunStatusBadgeProps } from "../../utils/jobFormat.js";

export default function JobRunStatusBadge({ status, className = "" }) {
  const { label, bgClass, dotClass } = getJobRunStatusBadgeProps(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${bgClass} ${className}`}
      data-testid="job-run-status-badge"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotClass}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
