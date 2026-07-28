import { ShieldCheck, ShieldAlert, Mail, Calendar, Clock } from "lucide-react";
import PlanBadge from "../../components/ui/PlanBadge";
import { Skeleton } from "../../components/ui/Skeleton";
import { formatDateTime } from "../../utils/format";

function InfoRow({ icon: Icon, label, value, extra }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated">
        <Icon size={14} className="text-text-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-text-muted">{label}</p>
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-white">{value}</p>
          {extra}
        </div>
      </div>
    </div>
  );
}

export default function AccountInfoCard({ profile, loading }) {
  if (loading || !profile) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="space-y-4">
          <Skeleton className="h-3 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Account information</p>
        <PlanBadge plan={profile.plan} size="sm" />
      </div>

      <div className="space-y-4">
        <InfoRow
          icon={Mail}
          label="Email address"
          value={profile.email}
          extra={
            profile.emailVerified ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                <ShieldCheck size={10} /> Verified
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                <ShieldAlert size={10} /> Unverified
              </span>
            )
          }
        />

        <InfoRow
          icon={Calendar}
          label="Member since"
          value={formatDateTime(profile.createdAt, "MMM d, yyyy")}
        />

        <InfoRow
          icon={Clock}
          label="Last sign-in"
          value={
            profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : "Never"
          }
        />
      </div>
    </div>
  );
}
