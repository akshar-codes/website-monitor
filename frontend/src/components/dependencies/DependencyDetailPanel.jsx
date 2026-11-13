import { useState } from "react";
import { Link } from "react-router-dom";
import {
  X,
  ExternalLink,
  ArrowRight,
  Plus,
  Trash2,
  Edit2,
  Power,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import {
  HEALTH_STATE_PROPS,
  formatFreshness,
} from "../../utils/dependencyFormat";
import { monitorDetailsPath } from "../../constants/routes";

export default function DependencyDetailPanel({
  node,
  allNodes = [],
  allEdges = [],
  onClose,
  onSelectNode,
  onAddDependency,
  onEditDependency,
  onDeleteDependency,
  onToggleDependency,
  mutating = false,
}) {
  const [confirmDeleteEdgeId, setConfirmDeleteEdgeId] = useState(null);

  if (!node) return null;

  const nodeMap = new Map((allNodes || []).map((n) => [String(n.id), n]));

  // Upstream: this node depends on target (edge.from === node.id)
  const upstreamEdges = (allEdges || []).filter(
    (e) => String(e.from) === String(node.id),
  );

  // Downstream: caller depends on this node (edge.to === node.id)
  const downstreamEdges = (allEdges || []).filter(
    (e) => String(e.to) === String(node.id),
  );

  const healthState = node.health?.state || "unknown";
  const healthProp =
    HEALTH_STATE_PROPS[healthState] || HEALTH_STATE_PROPS.unknown;

  const isMonitor = node.type === "monitor";
  const hasIncident = (node.health?.activeIncidentsCount || 0) > 0;
  const activeIncidentId = node.health?.activeIncidentId;

  const handleDeleteClick = (edgeId) => {
    if (confirmDeleteEdgeId === edgeId) {
      onDeleteDependency?.(edgeId);
      setConfirmDeleteEdgeId(null);
    } else {
      setConfirmDeleteEdgeId(edgeId);
    }
  };

  return (
    <aside
      className="w-full md:w-96 shrink-0 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg z-20 overflow-hidden"
      aria-label="Service Details Panel"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50/70">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded ${
                isMonitor
                  ? "bg-blue-100 text-blue-700"
                  : "bg-purple-100 text-purple-700"
              }`}
            >
              {isMonitor ? "Monitor" : "External Service"}
            </span>
            <span className="text-[11px] font-medium text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-200">
              {node.kind || "service"}
            </span>
          </div>
          <h2
            className="text-base font-bold text-slate-900 truncate"
            title={node.name}
          >
            {node.name}
          </h2>
          {node.url && (
            <p
              className="text-xs text-slate-500 truncate mt-0.5"
              title={node.url}
            >
              {node.url}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          aria-label="Close detail panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content scroll area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
        {/* Health status block */}
        <div
          className={`p-3.5 rounded-xl border ${healthProp.borderClass} ${healthProp.bgClass} flex flex-col gap-2.5`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${healthProp.dotClass}`}
              />
              <span className={`font-semibold ${healthProp.textClass}`}>
                {healthProp.label}
              </span>
            </div>
            {node.health?.statusCode && (
              <span className="text-xs font-mono font-medium text-slate-600 px-1.5 py-0.5 rounded bg-white/70 border border-slate-200">
                HTTP {node.health.statusCode}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
            <div>
              <span className="text-slate-500 block text-[11px]">Latency</span>
              <span className="font-semibold text-slate-800">
                {typeof node.health?.responseTime === "number"
                  ? `${node.health.responseTime} ms`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">
                Data Freshness
              </span>
              <span className="font-medium text-slate-700">
                {formatFreshness(node.health?.checkedAt)}
              </span>
            </div>
          </div>

          {node.health?.errorMessage && (
            <div className="text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-200 mt-1 wrap-break-word">
              {node.health.errorMessage}
            </div>
          )}
        </div>

        {/* Active Incident Banner */}
        {hasIncident && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
            <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-rose-900 text-xs uppercase tracking-wide">
                Active Outage ({node.health.activeIncidentsCount})
              </div>
              <p className="text-xs text-rose-700 mt-0.5">
                This service is experiencing an ongoing incident.
              </p>
              <div className="mt-2">
                <Link
                  to={
                    activeIncidentId
                      ? `/incidents/${activeIncidentId}`
                      : "/incidents"
                  }
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 hover:underline"
                >
                  Investigate incident <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* External Service Details (if applicable) */}
        {node.externalMetadata && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="font-semibold text-slate-700">
              External Provider
            </div>
            <div className="grid grid-cols-2 gap-1 text-slate-600">
              <span>Provider:</span>
              <span className="font-medium text-slate-900 text-right">
                {node.externalMetadata.provider || "Custom"}
              </span>
              {node.externalMetadata.contactEmail && (
                <>
                  <span>Contact:</span>
                  <span className="font-medium text-slate-900 text-right truncate">
                    {node.externalMetadata.contactEmail}
                  </span>
                </>
              )}
            </div>
            {node.externalMetadata.docsUrl && (
              <a
                href={node.externalMetadata.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline pt-1"
              >
                Documentation <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        {/* Section: Direct Upstream Dependencies (What this service relies on) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Depends On (Upstream)
              </h3>
              <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[11px] font-bold">
                {upstreamEdges.length}
              </span>
            </div>
            <button
              onClick={() => onAddDependency?.(node.id)}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
              title="Add a new dependency"
            >
              <Plus size={13} /> Add
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            Services required for <strong>{node.name}</strong> to function.
          </p>

          {upstreamEdges.length === 0 ? (
            <div className="p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-400">
              No upstream dependencies defined.
            </div>
          ) : (
            <div className="space-y-2">
              {upstreamEdges.map((edge) => {
                const targetNode = nodeMap.get(String(edge.to));
                const targetHealth =
                  HEALTH_STATE_PROPS[targetNode?.health?.state || "unknown"] ||
                  HEALTH_STATE_PROPS.unknown;

                return (
                  <div
                    key={edge.id}
                    className={`p-2.5 rounded-lg border transition-all ${
                      edge.enabled
                        ? "border-slate-200 bg-white hover:border-slate-300"
                        : "border-slate-200 bg-slate-50/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => onSelectNode?.(edge.to)}
                          className="font-semibold text-slate-900 hover:text-emerald-600 flex items-center gap-1 text-left truncate w-full"
                          title="View this dependency"
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${targetHealth.dotClass}`}
                          />
                          <span className="truncate">
                            {targetNode
                              ? targetNode.name
                              : `Service (${edge.to})`}
                          </span>
                          <ChevronRight
                            size={13}
                            className="text-slate-400 shrink-0"
                          />
                        </button>
                        <div className="flex items-center gap-2 mt-1 text-[11px]">
                          <span
                            className={`px-1.5 py-0.2 rounded font-semibold uppercase text-[10px] ${
                              edge.dependencyType === "hard"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-sky-100 text-sky-700"
                            }`}
                          >
                            {edge.dependencyType === "hard" ? "Hard" : "Soft"}
                          </span>
                          {!edge.enabled && (
                            <span className="text-slate-400 font-medium">
                              (Disabled)
                            </span>
                          )}
                          {edge.description && (
                            <span
                              className="text-slate-500 truncate"
                              title={edge.description}
                            >
                              {edge.description}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Edge action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() =>
                            onToggleDependency?.(edge.id, !edge.enabled)
                          }
                          disabled={mutating}
                          className={`p-1 rounded text-xs transition-colors ${
                            edge.enabled
                              ? "text-emerald-600 hover:bg-emerald-50"
                              : "text-slate-400 hover:bg-slate-200"
                          }`}
                          title={
                            edge.enabled
                              ? "Disable this relationship"
                              : "Enable this relationship"
                          }
                          aria-label="Toggle dependency"
                        >
                          <Power size={13} />
                        </button>
                        <button
                          onClick={() => onEditDependency?.(edge)}
                          disabled={mutating}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs"
                          title="Edit relationship"
                          aria-label="Edit dependency"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(edge.id)}
                          disabled={mutating}
                          className={`p-1 rounded text-xs transition-colors ${
                            confirmDeleteEdgeId === edge.id
                              ? "bg-rose-600 text-white font-bold"
                              : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          }`}
                          title={
                            confirmDeleteEdgeId === edge.id
                              ? "Click again to confirm delete"
                              : "Delete relationship"
                          }
                          aria-label="Delete dependency"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section: Direct Downstream Dependents (What relies on this) */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Dependents (Downstream)
            </h3>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[11px] font-bold">
              {downstreamEdges.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            Services that rely on <strong>{node.name}</strong> and may fail if
            it goes down.
          </p>

          {downstreamEdges.length === 0 ? (
            <div className="p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-400">
              No services depend on this node.
            </div>
          ) : (
            <div className="space-y-2">
              {downstreamEdges.map((edge) => {
                const callerNode = nodeMap.get(String(edge.from));
                const callerHealth =
                  HEALTH_STATE_PROPS[callerNode?.health?.state || "unknown"] ||
                  HEALTH_STATE_PROPS.unknown;

                return (
                  <div
                    key={edge.id}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-all"
                  >
                    <button
                      onClick={() => onSelectNode?.(edge.from)}
                      className="font-semibold text-slate-900 hover:text-emerald-600 flex items-center gap-1 text-left truncate w-full"
                      title="View this dependent"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${callerHealth.dotClass}`}
                      />
                      <span className="truncate">
                        {callerNode
                          ? callerNode.name
                          : `Service (${edge.from})`}
                      </span>
                      <ChevronRight
                        size={13}
                        className="text-slate-400 shrink-0"
                      />
                    </button>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span
                        className={`px-1.5 py-0.2 rounded font-semibold uppercase text-[10px] ${
                          edge.dependencyType === "hard"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {edge.dependencyType === "hard" ? "Hard" : "Soft"}
                      </span>
                      <span>Depends on this service</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer link to monitor details */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
        {isMonitor ? (
          <Link
            to={monitorDetailsPath(node.id)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <span>Monitor Details</span>
            <ExternalLink size={13} />
          </Link>
        ) : (
          <div className="text-xs text-slate-500 w-full text-center">
            Managed external service endpoint
          </div>
        )}
      </div>
    </aside>
  );
}
