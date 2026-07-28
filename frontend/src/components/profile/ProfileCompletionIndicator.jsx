import { CheckCircle2, Circle } from "lucide-react";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../utils/cn";

const FIELD_LABELS = {
  name: "Full name",
  avatarUrl: "Profile photo",
  bio: "Bio",
  location: "Location",
  website: "Website",
  phone: "Phone number",
};

export default function ProfileCompletionIndicator({ completion, loading }) {
  if (loading || !completion) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-5">
        <div className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-1.5 w-full" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
    );
  }

  const { percentage = 0, missingFields = [] } = completion;
  const isComplete = percentage >= 100;

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Profile completion</p>
        <span
          className={cn(
            "text-sm font-bold",
            isComplete ? "text-emerald-400" : "text-amber-400",
          )}
        >
          {percentage}%
        </span>
      </div>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isComplete ? "bg-emerald-500" : "bg-amber-500",
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isComplete ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 size={13} /> Your profile is complete
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {missingFields.map((field) => (
            <span
              key={field}
              className="flex items-center gap-1.5 rounded-full border border-border-default bg-bg-elevated px-2.5 py-1 text-[11px] text-text-muted"
            >
              <Circle size={9} />
              {FIELD_LABELS[field] || field}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
