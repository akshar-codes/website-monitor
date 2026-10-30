import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminMonitors } from "../hooks/useAdmin";
import {
  Page,
  Panel,
  Button,
  Input,
  Status,
  Table,
  Notice,
} from "../components/ui/Primitives";
import { RefreshCw, ExternalLink } from "lucide-react";

export default function AdminMonitors() {
  const [search, setSearch] = useState("");
  const params = useMemo(
    () => ({ page: 1, limit: 100, ...(search ? { search } : {}) }),
    [search],
  );
  const { data, loading, error, refetch } = useAdminMonitors(params);
  const monitors = data?.data || [];

  const rows = monitors.map((m) => ({
    ...m,
    ownerName: m.owner?.name || m.user?.name || "—",
    ownerEmail: m.owner?.email || m.user?.email || "",
    displayStatus: m.status || (m.active ? "active" : "paused"),
  }));
  return (
    <Page
      title="Monitor oversight"
      description="Inspect health checks across all customer accounts."
      eyebrow="ADMIN"
      actions={
        <Button variant="secondary" onClick={refetch}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <Panel
        title="Platform monitors"
        subtitle={`${data?.pagination?.total ?? monitors.length} monitors in this view`}
        actions={
          <Input
            aria-label="Search monitors"
            placeholder="Search name or URL"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
      >
        {error && <Notice tone="error">Could not load monitors.</Notice>}
        {loading ? (
          <div className="sw-loading">Loading monitors…</div>
        ) : (
          <Table
            columns={[
              {
                key: "name",
                label: "Monitor",
                render: (v, row) => (
                  <>
                    <b>{v}</b>
                    <small className="table-secondary">{row.url}</small>
                  </>
                ),
              },
              {
                key: "ownerName",
                label: "Owner",
                render: (v, row) => (
                  <>
                    {v}
                    <small className="table-secondary">{row.ownerEmail}</small>
                  </>
                ),
              },
              {
                key: "displayStatus",
                label: "Status",
                render: (v) => <Status value={v} />,
              },
              {
                key: "responseTime",
                label: "Response",
                render: (v) => (v == null ? "—" : `${v} ms`),
              },
              {
                key: "lastCheckedAt",
                label: "Last check",
                render: (v) => (v ? new Date(v).toLocaleString() : "—"),
              },
              {
                key: "open",
                label: "",
                render: (_, row) => (
                  <Link
                    className="text-link"
                    to={`/admin/monitors/${row.id || row._id}`}
                  >
                    <ExternalLink size={14} /> Details
                  </Link>
                ),
              },
            ]}
            rows={rows}
            empty="No platform monitors match your search."
          />
        )}
      </Panel>
    </Page>
  );
}
