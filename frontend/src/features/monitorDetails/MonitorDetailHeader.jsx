import {
  ArrowLeft,
  RefreshCw,
  Edit2,
  Pause,
  Play,
  Trash2,
  ExternalLink,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Can from "../../components/access/Can";
import { Skeleton } from "../../components/ui/Skeleton";
import { getDomain } from "../../utils/format";

export default function MonitorDetailHeader({
  monitor,
  loading,
  onBack,
  onRefresh,
  onEdit,
  onToggle,
  onDelete,
  onManualCheck,
  checking,
}) {
  if (loading || !monitor) {
    return (
      <div className="mb-6">
        <Skeleton className="mb-4 h-3 w-32" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-72" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-white"
      >
        <ArrowLeft size={13} /> Back to Monitors
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-white">
              {monitor.name}
            </h1>
            {!monitor.active && (
              <span className="shrink-0 rounded-full bg-bg-subtle px-2 py-0.5 text-[11px] font-medium text-text-muted">
                Paused
              </span>
            )}
          </div>
          <div className="mt-1">
            <a
              href={monitor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-text-secondary transition-colors hover:text-emerald-400"
            >
              {getDomain(monitor.url)}
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Can permission="monitor:update">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={checking}
              onClick={onManualCheck}
            >
              Check now
            </Button>
          </Can>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={onRefresh}
          >
            Refresh
          </Button>
          <Can permission="monitor:update">
            <Button variant="secondary" size="sm" icon={Edit2} onClick={onEdit}>
              Edit
            </Button>
          </Can>
          <Can permission="monitor:update">
            <Button
              variant="secondary"
              size="sm"
              icon={monitor.active ? Pause : Play}
              onClick={onToggle}
            >
              {monitor.active ? "Pause" : "Resume"}
            </Button>
          </Can>
          <Can permission="monitor:delete">
            <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete}>
              Delete
            </Button>
          </Can>
        </div>
      </div>
    </div>
  );
}
