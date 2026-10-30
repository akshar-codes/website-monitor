import { useAdminPlanHistory } from "../hooks/useAdmin";
import {
  Page,
  Panel,
  Button,
  Table,
  Status,
} from "../components/ui/Primitives";
import { RefreshCw } from "lucide-react";

export default function AdminPlanHistory() {
  const { data, loading, error: _error, refetch } = useAdminPlanHistory();
  const events = Array.isArray(data) ? data : [];

  return (
    <Page
      title="Plan history"
      description="Review plan changes made across customer accounts."
      eyebrow="ADMIN"
      actions={
        <Button variant="secondary" onClick={refetch}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <Panel
        title="Plan change events"
        subtitle={`${events.length} events recorded`}
      >
        {loading ? (
          <div className="sw-loading">Loading plan history…</div>
        ) : (
          <Table
            columns={[
              {
                key: "user",
                label: "Account",
                render: (v, row) => v?.name || row.userName || v?.email || "—",
              },
              {
                key: "previousPlan",
                label: "Previous plan",
                render: (v, row) => v || row.from || row.fromPlan || "—",
              },
              {
                key: "newPlan",
                label: "New plan",
                render: (v, row) =>
                  v || row.to || row.toPlan || row.plan || "—",
              },
              {
                key: "actor",
                label: "Changed by",
                render: (v) => v?.name || v?.email || "System",
              },
              { key: "reason", label: "Reason" },
              {
                key: "createdAt",
                label: "Date",
                render: (v) => (v ? new Date(v).toLocaleString() : "—"),
              },
              {
                key: "status",
                label: "Status",
                render: (v) => <Status value={v || "completed"} />,
              },
            ]}
            rows={events}
            empty="No plan changes have been recorded."
          />
        )}
      </Panel>
    </Page>
  );
}
