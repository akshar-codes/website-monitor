import React, { useState } from "react";
import {
  MoreHorizontal,
  Edit2,
  Pause,
  Play,
  Trash2,
  ExternalLink,
} from "lucide-react";
import StatusBadge from "../../components/ui/StatusBadge";
import {
  formatResponseTime,
  formatUptime,
  formatRelative,
  formatInterval,
  getDomain,
} from "../../utils/format";
import { cn } from "../../utils/cn";

function ActionMenu({ monitor, onEdit, onToggle, onDelete }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-white"
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-border-default bg-bg-elevated py-1 shadow-2xl">
            <button
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-subtle hover:text-white"
            >
              <Edit2 size={13} /> Edit
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onToggle();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-subtle hover:text-white"
            >
              {monitor.active ? <Pause size={13} /> : <Play size={13} />}
              {monitor.active ? "Pause" : "Resume"}
            </button>
            <div className="my-1 h-px bg-bg-subtle" />
            <button
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function MonitorRow({
  monitor,
  stats,
  onEdit,
  onDelete,
  onToggle,
}) {
  const status = monitor.active ? stats?.currentStatus || "unknown" : "paused";

  const uptime = stats?.uptime?.percentage;
  const avgRt = stats?.responseTime?.average;

  return (
    <div className="grid grid-cols-[1fr_100px_100px_90px_90px_100px_40px] items-center gap-3 border-b border-[#1a1a1d] px-5 py-4 transition-colors hover:bg-[#131315] last:border-0">
      {/* Name + URL */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-white">
            {monitor.name}
          </p>
          {!monitor.active && (
            <span className="shrink-0 rounded-full bg-bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-[#71717a]">
              Paused
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="truncate text-xs text-text-muted">{monitor.url}</p>
          <a
            href={monitor.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-text-disabled hover:text-[#71717a] transition-colors"
          >
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Status */}
      <div>
        <StatusBadge status={status} size="sm" />
      </div>

      {/* Uptime */}
      <div>
        <p className="text-sm font-medium text-white">
          {uptime != null ? formatUptime(uptime) : "—"}
        </p>
        <p className="text-[11px] text-text-muted">
          {stats?.uptime?.window || "24h"}
        </p>
      </div>

      {/* Avg response */}
      <div>
        <p className="text-sm font-medium text-white">
          {avgRt != null ? formatResponseTime(avgRt) : "—"}
        </p>
        <p className="text-[11px] text-text-muted">avg</p>
      </div>

      {/* Interval */}
      <div>
        <p className="text-sm text-text-secondary">
          {formatInterval(monitor.interval)}
        </p>
      </div>

      {/* Last check */}
      <div>
        <p className="text-xs text-[#71717a]">
          {formatRelative(monitor.lastCheckedAt)}
        </p>
      </div>

      {/* Actions */}
      <ActionMenu
        monitor={monitor}
        onEdit={onEdit}
        onToggle={onToggle}
        onDelete={onDelete}
      />
    </div>
  );
}
