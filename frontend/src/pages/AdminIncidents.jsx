import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminIncidents } from "../hooks/useAdmin";
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
import { RefreshCw } from "lucide-react";

export default function AdminIncidents() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(severity ? { severity } : {}),
      ...(status ? { status } : {}),
    }),
    [page, search, severity, status],
  );
  const { data, loading, error, refetch } = useAdminIncidents(params);
  const incidents = data?.data || [];
  const rows = incidents.map((item) => ({
    ...item,
    monitorName: item.monitor?.name || "Unknown monitor",
    ownerName: item.owner?.name || item.user?.name || "Unknown",
    summary:
      item.title || item.message || item.description || "Service interruption",
    when: item.startedAt || item.createdAt,
  }));
  return (
    <Page
      title="Incident oversight"
      description="Review outages across customer monitors and follow resolution."
      eyebrow="ADMIN"
      actions={
        <Button variant="secondary" onClick={refetch}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <Panel
        title="All incidents"
        subtitle={`${data?.pagination?.total ?? incidents.length} records`}
      >
        <div className="filter-toolbar">
          <Input
            aria-label="Search incidents"
            placeholder="Search monitor, owner, or incident"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            aria-label="Severity"
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All severity</option>
            {["critical", "high", "medium", "low"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
          <Select
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All status</option>
            {["open", "investigating", "resolved"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </div>
        {error && <Notice tone="error">Could not load incidents.</Notice>}
        {loading ? (
          <div className="sw-loading">Loading incidents…</div>
        ) : (
          <Table
            columns={[
              { key: "monitorName", label: "Monitor" },
              { key: "summary", label: "Incident" },
              { key: "ownerName", label: "Owner" },
              {
                key: "severity",
                label: "Severity",
                render: (v) => <Status value={v} />,
              },
              {
                key: "status",
                label: "Status",
                render: (v) => <Status value={v} />,
              },
              {
                key: "when",
                label: "Started",
                render: (v) => (v ? new Date(v).toLocaleString() : "—"),
              },
              {
                key: "open",
                label: "",
                render: (_, row) => (
                  <Link
                    className="text-link"
                    to={`/admin/incidents/${row.id || row._id}`}
                  >
                    Review
                  </Link>
                ),
              },
            ]}
            rows={rows}
            empty="No incidents match these filters."
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
