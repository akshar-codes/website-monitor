import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuditEvents } from "../hooks/useAdmin";
import {
  Page,
  Panel,
  Button,
  Input,
  Select,
  Status,
  Table,
  Notice,
} from "../components/ui/Primitives";
import { RefreshCw, ExternalLink } from "lucide-react";

const resourceUrl = (target) => {
  if (!target?.id) return null;
  if (target.type === "User") return `/admin/users/${target.id}`;
  if (target.type === "Monitor") return `/admin/monitors/${target.id}`;
  if (target.type === "Incident") return `/admin/incidents/${target.id}`;
  if (target.type === "PlanUpgradeRequest") return `/admin/plan-requests`;
  return null;
};
const eventLabel = (event) => event.eventType.replaceAll("_", " ");

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [actorId, setActorId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const params = useMemo(
    () => ({
      page,
      limit: 25,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(category ? { category } : {}),
      ...(outcome ? { outcome } : {}),
      ...(actorId.trim() ? { actorId: actorId.trim() } : {}),
      ...(targetId.trim() ? { targetId: targetId.trim() } : {}),
      ...(startDate && endDate
        ? {
            startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
            endDate: new Date(`${endDate}T23:59:59.999Z`).toISOString(),
          }
        : {}),
    }),
    [page, search, category, outcome, actorId, targetId, startDate, endDate],
  );
  const { data, loading, error, refetch } = useAdminAuditEvents(params);
  const events = data?.data || [];
  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
  };
  const rows = events.map((event) => ({
    ...event,
    label: eventLabel(event),
    actorLabel:
      event.actor?.name || event.actor?.email || event.actorEmail || "System",
    targetLabel:
      event.target?.name || event.target?.email || event.target?.type || "—",
    when: event.createdAt || event.timestamp,
    details: event.metadata ? JSON.stringify(event.metadata) : "—",
  }));
  return (
    <Page
      title="Audit logs"
      description="Search the immutable record of administrative and security events."
      eyebrow="ADMIN · SECURITY"
      actions={
        <Button variant="secondary" onClick={refetch}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <Panel
        title="Audit events"
        subtitle={`${data?.pagination?.total ?? events.length} events`}
      >
        <div className="audit-filter-grid">
          <Input
            aria-label="Search audit logs"
            placeholder="Search event, actor, or target"
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
          />
          <Select
            aria-label="Category"
            value={category}
            onChange={(e) => resetPage(setCategory)(e.target.value)}
          >
            <option value="">All categories</option>
            {["auth", "user", "monitor", "incident", "plan", "security"].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </Select>
          <Select
            aria-label="Outcome"
            value={outcome}
            onChange={(e) => resetPage(setOutcome)(e.target.value)}
          >
            <option value="">All outcomes</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </Select>
          <Input
            aria-label="Actor ID"
            placeholder="Actor ID"
            value={actorId}
            onChange={(e) => resetPage(setActorId)(e.target.value)}
          />
          <Input
            aria-label="Target ID"
            placeholder="Target ID"
            value={targetId}
            onChange={(e) => resetPage(setTargetId)(e.target.value)}
          />
          <Input
            aria-label="From date"
            type="date"
            value={startDate}
            onChange={(e) => resetPage(setStartDate)(e.target.value)}
          />
          <Input
            aria-label="To date"
            type="date"
            value={endDate}
            onChange={(e) => resetPage(setEndDate)(e.target.value)}
          />
        </div>
        {error && <Notice tone="error">Could not load audit events.</Notice>}
        {loading ? (
          <div className="sw-loading">Loading audit trail…</div>
        ) : (
          <Table
            columns={[
              {
                key: "when",
                label: "Time",
                render: (v) => (v ? new Date(v).toLocaleString() : "—"),
              },
              { key: "label", label: "Event" },
              { key: "category", label: "Category" },
              { key: "actorLabel", label: "Actor" },
              { key: "targetLabel", label: "Target" },
              {
                key: "outcome",
                label: "Outcome",
                render: (v) => <Status value={v || "success"} />,
              },
              {
                key: "resource",
                label: "",
                render: (_, row) => {
                  const url = resourceUrl(row.target);
                  return url ? (
                    <Link className="text-link" to={url}>
                      <ExternalLink size={13} /> Open
                    </Link>
                  ) : null;
                },
              },
            ]}
            rows={rows}
            empty="No audit events match these filters."
          />
        )}
        {data?.pagination && (
          <div className="pagination-bar">
            <span>
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <div>
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </Page>
  );
}
