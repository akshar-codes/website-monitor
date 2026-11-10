import { useState } from "react";
import { generateHeartbeatSnippets } from "../../utils/jobFormat.js";
import {
  X,
  Copy,
  Check,
  Terminal,
  Key,
  AlertTriangle,
  RotateCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

export default function HeartbeatSetupModal({
  isOpen = true,
  onClose,
  job,
  plaintextToken = null,
  onRotateToken = null,
}) {
  const [activeTab, setActiveTab] = useState("curl");
  const [copiedKey, setCopiedKey] = useState(null);
  const [rotating, setRotating] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  if (!isOpen || !job) return null;

  const snippets = generateHeartbeatSnippets({
    jobMonitorId: job.id || job._id,
    token:
      plaintextToken ||
      (job.tokenPrefix ? `${job.tokenPrefix}...` : "<YOUR_TOKEN>"),
  });

  const copyToClipboard = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRotate = async () => {
    if (!onRotateToken) return;
    setRotating(true);
    try {
      await onRotateToken(job.id || job._id);
      setShowRotateConfirm(false);
    } catch {
      // toast is handled in hook
    } finally {
      setRotating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="heartbeat-setup-title"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2
              id="heartbeat-setup-title"
              className="text-lg font-bold text-slate-900 flex items-center gap-2"
            >
              <Terminal size={18} className="text-emerald-500" />
              Heartbeat Integration Setup
            </h2>
            <p className="text-xs text-slate-500">
              Reporting endpoint and authentication token for &ldquo;{job.name}
              &rdquo;.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* One-time Plaintext Token Banner (when token is revealed) */}
          {plaintextToken && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={17}
                  className="text-amber-600 shrink-0 mt-0.5"
                />
                <div>
                  <h3 className="text-xs font-bold text-amber-900">
                    Important: Copy your reporting token now
                  </h3>
                  <p className="text-xs text-amber-700">
                    For your security, SiteWatch only stores cryptographic
                    hashes. This token will not be displayed again.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-amber-200">
                <code className="text-xs font-mono text-slate-900 break-all select-all flex-1">
                  {plaintextToken}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(plaintextToken, "token")}
                  className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-md shrink-0 flex items-center gap-1 transition-colors"
                >
                  {copiedKey === "token" ? (
                    <Check size={12} />
                  ) : (
                    <Copy size={12} />
                  )}
                  <span>{copiedKey === "token" ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Reporting Endpoint */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Heartbeat Endpoint URL
            </label>
            <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                POST
              </span>
              <code className="text-xs font-mono text-slate-800 flex-1 truncate select-all">
                {snippets.reportingUrl}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(snippets.reportingUrl, "url")}
                className="p-1 text-slate-500 hover:text-slate-800 shrink-0"
                title="Copy endpoint URL"
              >
                {copiedKey === "url" ? (
                  <Check size={14} className="text-emerald-500" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>

          {/* Token Reference & Rotation (when not in initial plaintext mode) */}
          {!plaintextToken && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Key size={13} className="text-emerald-500" /> Reporting Token
                  Prefix:
                  <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {job.tokenPrefix || "jm_live_..."}
                  </code>
                </span>
                <p className="text-[11px] text-slate-500">
                  Full token is securely hashed. Need a new token? Rotate with a
                  24-hour grace period.
                </p>
              </div>
              {onRotateToken && (
                <button
                  type="button"
                  onClick={() => setShowRotateConfirm(true)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <RotateCw size={12} />
                  <span>Rotate Token</span>
                </button>
              )}
            </div>
          )}

          {/* Rotation Confirmation Sub-modal/callout */}
          {showRotateConfirm && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert
                  size={16}
                  className="text-rose-600 shrink-0 mt-0.5"
                />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-rose-900 block">
                    Confirm Token Rotation
                  </span>
                  <p className="text-xs text-rose-700">
                    A new token will be generated. Your previous token will
                    remain active for 24 hours so you can update your crontab or
                    pipeline without missing heartbeats.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowRotateConfirm(false)}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:bg-white rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  disabled={rotating}
                  className="px-3 py-1 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-md disabled:opacity-50"
                >
                  {rotating ? "Rotating..." : "Rotate Token"}
                </button>
              </div>
            </div>
          )}

          {/* Code Examples Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Integration Snippets
              </label>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab("curl")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeTab === "curl"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  cURL
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("node")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeTab === "node"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Node.js
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("python")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    activeTab === "python"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Python
                </button>
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
                <span>
                  {activeTab === "curl" && "shell / crontab"}
                  {activeTab === "node" && "job.js"}
                  {activeTab === "python" && "job.py"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const code =
                      activeTab === "curl"
                        ? snippets.curl
                        : activeTab === "node"
                          ? snippets.nodejs
                          : snippets.python;
                    copyToClipboard(code, activeTab);
                  }}
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
                >
                  {copiedKey === activeTab ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : (
                    <Copy size={12} />
                  )}
                  <span>
                    {copiedKey === activeTab ? "Copied" : "Copy snippet"}
                  </span>
                </button>
              </div>
              <pre className="p-3.5 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-60">
                <code>
                  {activeTab === "curl" && snippets.curl}
                  {activeTab === "node" && snippets.nodejs}
                  {activeTab === "python" && snippets.python}
                </code>
              </pre>
            </div>
          </div>

          {/* Environment Variable Recommendation */}
          <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-1">
            <span className="font-semibold block">
              Production Recommendation:
            </span>
            <p className="text-blue-800 leading-normal">
              Store your token in an environment variable such as{" "}
              <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">
                JOB_MONITOR_TOKEN
              </code>{" "}
              rather than hardcoding it in scripts or version control.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
