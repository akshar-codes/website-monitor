import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAdminUser,
  useAdminUserPlan,
  useAdminMonitors,
  useUpdateUserPlan,
} from "../hooks/useAdmin";
import { ROLES } from "../constants/roles";
import { formatPlanName } from "../utils/formatPlanName";
import {
  Page,
  Panel,
  Button,
  Metric,
  Status,
  Table,
  Select,
} from "../components/ui/Primitives";
import { ArrowLeft, Users, CreditCard, Signal, RefreshCw } from "lucide-react";

export default function AdminUserDetails() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useAdminUser(id);
  const planQuery = useAdminUserPlan(id);
  const monitorsQuery = useAdminMonitors({ ownerId: id, page: 1, limit: 100 });
  const user = data?.user;
  const monitors = monitorsQuery.data?.data || [];

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [nextPlan, setNextPlan] = useState("");
  const [reason, setReason] = useState("");
  const { updatePlan, submitting: planSubmitting } = useUpdateUserPlan(() => {
    setPlanDialogOpen(false);
    refetch();
    planQuery.refetch();
  });

  const handleConfirmPlanChange = async ({ plan, reason }) => {
    await updatePlan(user.id, plan, user.name, { reason });
  };
  if (loading && !data)
    return (
      <Page
        title="Loading account…"
        description="Loading user and subscription details."
      />
    );
  if (error || !user)
    return (
      <Page
        title="Account unavailable"
        description="This customer could not be found."
        actions={<Link to="/admin/users">Back to users</Link>}
      />
    );
  const planInfo = planQuery.data?.plan || planQuery.data;
  const confirmPlan = () => {
    if (!nextPlan || !reason.trim()) return;
    handleConfirmPlanChange({ plan: nextPlan, reason: reason.trim() });
  };
  return (
    <Page
      eyebrow="ADMIN · CUSTOMER"
      title={user.name || "Customer account"}
      description={user.email}
      actions={
        <>
          <Link className="sw-button secondary" to="/admin/users">
            <ArrowLeft size={14} /> All users
          </Link>
          <Button
            onClick={() => {
              setNextPlan(user.plan || "free");
              setReason("");
              setPlanDialogOpen(true);
            }}
          >
            <CreditCard size={14} /> Change plan
          </Button>
        </>
      }
    >
      <div className="detail-owner-line">
        <Status value={user.active ? "active" : "suspended"} />
        <span>Role: {user.role}</span>
        <span>
          Joined{" "}
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
        </span>
      </div>
      <div className="sw-metric-grid">
        <Metric
          label="Current plan"
          value={formatPlanName(user.plan)}
          icon={CreditCard}
          note={
            planInfo?.expiresAt
              ? `Expires ${new Date(planInfo.expiresAt).toLocaleDateString()}`
              : "No expiration date"
          }
        />
        <Metric
          label="Monitors"
          value={user.monitorCount ?? monitors.length}
          icon={Signal}
          note={`${monitors.filter((m) => m.active).length} active`}
          tone="blue"
        />
        <Metric
          label="Account role"
          value={user.role === ROLES.ADMIN ? "Admin" : "User"}
          icon={Users}
          note={user.active ? "Access enabled" : "Access suspended"}
          tone="amber"
        />
        <Metric
          label="Email status"
          value={user.emailVerified ? "Verified" : "Unverified"}
          icon={Users}
          note={
            user.emailVerifiedAt
              ? new Date(user.emailVerifiedAt).toLocaleDateString()
              : ""
          }
        />
      </div>
      <div className="two-panel-grid">
        <Panel title="Account profile" subtitle="Customer identity and state">
          <dl className="detail-list">
            <dt>Name</dt>
            <dd>{user.name || "—"}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Role</dt>
            <dd>{user.role}</dd>
            <dt>Plan</dt>
            <dd>{formatPlanName(user.plan)}</dd>
            <dt>Account created</dt>
            <dd>
              {user.createdAt ? new Date(user.createdAt).toLocaleString() : "—"}
            </dd>
            <dt>Last active</dt>
            <dd>
              {user.lastLoginAt
                ? new Date(user.lastLoginAt).toLocaleString()
                : "—"}
            </dd>
          </dl>
        </Panel>
        <Panel
          title="Subscription details"
          subtitle="Plan usage and expiration"
        >
          {planQuery.loading ? (
            <div className="sw-loading">Loading plan…</div>
          ) : (
            <dl className="detail-list">
              <dt>Plan</dt>
              <dd>
                {planInfo?.definition?.name ||
                  formatPlanName(planInfo?.id || user.plan)}
              </dd>
              <dt>Monitor limit</dt>
              <dd>{planInfo?.limits?.monitors ?? "—"}</dd>
              <dt>Data retention</dt>
              <dd>{planInfo?.limits?.dataRetentionDays ?? "—"} days</dd>
              <dt>Plan expires</dt>
              <dd>
                {planInfo?.expiresAt
                  ? new Date(planInfo.expiresAt).toLocaleString()
                  : "Never"}
              </dd>
            </dl>
          )}
        </Panel>
      </div>
      <Panel
        title="Customer monitors"
        subtitle={`${monitors.length} monitor records`}
        actions={
          <Button variant="secondary" onClick={() => monitorsQuery.refetch()}>
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      >
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
              key: "status",
              label: "Status",
              render: (v, row) => (
                <Status value={v || (row.active ? "unknown" : "paused")} />
              ),
            },
            {
              key: "interval",
              label: "Interval",
              render: (v) => (v ? `${v}s` : "—"),
            },
            {
              key: "id",
              label: "",
              render: (v, row) => (
                <Link
                  className="text-link"
                  to={`/admin/monitors/${v || row._id}`}
                >
                  Details
                </Link>
              ),
            },
          ]}
          rows={monitors}
        />
      </Panel>
      {planDialogOpen && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>Change customer plan</h2>
            <div className="sw-form">
              <Select
                label="New plan"
                value={nextPlan}
                onChange={(e) => setNextPlan(e.target.value)}
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="unlimited">Enterprise</option>
              </Select>
              <label className="sw-field">
                Audit reason
                <textarea
                  rows="3"
                  placeholder="Explain why this user's plan is being changed (required for audit logs)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <Button
                  variant="secondary"
                  onClick={() => setPlanDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={planSubmitting || !reason.trim()}
                  onClick={confirmPlan}
                >
                  {planSubmitting ? "Updating…" : "Update plan"}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
