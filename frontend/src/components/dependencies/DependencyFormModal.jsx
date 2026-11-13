import { useState, useEffect } from "react";
import {
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  PlusCircle,
} from "lucide-react";
import * as dependenciesApi from "../../services/api/dependencies";

const EXTERNAL_KINDS = [
  { value: "database", label: "Database (e.g. Postgres, MongoDB)" },
  { value: "payment_gateway", label: "Payment Gateway (e.g. Stripe, PayPal)" },
  { value: "saas", label: "SaaS / Third-Party (e.g. Twilio, Sendgrid)" },
  { value: "cloud_provider", label: "Cloud Provider (e.g. AWS, GCP)" },
  { value: "cdn", label: "CDN (e.g. Cloudflare, CloudFront)" },
  { value: "auth_provider", label: "Auth Provider (e.g. Auth0, Cognito)" },
  { value: "api", label: "External REST/GraphQL API" },
  { value: "other", label: "Other External Resource" },
];

function DependencyFormDialog({
  onClose,
  onSubmit,
  initialDependentId = "",
  initialData = null,
  monitors = [],
  externalServices = [],
  existingEdges = [],
  onCreateExternalService,
}) {
  const isEdit = Boolean(initialData);
  const isExt = Boolean(
    initialData &&
    externalServices.some(
      (es) => String(es.id || es._id) === String(initialData.to),
    ),
  );

  // Form State initialized directly from props
  const [dependentMonitorId, setDependentMonitorId] = useState(
    initialData
      ? String(initialData.from || "")
      : String(initialDependentId || ""),
  );
  const [targetType, setTargetType] = useState(
    isExt ? "external_service" : "monitor",
  );
  const [targetId, setTargetId] = useState(
    initialData ? String(initialData.to || "") : "",
  );
  const [dependencyType, setDependencyType] = useState(
    initialData?.dependencyType || "hard",
  );
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [enabled, setEnabled] = useState(initialData?.enabled !== false);

  // New External Service Inline Form State
  const [showNewExternalForm, setShowNewExternalForm] = useState(false);
  const [newExtName, setNewExtName] = useState("");
  const [newExtKind, setNewExtKind] = useState("api");
  const [newExtUrl, setNewExtUrl] = useState("");
  const [creatingExternal, setCreatingExternal] = useState(false);

  // Validation State
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null); // { valid: bool, message: string }
  const [clientError, setClientError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pre-flight cycle validation on source/target change (debounced async)
  useEffect(() => {
    if (isEdit || !dependentMonitorId || !targetId) {
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(() => {
      // Client-side quick checks
      if (targetType === "monitor" && dependentMonitorId === targetId) {
        setClientError("A service cannot depend on itself.");
        setValidationResult({
          valid: false,
          message: "Self-dependency is not allowed.",
        });
        return;
      }

      const alreadyExists = existingEdges.some(
        (e) =>
          String(e.from) === String(dependentMonitorId) &&
          String(e.to) === String(targetId),
      );
      if (alreadyExists) {
        setClientError("This dependency relationship already exists.");
        setValidationResult({
          valid: false,
          message: "Duplicate relationship exists in the dependency graph.",
        });
        return;
      }

      setClientError("");
      setValidating(true);

      const payload = {
        dependentMonitorId,
        toType: targetType,
        ...(targetType === "monitor"
          ? { dependencyMonitorId: targetId }
          : { dependencyExternalServiceId: targetId }),
        dependencyType,
      };

      dependenciesApi
        .validateProposedDependency(payload)
        .then((res) => {
          if (isCancelled) return;
          if (res.valid) {
            setValidationResult({
              valid: true,
              message:
                "No cycles detected. The dependency graph structure is valid.",
            });
          } else {
            setValidationResult({
              valid: false,
              message:
                res.message ||
                "Proposed edge violates DAG rules (cyclic dependency).",
            });
          }
        })
        .catch((err) => {
          if (isCancelled) return;
          setValidationResult({
            valid: false,
            message:
              err?.response?.data?.message ||
              err?.message ||
              "Unable to perform pre-flight validation.",
          });
        })
        .finally(() => {
          if (!isCancelled) setValidating(false);
        });
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    dependentMonitorId,
    targetType,
    targetId,
    dependencyType,
    isEdit,
    existingEdges,
  ]);

  const handleCreateExternal = async (e) => {
    e.preventDefault();
    if (!newExtName.trim()) return;

    try {
      setCreatingExternal(true);
      const created = await onCreateExternalService?.({
        name: newExtName.trim(),
        kind: newExtKind,
        url: newExtUrl.trim() || undefined,
      });

      if (created) {
        setTargetType("external_service");
        setTargetId(String(created.id || created._id));
        setShowNewExternalForm(false);
        setNewExtName("");
        setNewExtUrl("");
      }
    } catch (err) {
      setClientError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create external service.",
      );
    } finally {
      setCreatingExternal(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isEdit) {
      if (!dependentMonitorId) {
        setClientError("Please select the caller service (dependent monitor).");
        return;
      }
      if (!targetId) {
        setClientError("Please select the target dependency.");
        return;
      }
      if (validationResult && !validationResult.valid) {
        setClientError(validationResult.message);
        return;
      }
    }

    try {
      setSubmitting(true);
      setClientError("");

      if (isEdit) {
        await onSubmit({
          id: initialData.id,
          dependencyType,
          description: description.trim() || undefined,
          enabled,
        });
      } else {
        const payload = {
          dependentMonitorId,
          toType: targetType,
          ...(targetType === "monitor"
            ? { dependencyMonitorId: targetId }
            : { dependencyExternalServiceId: targetId }),
          dependencyType,
          description: description.trim() || undefined,
        };
        await onSubmit(payload);
      }
      onClose();
    } catch (err) {
      setClientError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save dependency relationship.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dependency-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div>
            <h2
              id="dependency-modal-title"
              className="text-base font-bold text-slate-900"
            >
              {isEdit
                ? "Edit Dependency Relationship"
                : "Add Service Dependency"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? "Update relationship strength, description, or active status."
                : "Define that Service A requires Service B to be operational."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {clientError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle
                size={15}
                className="shrink-0 mt-0.5 text-rose-600"
              />
              <span>{clientError}</span>
            </div>
          )}

          {/* Direction Banner */}
          {!isEdit && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2">
              <span className="font-semibold">Direction semantics:</span>
              <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-emerald-200 font-bold">
                Source (Caller) &rarr; Target (Dependency)
              </span>
            </div>
          )}

          {/* Step 1: Caller / Dependent Monitor */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              1. Dependent Service (Caller / Source) *
            </label>
            {isEdit ? (
              <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-sm font-medium text-slate-800">
                {monitors.find(
                  (m) => String(m.id || m._id) === String(dependentMonitorId),
                )?.name || dependentMonitorId}
              </div>
            ) : (
              <select
                value={dependentMonitorId}
                onChange={(e) => setDependentMonitorId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">
                  Select the monitor that has a dependency...
                </option>
                {monitors.map((m) => (
                  <option key={m.id || m._id} value={m.id || m._id}>
                    {m.name} {m.url ? `(${m.url})` : ""}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-slate-400">
              The internal service that depends on another service to function.
            </p>
          </div>

          {/* Step 2: Target Dependency (Depends On) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 block">
                2. Depends On (Target Service) *
              </label>
              {!isEdit && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType("monitor");
                      setTargetId("");
                      setShowNewExternalForm(false);
                    }}
                    className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                      targetType === "monitor" && !showNewExternalForm
                        ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Monitored Service
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType("external_service");
                      setTargetId("");
                    }}
                    className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                      targetType === "external_service" && !showNewExternalForm
                        ? "bg-purple-600 text-white border-purple-600 font-semibold"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    External Service
                  </button>
                </div>
              )}
            </div>

            {isEdit ? (
              <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-sm font-medium text-slate-800">
                {targetType === "monitor"
                  ? monitors.find(
                      (m) => String(m.id || m._id) === String(targetId),
                    )?.name || targetId
                  : externalServices.find(
                      (es) => String(es.id || es._id) === String(targetId),
                    )?.name || targetId}
              </div>
            ) : !showNewExternalForm ? (
              <div className="space-y-2">
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">
                    {targetType === "monitor"
                      ? "Select target monitored service..."
                      : "Select registered external service..."}
                  </option>
                  {targetType === "monitor"
                    ? monitors
                        .filter(
                          (m) =>
                            String(m.id || m._id) !==
                            String(dependentMonitorId),
                        )
                        .map((m) => (
                          <option key={m.id || m._id} value={m.id || m._id}>
                            {m.name} {m.url ? `(${m.url})` : ""}
                          </option>
                        ))
                    : externalServices.map((es) => (
                        <option key={es.id || es._id} value={es.id || es._id}>
                          {es.name} ({es.kind || "external"})
                        </option>
                      ))}
                </select>

                {targetType === "external_service" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowNewExternalForm(true)}
                      className="text-xs text-purple-600 hover:text-purple-700 font-semibold inline-flex items-center gap-1"
                    >
                      <PlusCircle size={13} /> Add New External Service
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Inline form to create a new external service */
              <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900">
                    Register External Dependency
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewExternalForm(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Service Name (e.g. Stripe API, Auth0, RDS Postgres)"
                    value={newExtName}
                    onChange={(e) => setNewExtName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-purple-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newExtKind}
                    onChange={(e) => setNewExtKind(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-purple-200 bg-white text-slate-900"
                  >
                    {EXTERNAL_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="url"
                    placeholder="Endpoint URL (Optional)"
                    value={newExtUrl}
                    onChange={(e) => setNewExtUrl(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-purple-200 bg-white text-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateExternal}
                  disabled={creatingExternal || !newExtName.trim()}
                  className="w-full py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {creatingExternal ? "Creating..." : "Save External Service"}
                </button>
              </div>
            )}
          </div>

          {/* Validation Feedback Banner */}
          {!isEdit && (validating || validationResult) && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                validating
                  ? "bg-slate-50 border-slate-200 text-slate-600"
                  : validationResult?.valid
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {validating ? (
                <Loader2
                  size={15}
                  className="animate-spin text-slate-500 mt-0.5 shrink-0"
                />
              ) : validationResult?.valid ? (
                <CheckCircle2
                  size={15}
                  className="text-emerald-600 mt-0.5 shrink-0"
                />
              ) : (
                <ShieldAlert
                  size={15}
                  className="text-rose-600 mt-0.5 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <span className="font-semibold block">
                  {validating
                    ? "Validating dependency graph..."
                    : validationResult?.valid
                      ? "Cycle Check Passed"
                      : "Invalid Relationship"}
                </span>
                <span className="text-[11px] block mt-0.5">
                  {validating
                    ? "Checking for cyclic dependencies and path depth..."
                    : validationResult?.message}
                </span>
              </div>
            </div>
          )}

          {/* Step 3: Relationship Type (Hard vs Soft) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-slate-700 block">
              3. Dependency Strength *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                  dependencyType === "hard"
                    ? "border-rose-400 bg-rose-50/50 ring-2 ring-rose-200"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-rose-900 uppercase">
                    Hard Dependency
                  </span>
                  <input
                    type="radio"
                    name="dependencyType"
                    value="hard"
                    checked={dependencyType === "hard"}
                    onChange={() => setDependencyType("hard")}
                    className="accent-rose-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Critical. If this target fails, the caller service is
                  completely broken.
                </p>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                  dependencyType === "soft"
                    ? "border-sky-400 bg-sky-50/50 ring-2 ring-sky-200"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-sky-900 uppercase">
                    Soft Dependency
                  </span>
                  <input
                    type="radio"
                    name="dependencyType"
                    value="soft"
                    checked={dependencyType === "soft"}
                    onChange={() => setDependencyType("soft")}
                    className="accent-sky-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Non-critical or has graceful fallback (e.g. analytics,
                  caching, optional widgets).
                </p>
              </label>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Authenticates user sessions, stores primary customer records..."
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Enabled Status */}
          {isEdit && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-xs font-semibold text-slate-900 block">
                  Relationship Active
                </span>
                <span className="text-[11px] text-slate-500">
                  Temporarily disable this edge without deleting it.
                </span>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                (!isEdit &&
                  (!dependentMonitorId ||
                    !targetId ||
                    validationResult?.valid === false))
              }
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>
                  {isEdit ? "Update Relationship" : "Create Dependency"}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DependencyFormModal(props) {
  if (!props.open) return null;
  const dialogKey =
    props.initialData?.id ||
    props.initialData?._id ||
    props.initialDependentId ||
    "new";
  return <DependencyFormDialog key={dialogKey} {...props} />;
}
