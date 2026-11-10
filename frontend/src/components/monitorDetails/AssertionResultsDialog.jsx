import { CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";
import { Button } from "../ui/Primitives";

export default function AssertionResultsDialog({ open, onClose, check }) {
  if (!open || !check) return null;

  const results = check.assertionResults || [];
  const summary = check.assertionSummary || {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => r.outcome === "failed").length,
    errors: results.filter((r) => r.outcome === "error").length,
    durationMs: 0,
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="form-modal max-w-2xl w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assertion-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sw-panel-heading flex justify-between items-center pb-3 border-b">
          <div>
            <h2 id="assertion-modal-title" className="text-lg font-bold">
              API Assertion Results
            </h2>
            <p className="text-xs text-slate-500">
              Check performed on {new Date(check.checkedAt).toLocaleString()}
            </p>
          </div>
          <button
            className="modal-close text-slate-400 hover:text-slate-600 p-1"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Summary Card */}
        <div className="my-4 p-3 rounded-lg bg-slate-50 border flex items-center justify-between">
          <div className="flex gap-4 items-center">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                summary.failed === 0 && summary.errors === 0
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {summary.failed === 0 && summary.errors === 0 ? (
                <>
                  <CheckCircle2 size={14} /> All Passed
                </>
              ) : (
                <>
                  <XCircle size={14} /> {summary.failed + summary.errors} Failed
                </>
              )}
            </span>
            <div className="text-xs text-slate-600 space-x-2">
              <span className="text-emerald-700 font-medium">
                {summary.passed} passed
              </span>
              <span>·</span>
              <span className="text-red-700 font-medium">
                {summary.failed} failed
              </span>
              <span>·</span>
              <span className="text-amber-700 font-medium">
                {summary.errors} errors
              </span>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {summary.durationMs}ms
          </span>
        </div>

        {/* Results List */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {results.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No assertion evaluation details recorded for this check.
            </p>
          ) : (
            results.map((item, idx) => (
              <div
                key={item.assertionId || idx}
                className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                  item.outcome === "passed"
                    ? "bg-emerald-50/30 border-emerald-200"
                    : item.outcome === "failed"
                      ? "bg-red-50/40 border-red-200"
                      : "bg-amber-50/40 border-amber-200"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                        item.outcome === "passed"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.outcome === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.outcome === "passed" && <CheckCircle2 size={12} />}
                      {item.outcome === "failed" && <XCircle size={12} />}
                      {item.outcome === "error" && <AlertTriangle size={12} />}
                      {item.outcome}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {item.type}
                    </span>
                    {item.property && (
                      <span className="text-slate-500 font-mono">
                        ({item.property})
                      </span>
                    )}
                    {item.required === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                        Informational
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {item.durationMs}ms
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Comparison & Target
                    </span>
                    <span className="font-mono text-slate-800">
                      {item.comparison}{" "}
                      {item.targetValue != null ? String(item.targetValue) : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Actual Value
                    </span>
                    <span className="font-mono text-slate-800 truncate block">
                      {item.actualValue != null
                        ? String(item.actualValue)
                        : "—"}
                    </span>
                  </div>
                </div>

                {item.message && (
                  <div className="mt-1 pt-1.5 border-t border-slate-200 text-slate-600 font-mono text-[11px]">
                    {item.message}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-3 border-t flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </section>
    </div>
  );
}
