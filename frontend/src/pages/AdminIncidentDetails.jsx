import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAdminIncident, useResolveAdminIncident } from "../hooks/useAdmin";
import {
  Page,
  Panel,
  Button,
  Status,
  Notice,
} from "../components/ui/Primitives";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function AdminIncidentDetails() {
  const { id } = useParams();
  const [confirm, setConfirm] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [rootCause, setRootCause] = useState("");
  const { data, loading, error, refetch } = useAdminIncident(id);
  const onDone = () => {
    setConfirm(false);
    refetch();
  };
  const { resolve, submitting } = useResolveAdminIncident(onDone);
  const incident = data?.incident || data;
  if (loading && !data)
    return (
      <Page
        title="Loading incident…"
        description="Loading incident and monitor context."
      />
    );
  if (error || !incident)
    return (
      <Page
        title="Incident unavailable"
        description="The incident could not be found."
        actions={<Link to="/admin/incidents">Back to incidents</Link>}
      />
    );
  return (
    <Page
      eyebrow="ADMIN · INCIDENT"
      title={incident.title || incident.message || "Incident details"}
      description={
        incident.monitor?.name || incident.monitorName || "Monitor incident"
      }
      actions={
        <Link className="sw-button secondary" to="/admin/incidents">
          <ArrowLeft size={14} /> All incidents
        </Link>
      }
    >
      <div className="detail-owner-line">
        <Status value={incident.status} />
        <Status value={incident.severity} />
        <span>
          Started{" "}
          {incident.startedAt
            ? new Date(incident.startedAt).toLocaleString()
            : "—"}
        </span>
      </div>
      <div className="two-panel-grid">
        <Panel title="Incident context">
          <dl className="detail-list">
            <dt>Monitor</dt>
            <dd>{incident.monitor?.name || incident.monitorName || "—"}</dd>
            <dt>URL</dt>
            <dd>{incident.monitor?.url || "—"}</dd>
            <dt>Owner</dt>
            <dd>{incident.owner?.name || incident.user?.email || "—"}</dd>
            <dt>Started</dt>
            <dd>
              {incident.startedAt
                ? new Date(incident.startedAt).toLocaleString()
                : "—"}
            </dd>
            <dt>Resolved</dt>
            <dd>
              {incident.resolvedAt
                ? new Date(incident.resolvedAt).toLocaleString()
                : "—"}
            </dd>
          </dl>
        </Panel>
        <Panel
          title="Resolution details"
          subtitle={
            incident.status === "resolved"
              ? "Incident has been resolved"
              : "Add root cause and resolution notes"
          }
        >
          {incident.status === "resolved" ? (
            <Notice tone="success">
              {incident.resolutionNotes ||
                "This incident has been marked resolved."}
            </Notice>
          ) : (
            <>
              <label className="sw-field">
                Root cause
                <textarea
                  rows="3"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="Describe the likely cause"
                />
              </label>
              <label className="sw-field resolution-field">
                Resolution notes
                <textarea
                  rows="4"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="What was done to restore service?"
                />
              </label>
              <Button
                onClick={() => setConfirm(true)}
                disabled={!rootCause.trim() || !resolutionNotes.trim()}
              >
                <CheckCircle2 size={14} /> Resolve incident
              </Button>
            </>
          )}
        </Panel>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>Resolve this incident?</h2>
            <p className="muted-copy">
              The resolution and root cause will be recorded in the audit trail.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                disabled={submitting}
                onClick={() => resolve(id, { resolutionNotes, rootCause })}
              >
                {submitting ? "Saving…" : "Confirm resolution"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
