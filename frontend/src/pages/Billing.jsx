import { useState, useCallback } from "react";
import {
  useCurrentPlan,
  usePlanCatalog,
  usePlanChange,
} from "../hooks/usePlans";
import {
  useMyPlanUpgradeRequest,
  useRequestPlanUpgrade,
} from "../hooks/usePlanUpgradeRequests";
import { useUsage } from "../hooks/useUsage";
import { useAuth } from "../hooks/useAuth";
import { getPlanChangeType } from "../utils/planCompare";
import { formatPlanPrice } from "../utils/formatPlanPrice";
import { formatPlanName } from "../utils/formatPlanName";
import { formatPlanLimit } from "../utils/formatPlanLimit";
import { Page, Panel, Button, Notice } from "../components/ui/Primitives";
import { Check, CreditCard, RefreshCw, Sparkles } from "lucide-react";

const EMPTY_PLANS = Object.freeze([]);

/**
 * There is no payment gateway wired up yet, so plan changes split into two
 * flows here:
 *   - Downgrades apply immediately via POST /api/plans/change (no revenue
 *     concern — see usePlans.js#usePlanChange).
 *   - Upgrades submit a PlanUpgradeRequest for admin review instead of
 *     changing the plan directly (see hooks/usePlanUpgradeRequests.js).
 *     Only one pending request is allowed at a time; while one exists,
 *     every plan-change action is disabled and a banner explains why.
 */
export default function Billing() {
  const { refetchUser } = useAuth();
  const [actionPlanId, setActionPlanId] = useState(null);
  const [pendingDowngrade, setPendingDowngrade] = useState(null);
  const [pendingUpgrade, setPendingUpgrade] = useState(null);

  const {
    data: currentPlanData,
    loading: currentPlanLoading,
    refetch: refetchCurrentPlan,
  } = useCurrentPlan();
  const { data: catalogData, loading: catalogLoading } = usePlanCatalog();
  const {
    data: usageData,
    loading: _usageLoading,
    refetch: refetchUsage,
  } = useUsage();
  const {
    data: upgradeRequestData,
    loading: _upgradeRequestLoading,
    refetch: refetchUpgradeRequest,
  } = useMyPlanUpgradeRequest();

  const currentPlan = currentPlanData?.data;
  const plans = catalogData?.data || EMPTY_PLANS;
  const usage = usageData?.data;
  const pendingRequest = upgradeRequestData?.data?.pending || null;
  const requestHistory = upgradeRequestData?.data?.history || [];

  const handleDowngradeSuccess = async () => {
    setActionPlanId(null);
    await Promise.all([refetchCurrentPlan(), refetchUser(), refetchUsage()]);
  };

  const handleUpgradeRequestSuccess = async () => {
    setActionPlanId(null);
    setPendingUpgrade(null);
    await refetchUpgradeRequest();
  };

  const { changePlan } = usePlanChange(handleDowngradeSuccess);
  const { requestUpgrade } = useRequestPlanUpgrade(handleUpgradeRequestSuccess);

  const handleSelectPlan = useCallback(
    async (planId) => {
      const targetPlan = plans.find((p) => p.id === planId);
      const changeType = getPlanChangeType(
        currentPlan?.plan,
        targetPlan,
        plans,
      );

      if (changeType === "downgrade") {
        setPendingDowngrade(planId);
        return;
      }

      if (changeType === "upgrade") {
        setPendingUpgrade(planId);
        return;
      }

      setActionPlanId(planId);

      const result =
        changeType === "upgrade"
          ? await requestUpgrade(planId)
          : await changePlan(planId);

      if (!result) {
        setActionPlanId(null);
      }
    },
    [plans, currentPlan, requestUpgrade, changePlan],
  );

  const handleConfirmUpgrade = async () => {
    if (!pendingUpgrade) return;
    setActionPlanId(pendingUpgrade);
    const result = await requestUpgrade(pendingUpgrade);
    if (!result) setActionPlanId(null);
    setPendingUpgrade(null);
  };

  const handleConfirmDowngrade = async () => {
    if (!pendingDowngrade) return;
    setActionPlanId(pendingDowngrade);
    const result = await changePlan(pendingDowngrade);
    if (!result) {
      setActionPlanId(null);
    }
    setPendingDowngrade(null);
  };

  const handleRefresh = () => {
    refetchCurrentPlan();
    refetchUsage();
    refetchUpgradeRequest();
  };

  const pendingPlanName =
    pendingRequest &&
    (plans.find((p) => p.id === pendingRequest.requestedPlan)?.name ||
      pendingRequest.requestedPlan);

  return (
    <Page
      title="Plans & billing"
      description="Choose the monitoring capacity and tools your team needs."
      eyebrow="SUBSCRIPTION"
      actions={
        <Button variant="secondary" onClick={handleRefresh}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      {pendingRequest && (
        <Notice tone="warning">
          Your request to move to {pendingPlanName} is waiting for administrator
          review.
        </Notice>
      )}
      <div className="sw-metric-grid">
        <div className="sw-metric">
          <span className="sw-metric-icon">
            <CreditCard size={17} />
          </span>
          <span className="sw-metric-label">Current plan</span>
          <strong className="plan-metric">
            {formatPlanName(
              currentPlan?.definition?.name ||
                currentPlan?.planName ||
                currentPlan?.plan,
            )}
          </strong>
          <small>{currentPlan?.status || "Active"}</small>
        </div>
        <div className="sw-metric">
          <span className="sw-metric-icon blue">
            <RefreshCw size={17} />
          </span>
          <span className="sw-metric-label">Monitors used</span>
          <strong>{usage?.monitors?.used ?? "—"}</strong>
          <small>{usage?.monitors?.limit ?? "Unlimited"} limit</small>
        </div>
        <div className="sw-metric">
          <span className="sw-metric-icon">
            <Sparkles size={17} />
          </span>
          <span className="sw-metric-label">Data retention</span>
          <strong>{usage?.retention?.days ?? "—"} days</strong>
          <small>Historical metrics</small>
        </div>
        <div className="sw-metric">
          <span className="sw-metric-icon amber">
            <CreditCard size={17} />
          </span>
          <span className="sw-metric-label">Upgrade status</span>
          <strong className="plan-metric">
            {pendingRequest ? "In review" : "No pending request"}
          </strong>
          <small>{requestHistory.length} prior requests</small>
        </div>
      </div>
      <div className="plan-grid">
        {catalogLoading || currentPlanLoading ? (
          <div className="sw-loading">Loading plans…</div>
        ) : (
          plans.map((plan) => {
            const id = plan.id || plan._id;
            const current =
              currentPlan?.plan === id || currentPlan?.planId === id;
            const pending = pendingRequest?.requestedPlan === id;
            return (
              <article
                className={`plan-card ${current ? "current" : ""}`}
                key={id}
              >
                <span className="plan-icon">
                  <CreditCard size={18} />
                </span>
                <h2>{plan.name || id}</h2>
                <p>
                  {plan.description ||
                    "Flexible website monitoring for your team."}
                </p>
                <div className="plan-price">
                  {formatPlanPrice(plan.price)}
                  <small>
                    {plan.billingPeriod ? `/${plan.billingPeriod}` : "/ month"}
                  </small>
                </div>
                <ul>
                  {Object.entries(plan.limits || {})
                    .slice(0, 6)
                    .map(([key, value]) => (
                      <li key={key}>
                        <Check size={14} />
                        <span>
                          {formatPlanLimit(value)}{" "}
                          {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                        </span>
                      </li>
                    ))}
                </ul>
                <Button
                  variant={current ? "secondary" : "primary"}
                  disabled={current || !!pendingRequest || actionPlanId === id}
                  onClick={() => handleSelectPlan(id)}
                >
                  {current
                    ? "Current plan"
                    : pending
                      ? "Request pending"
                      : actionPlanId === id
                        ? "Updating…"
                        : "Choose plan"}
                </Button>
              </article>
            );
          })
        )}
      </div>
      <Panel
        title="Plan request history"
        subtitle="Upgrade requests and review outcomes"
      >
        <div className="sw-table-wrap">
          <table className="sw-table">
            <thead>
              <tr>
                <th>Requested plan</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {requestHistory.map((r, i) => (
                <tr key={r.id || r._id || i}>
                  <td>
                    {plans.find((p) => p.id === r.requestedPlan)?.name ||
                      r.requestedPlan}
                  </td>
                  <td>
                    {r.createdAt
                      ? new Date(r.createdAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>{r.status}</td>
                  <td>
                    {r.reviewedAt
                      ? new Date(r.reviewedAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!requestHistory.length && (
          <div className="sw-empty">
            <b>No plan requests yet</b>
            <p>Upgrade requests and decisions will appear here.</p>
          </div>
        )}
      </Panel>
      {(pendingUpgrade || pendingDowngrade) && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>
              {pendingUpgrade
                ? "Request a plan upgrade?"
                : "Change to a lower plan?"}
            </h2>
            <p className="muted-copy">
              {pendingUpgrade
                ? "An administrator will review the request. Your current plan stays active until it is approved."
                : "Some features or monitor slots may no longer be available after the change."}
            </p>
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setPendingUpgrade(null);
                  setPendingDowngrade(null);
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!!actionPlanId}
                onClick={
                  pendingUpgrade ? handleConfirmUpgrade : handleConfirmDowngrade
                }
              >
                {actionPlanId ? "Submitting…" : "Confirm"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
