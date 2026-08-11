import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "../../components/ui/Modal";
import { FormField, Textarea, Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Can from "../../components/access/Can";
import {
  SeverityBadge,
  IncidentStatusBadge,
} from "../../components/ui/SeverityBadge";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  formatDateTime,
  formatDuration,
  formatRelative,
  getDomain,
} from "../../utils/format";

// Mirrors backend/src/services/incident.service.js#ALLOWED_TRANSITIONS —
// kept in sync manually, same pattern already used for ROLES/PLANS/etc.
// in this codebase. The backend remains the source of truth and
// re-validates every transition regardless of what's offered here.
const ALLOWED_TRANSITIONS = {
  ongoing: ["investigating", "identified", "resolved"],
  investigating: ["identified", "resolved"],
  identified: ["resolved"],
  resolved: [],
};

const STATUS_LABELS = {
  ongoing: "Ongoing",
  investigating: "Investigating",
  identified: "Identified",
  resolved: "Resolved",
};

function MetaRow({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

export default function IncidentDetailsModal({
  open,
  onClose,
  incident,
  loading = false,
  onUpdateStatus,
  updating = false,
}) {
  const [nextStatus, setNextStatus] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Re-hydrate the form whenever a fresh incident loads (opening the
  // modal, or switching to a different incident), so a previous
  // selection never lingers.
  useEffect(() => {
    if (open && incident) {
      const allowed = ALLOWED_TRANSITIONS[incident.status] || [];
      setNextStatus(allowed[0] || "");
      setRootCause(incident.rootCause || "");
      setResolutionNotes(incident.resolutionNotes || "");
    }
  }, [open, incident]);

  if (!open) return null;

  const monitor = incident?.monitor;
  const allowedTransitions = incident
    ? ALLOWED_TRANSITIONS[incident.status] || []
    : [];
  const statusHistory = incident?.statusHistory || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nextStatus || !incident) return;

    const payload = { status: nextStatus };
    if (rootCause.trim()) payload.rootCause = rootCause.trim();
    if (nextStatus === "resolved" && resolutionNotes.trim()) {
      payload.resolutionNotes = resolutionNotes.trim();
    }

    onUpdateStatus?.(incident.id || incident._id, payload);
  };

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-2xl">
      <ModalHeader
        title={
          loading || !incident
            ? "Incident details"
            : monitor?.name || getDomain(monitor?.url) || "Incident details"
        }
        description={monitor?.url}
        onClose={onClose}
      />

      <ModalBody className="max-h-[70vh] space-y-6 overflow-y-auto">
        {loading || !incident ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={incident.severity} />
              <IncidentStatusBadge status={incident.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <MetaRow
                label="Started"
                value={formatDateTime(incident.startedAt)}
              />
              <MetaRow
                label="Ended"
                value={
                  incident.endedAt
                    ? formatDateTime(incident.endedAt)
                    : "Ongoing"
                }
              />
              <MetaRow
                label="Duration"
                value={
                  incident.duration
                    ? formatDuration(incident.duration)
                    : "Ongoing"
                }
              />
            </div>

            {(incident.rootCause || incident.resolutionNotes) && (
              <div className="space-y-3 rounded-lg border border-border-subtle bg-bg-elevated p-4">
                {incident.rootCause && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Root cause
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {incident.rootCause}
                    </p>
                  </div>
                )}
                {incident.resolutionNotes && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Resolution notes
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {incident.resolutionNotes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Status history timeline */}
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Timeline
              </p>
              <div className="space-y-0">
                {statusHistory.length ? (
                  statusHistory.map((entry, i) => (
                    <div key={i} className="flex gap-3 pb-4 last:pb-0">
                      <div className="flex flex-col items-center">
                        {i === statusHistory.length - 1 ? (
                          <CheckCircle2
                            size={15}
                            className="shrink-0 text-emerald-400"
                          />
                        ) : (
                          <Circle
                            size={15}
                            className="shrink-0 text-text-disabled"
                          />
                        )}
                        {i < statusHistory.length - 1 && (
                          <span className="mt-1 w-px flex-1 bg-border-subtle" />
                        )}
                      </div>
                      <div className="min-w-0 pb-1">
                        <p className="text-sm font-medium text-white">
                          {STATUS_LABELS[entry.status] || entry.status}
                        </p>
                        <p
                          className="text-[11px] text-text-muted"
                          title={formatDateTime(entry.changedAt)}
                        >
                          {formatRelative(entry.changedAt)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-text-muted">
                    No status history recorded.
                  </p>
                )}
              </div>
            </div>

            {/* Status update controls */}
            <Can permission="incident:update">
              {allowedTransitions.length > 0 && (
                <form
                  onSubmit={handleSubmit}
                  className="space-y-3 border-t border-border-subtle pt-5"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Update status
                  </p>

                  <FormField label="New status">
                    <Select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value)}
                      disabled={updating}
                    >
                      {allowedTransitions.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Root cause (optional)">
                    <Textarea
                      value={rootCause}
                      onChange={(e) => setRootCause(e.target.value)}
                      rows={2}
                      maxLength={2000}
                      placeholder="What caused this incident?"
                      disabled={updating}
                    />
                  </FormField>

                  {nextStatus === "resolved" && (
                    <FormField label="Resolution notes (optional)">
                      <Textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        rows={2}
                        maxLength={5000}
                        placeholder="How was this incident resolved?"
                        disabled={updating}
                      />
                    </FormField>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      loading={updating}
                      disabled={updating || !nextStatus}
                    >
                      Update status
                    </Button>
                  </div>
                </form>
              )}
            </Can>
          </>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} type="button">
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
