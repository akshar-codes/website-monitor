import {
  X,
  Rocket,
  GitCommit,
  ExternalLink,
  Calendar,
  Server,
  Tag,
  Info,
} from "lucide-react";
import {
  getEnvironmentBadgeStyle,
  shortCommitSha,
} from "../../utils/deploymentFormat";
import { formatDateTime, formatRelative } from "../../utils/format";
import { Button } from "../ui/Primitives";

export default function DeploymentDetailModal({ open, onClose, deployment }) {
  if (!open || !deployment) return null;

  const envStyle = getEnvironmentBadgeStyle(deployment.environment);
  const commit = shortCommitSha(deployment.commitSha);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="form-modal max-w-xl w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deployment-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sw-panel-heading flex justify-between items-center pb-3 border-b">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Rocket size={18} />
            </span>
            <div>
              <h2
                id="deployment-modal-title"
                className="text-lg font-bold text-slate-900"
              >
                Release {deployment.version}
              </h2>
              <p className="text-xs text-slate-500">
                Deployed {formatRelative(deployment.deployedAt)}
              </p>
            </div>
          </div>
          <button
            className="modal-close text-slate-400 hover:text-slate-600 p-1"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="my-4 grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 flex items-center gap-1.5 mb-1">
              <Server size={13} /> Environment
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${envStyle.badgeClass}`}
            >
              {envStyle.label}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 flex items-center gap-1.5 mb-1">
              <GitCommit size={13} /> Commit SHA
            </span>
            {commit ? (
              <span className="font-mono font-semibold text-slate-800">
                {commit}
                {deployment.commitSha.length > 7 && (
                  <span className="text-slate-400 font-normal">
                    {deployment.commitSha.slice(7, 12)}...
                  </span>
                )}
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 flex items-center gap-1.5 mb-1">
              <Calendar size={13} /> Deployed At
            </span>
            <span className="font-medium text-slate-800">
              {formatDateTime(deployment.deployedAt)}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 flex items-center gap-1.5 mb-1">
              <Tag size={13} /> Source
            </span>
            <span className="capitalize font-medium text-slate-800">
              {deployment.source || "custom"}
            </span>
          </div>
        </div>

        {/* Description / Notes */}
        {deployment.description && (
          <div className="my-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Info size={13} /> Release Description
            </h4>
            <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
              {deployment.description}
            </p>
          </div>
        )}

        {/* External URL Link */}
        {deployment.url && (
          <div className="my-3">
            <a
              href={deployment.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <ExternalLink size={13} /> Open deployment build / release page
            </a>
          </div>
        )}

        {/* Affected Monitors Count */}
        {Array.isArray(deployment.monitors) &&
          deployment.monitors.length > 0 && (
            <div className="mt-3 text-xs text-slate-500">
              <span>
                Associated with {deployment.monitors.length} monitor(s)
              </span>
            </div>
          )}

        <div className="mt-6 pt-3 border-t flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </section>
    </div>
  );
}
