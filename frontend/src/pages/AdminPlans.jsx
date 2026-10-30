import { useMemo, useState } from "react";
import {
  useAdminPlanOverview,
  useUserList,
  useUpdateUserPlan,
} from "../hooks/useAdmin";
import {
  Page,
  Panel,
  Button,
  Select,
  Table,
  Metric,
  Notice,
  Status,
} from "../components/ui/Primitives";
import { CreditCard, RefreshCw, Users } from "lucide-react";
import { formatPlanPrice } from "../utils/formatPlanPrice";
import { formatPlanLimit } from "../utils/formatPlanLimit";
import AdminBillingSettings from "../components/admin/AdminBillingSettings";

export default function AdminPlans() {
  const [page, _setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [nextPlan, setNextPlan] = useState("");
  const [reason, setReason] = useState("");
  const {
    data: plans,
    loading: _plansLoading,
    error: plansError,
    refetch: refetchPlans,
  } = useAdminPlanOverview();
  const {
    data: usersData,
    loading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useUserList({ page, limit: 20 });
  const refresh = () => {
    refetchPlans();
    refetchUsers();
  };
  const { updatePlan, submitting } = useUpdateUserPlan(() => {
    setSelected(null);
    refresh();
  });
  const users = useMemo(() => usersData?.data || [], [usersData]);
  const applyPlan = () => {
    if (!selected || !nextPlan || !reason.trim()) return;
    updatePlan(selected.id || selected._id, nextPlan, selected.name, {
      reason: reason.trim(),
    });
  };
  return (
    <Page
      title="Plan management"
      description="Monitor plan adoption and manage customer subscriptions."
      eyebrow="ADMIN"
      actions={
        <Button variant="secondary" onClick={refresh}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      <div className="sw-metric-grid">
        <Metric
          label="Available plans"
          value={plans?.length ?? 0}
          icon={CreditCard}
          note="Catalog tiers"
        />
        <Metric
          label="Accounts"
          value={plans?.reduce((sum, p) => sum + (p.users || 0), 0) ?? "—"}
          icon={Users}
          note="Across all plans"
        />
        <Metric
          label="Paid accounts"
          value={
            plans
              ?.filter((p) => p.id !== "free")
              .reduce((sum, p) => sum + (p.users || 0), 0) ?? "—"
          }
          icon={CreditCard}
          tone="blue"
          note="Non-free tiers"
        />
        <Metric
          label="Current page"
          value={users.length}
          icon={Users}
          tone="amber"
          note="Customer accounts"
        />
      </div>
      <AdminBillingSettings onSaved={refetchPlans} />
      {plansError && <Notice tone="error">Could not load plan catalog.</Notice>}
      <div className="plan-grid">
        {(plans || []).map((plan) => (
          <article className="plan-card" key={plan.id}>
            <span className="plan-icon">
              <CreditCard size={18} />
            </span>
            <h2>{plan.name || plan.id}</h2>
            <p>{plan.description || "Subscription plan"}</p>
            <div className="plan-price">
              {formatPlanPrice(plan.price)}
              <small>/ month</small>
            </div>
            <div className="plan-users">
              <b>{plan.users || 0}</b>
              <span>accounts</span>
              <b>{plan.activeUsers || 0}</b>
              <span>active</span>
            </div>
            <ul>
              {Object.entries(plan.limits || {})
                .slice(0, 5)
                .map(([key, value]) => (
                  <li key={key}>
                    <span>{key.replace(/([A-Z])/g, " $1")}</span>
                    <b>{formatPlanLimit(value)}</b>
                  </li>
                ))}
            </ul>
          </article>
        ))}
      </div>
      <Panel
        title="Customer plan assignments"
        subtitle="Change a customer plan with an audit reason"
      >
        {usersError && (
          <Notice tone="error">Could not load customer accounts.</Notice>
        )}
        {usersLoading ? (
          <div className="sw-loading">Loading accounts…</div>
        ) : (
          <Table
            columns={[
              {
                key: "name",
                label: "Customer",
                render: (v, row) => (
                  <>
                    <b>{v}</b>
                    <small className="table-secondary">{row.email}</small>
                  </>
                ),
              },
              { key: "plan", label: "Plan" },
              {
                key: "active",
                label: "Account",
                render: (v) => <Status value={v ? "active" : "suspended"} />,
              },
              {
                key: "actions",
                label: "",
                render: (_, row) => (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelected(row);
                      setNextPlan(row.plan || "");
                      setReason("");
                    }}
                  >
                    Change plan
                  </Button>
                ),
              },
            ]}
            rows={users}
            empty="No customer accounts found."
          />
        )}
      </Panel>
      {selected && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>Change {selected.name}’s plan</h2>
            <div className="sw-form">
              <Select
                label="New plan"
                value={nextPlan}
                onChange={(e) => setNextPlan(e.target.value)}
              >
                {(plans || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <label className="sw-field">
                Reason
                <textarea
                  rows="3"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Required audit reason"
                />
              </label>
              <div className="modal-actions">
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={submitting || !reason.trim()}
                  onClick={applyPlan}
                >
                  {submitting ? "Updating…" : "Apply plan"}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
