import { useState, useCallback, useEffect } from "react";
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
import {
  getBillingMode,
  createPlanOrder,
  verifyPlanPayment,
} from "../services/api/plans";
import { Page, Panel, Button, Notice } from "../components/ui/Primitives";
import { Check, CreditCard, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

const EMPTY_PLANS = Object.freeze([]);
let checkoutScriptPromise;
function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  if (!checkoutScriptPromise)
    checkoutScriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => {
        checkoutScriptPromise = null;
        resolve(false);
      };
      document.body.appendChild(script);
    });
  return checkoutScriptPromise;
}

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
  const [billingMode, setBillingMode] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState("monthly");

  useEffect(() => {
    let active = true;
    getBillingMode()
      .then((response) => active && setBillingMode(response?.data || null))
      .catch(
        () =>
          active && setBillingMode({ mode: "request", paymentReady: false }),
      );
    return () => {
      active = false;
    };
  }, []);

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

  const startDirectPayment = useCallback(
    async (planId, requestId, periodOverride) => {
      setActionPlanId(planId);
      try {
        if (!(await loadRazorpayCheckout()))
          throw new Error(
            "Razorpay checkout could not be loaded. Check your connection and try again.",
          );
        const checkoutPeriod = periodOverride || billingPeriod;
        const response = await createPlanOrder(
          planId,
          checkoutPeriod,
          requestId,
        );
        const order = response?.data;
        if (!order) throw new Error("Could not create a payment order.");
        const checkout = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "SiteWatch",
          description: `${order.plan} plan · ${order.period}${order.discountPercent ? ` · ${order.discountPercent}% discount` : ""}`,
          order_id: order.orderId,
          prefill: order.customer,
          theme: { color: "#079b74" },
          handler: async (result) => {
            try {
              const verified = await verifyPlanPayment({
                orderId: result.razorpay_order_id || order.orderId,
                paymentId: result.razorpay_payment_id,
                signature: result.razorpay_signature,
              });
              toast.success(
                verified?.message ||
                  "Payment verified and your plan is active.",
              );
              await Promise.all([
                refetchCurrentPlan(),
                refetchUser(),
                refetchUsage(),
                refetchUpgradeRequest(),
              ]);
            } catch {
              /* API interceptor displays verification errors. */
            } finally {
              setActionPlanId(null);
            }
          },
          modal: { ondismiss: () => setActionPlanId(null) },
        });
        checkout.on("payment.failed", (event) => {
          toast.error(
            event?.error?.description || "Payment could not be completed.",
          );
          setActionPlanId(null);
        });
        checkout.open();
      } catch (error) {
        setActionPlanId(null);
        if (!error?.response)
          toast.error(error.message || "Could not start checkout.");
      }
    },
    [
      billingPeriod,
      refetchCurrentPlan,
      refetchUser,
      refetchUsage,
      refetchUpgradeRequest,
    ],
  );

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
        if (billingMode?.mode === "payment") {
          await startDirectPayment(planId);
          return;
        }
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
    [
      plans,
      currentPlan,
      requestUpgrade,
      changePlan,
      billingMode,
      startDirectPayment,
    ],
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
      {billingMode?.mode === "payment" && !billingMode.paymentReady && (
        <Notice tone="warning">
          Direct checkout is selected, but payments are not configured. Please
          contact support.
        </Notice>
      )}
      {billingMode?.mode !== "payment" &&
        pendingRequest?.status === "pending" && (
          <Notice tone="warning">
            Your request to move to {pendingPlanName} is waiting for
            administrator review.
          </Notice>
        )}
      {pendingRequest?.status === "payment_pending" && (
        <Notice tone="info">
          Your{" "}
          {plans.find((p) => p.id === pendingRequest.paymentOffer?.plan)
            ?.name || pendingRequest.paymentOffer?.plan}{" "}
          offer is ready
          {pendingRequest.paymentOffer?.discountPercent
            ? ` with ${pendingRequest.paymentOffer.discountPercent}% off`
            : ""}
          . Complete checkout to activate it.
          <Button
            disabled={!billingMode?.paymentReady || !!actionPlanId}
            onClick={() =>
              startDirectPayment(
                pendingRequest.paymentOffer.plan,
                pendingRequest.id || pendingRequest._id,
                pendingRequest.paymentOffer.period,
              )
            }
          >
            {actionPlanId ? "Opening checkout…" : "Pay for plan"}
          </Button>
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
            {pendingRequest?.status === "payment_pending"
              ? "Payment required"
              : pendingRequest
                ? "In review"
                : "No pending request"}
          </strong>
          <small>{requestHistory.length} prior requests</small>
        </div>
      </div>
      {billingMode?.mode === "payment" && (
        <div className="billing-period-choice">
          <div
            className="billing-period-toggle"
            role="group"
            aria-label="Billing period"
          >
            <button
              className={billingPeriod === "monthly" ? "active" : ""}
              onClick={() => setBillingPeriod("monthly")}
            >
              Monthly
            </button>
            <button
              className={billingPeriod === "yearly" ? "active" : ""}
              onClick={() => setBillingPeriod("yearly")}
            >
              Yearly
            </button>
          </div>
          <small>
            Paid once for the selected period. Plans do not renew automatically.
          </small>
        </div>
      )}
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
                  {formatPlanPrice(plan.price, billingPeriod)}
                  <small>
                    {`/ ${billingPeriod === "yearly" ? "year" : "month"}`}
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
                  disabled={
                    current ||
                    !!pendingRequest ||
                    (billingMode?.mode === "payment" &&
                      !billingMode.paymentReady) ||
                    !billingMode ||
                    actionPlanId === id
                  }
                  onClick={() => handleSelectPlan(id)}
                >
                  {current
                    ? "Current plan"
                    : pending && billingMode?.mode !== "payment"
                      ? "Request pending"
                      : actionPlanId === id
                        ? billingMode?.mode === "payment"
                          ? "Opening checkout…"
                          : "Updating…"
                        : billingMode?.mode === "payment"
                          ? "Upgrade & pay"
                          : "Choose plan"}
                </Button>
              </article>
            );
          })
        )}
      </div>
      {billingMode?.mode !== "payment" && (
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
      )}
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
