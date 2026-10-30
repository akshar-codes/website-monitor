import { useState, useMemo, useEffect } from "react";
import {
  usePlanUpgradeRequestList,
  useApprovePlanUpgradeRequest,
  useRejectPlanUpgradeRequest,
} from "../hooks/useAdmin";
import {
  Page,
  Panel,
  Button,
  Status,
  Notice,
} from "../components/ui/Primitives";
import { Check, X, RefreshCw } from "lucide-react";
import { getBillingMode } from "../services/api/plans";
import { usePlanCatalog } from "../hooks/usePlans";
import { formatPlanName } from "../utils/formatPlanName";

const STATUS_FILTERS = [
  { label: "Pending", value: "pending" },
  { label: "Awaiting payment", value: "payment_pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "all" },
];

const COLUMN_HEADERS = [
  "User",
  "Current plan",
  "Requested plan",
  "Submitted",
  "Status",
  "",
];

const getRequestId = (request) => request?.id || request?._id;

export default function AdminPlanRequests() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [billingSettings, setBillingSettings] = useState(null);
  const [billingSettingsLoaded, setBillingSettingsLoaded] = useState(false);
  const paymentMode = billingSettings?.mode === "payment";
  useEffect(() => {
    let active = true;
    getBillingMode()
      .then((response) => {
        if (!active) return;
        setBillingSettings(response?.data || null);
        setBillingSettingsLoaded(true);
      })
      .catch(() => active && setBillingSettingsLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  // Both "pending" actions route through a confirmation step before the
  // mutation fires, mirroring the pattern used throughout AdminUsers.jsx.
  const [pendingApprove, setPendingApprove] = useState(null); // request
  const [pendingReject, setPendingReject] = useState(null); // request
  const [grantedPlan, setGrantedPlan] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [approvalReason, setApprovalReason] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewDecision, setReviewDecision] = useState("grant");
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [discountPercent, setDiscountPercent] = useState(0);
  const { data: planCatalog } = usePlanCatalog();
  const availablePlans = planCatalog?.data || [];

  const listParams = useMemo(() => {
    const params = { page, limit: 20 };
    if (statusFilter !== "all") params.status = statusFilter;
    return params;
  }, [page, statusFilter]);

  const { data, loading, error, refetch } =
    usePlanUpgradeRequestList(listParams);
  const requests = data?.data || [];
  const pagination = data?.pagination;

  const handleMutationSuccess = () => {
    setPendingApprove(null);
    setPendingReject(null);
    refetch();
  };

  const { approve, submittingId: approvingId } = useApprovePlanUpgradeRequest(
    handleMutationSuccess,
  );
  const { reject, submittingId: rejectingId } = useRejectPlanUpgradeRequest(
    handleMutationSuccess,
  );

  const changeStatusFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleConfirmApprove = (options) => {
    if (!pendingApprove) return;
    approve(getRequestId(pendingApprove), options);
  };

  const handleConfirmReject = (reason) => {
    if (!pendingReject) return;
    reject(getRequestId(pendingReject), reason);
  };

  const openApproval = (request) => {
    setPendingApprove(request);
    setGrantedPlan(request.requestedPlan);
    setExpiresAt("");
    setApprovalReason("");
    setReviewDecision(paymentMode ? "payment" : "grant");
    setBillingPeriod("monthly");
    setDiscountPercent(0);
  };

  const openRejection = (request) => {
    setPendingReject(request);
    setRejectionReason("");
  };

  return (
    <Page
      title="Upgrade requests"
      description="Review customer requests for access to higher plan tiers."
      eyebrow="ADMIN · BILLING"
      actions={
        <Button variant="secondary" onClick={refetch}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      {paymentMode && (
        <Notice tone="info">
          Direct checkout is active. New plan changes use checkout; you can send
          existing requests a payment offer with an optional discount.
        </Notice>
      )}
      {billingSettingsLoaded &&
        (!billingSettings?.paymentReady ||
          billingSettings?.currency !== "INR") && (
          <Notice tone="warning">
            Payment offers need Razorpay key ID and secret configured on the
            backend, with billing currency set to INR. Configure these in Admin
            billing settings. You can still grant or reject requests.
          </Notice>
        )}
      <Panel
        title="Plan upgrade queue"
        subtitle={`${requests.length} requests on this page`}
      >
        <div className="filter-pills">
          {STATUS_FILTERS.map((item) => (
            <button
              className={statusFilter === item.value ? "active" : ""}
              key={item.value}
              onClick={() => changeStatusFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {error && (
          <div className="sw-notice error">Could not load requests.</div>
        )}
        {loading ? (
          <div className="sw-loading">Loading requests…</div>
        ) : (
          <div className="sw-table-wrap">
            <table className="sw-table">
              <thead>
                <tr>
                  {COLUMN_HEADERS.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const id = getRequestId(request);
                  return (
                    <tr key={id}>
                      <td>
                        <b>
                          {request.user?.name ||
                            request.user?.email ||
                            "Customer"}
                        </b>
                        <small className="table-secondary">
                          {request.user?.email}
                        </small>
                      </td>
                      <td>
                        {request.currentPlan || request.user?.plan || "—"}
                      </td>
                      <td>
                        <b>{request.requestedPlan}</b>
                        {request.message && (
                          <small className="table-secondary">
                            {request.message}
                          </small>
                        )}
                        {request.grantedPlan && (
                          <small className="table-secondary">
                            Granted: {formatPlanName(request.grantedPlan)}
                          </small>
                        )}
                      </td>
                      <td>
                        {request.createdAt
                          ? new Date(request.createdAt).toLocaleString()
                          : "—"}
                      </td>
                      <td>
                        <Status value={request.status} />
                      </td>
                      <td>
                        {request.status === "pending" && (
                          <div className="row-actions">
                            <button
                              title="Approve"
                              disabled={
                                !billingSettingsLoaded ||
                                (paymentMode &&
                                  (!billingSettings?.paymentReady ||
                                    billingSettings?.currency !== "INR"))
                              }
                              onClick={() => openApproval(request)}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              title="Reject"
                              onClick={() => openRejection(request)}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!requests.length && (
                  <tr>
                    <td colSpan="6" className="table-empty">
                      No requests in this queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {pagination && (
          <div className="pagination-bar">
            <span>
              Page {pagination.page} of {pagination.totalPages}
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
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
      {(pendingApprove || pendingReject) && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>
              {pendingApprove
                ? "Approve upgrade request?"
                : "Reject upgrade request?"}
            </h2>
            <p className="muted-copy">
              {pendingApprove
                ? `Review the request from ${pendingApprove.user?.name || pendingApprove.user?.email}. Choose the plan to grant and its expiry.`
                : "The customer will be notified of the decision."}
            </p>
            {pendingApprove ? (
              <div className="approval-form-fields">
                <label className="sw-field">
                  Decision
                  <select
                    value={reviewDecision}
                    onChange={(event) => setReviewDecision(event.target.value)}
                  >
                    {!paymentMode && (
                      <option value="grant">Grant plan now</option>
                    )}
                    <option
                      value="payment"
                      disabled={
                        !billingSettings?.paymentReady ||
                        billingSettings?.currency !== "INR"
                      }
                    >
                      Send payment offer
                    </option>
                  </select>
                </label>
                <label className="sw-field">
                  Grant plan
                  <select
                    value={grantedPlan}
                    onChange={(event) => setGrantedPlan(event.target.value)}
                  >
                    {availablePlans
                      .filter(
                        (plan) =>
                          plan.rank >
                          (availablePlans.find(
                            (item) =>
                              item.id ===
                              (pendingApprove.currentPlan ||
                                pendingApprove.user?.plan),
                          )?.rank ?? -1),
                      )
                      .map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                  </select>
                </label>
                {reviewDecision === "payment" && (
                  <>
                    <label className="sw-field">
                      Billing period
                      <select
                        value={billingPeriod}
                        onChange={(event) =>
                          setBillingPeriod(event.target.value)
                        }
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </label>
                    <label className="sw-field">
                      Discount (%)
                      <input
                        type="number"
                        min="0"
                        max="99"
                        step="1"
                        value={discountPercent}
                        onChange={(event) =>
                          setDiscountPercent(
                            Math.min(
                              99,
                              Math.max(0, Number(event.target.value)),
                            ),
                          )
                        }
                      />
                      <small>
                        Applied to the selected plan and billing period.
                      </small>
                    </label>
                  </>
                )}
                <label className="sw-field">
                  Plan expires at <span className="muted-copy">(optional)</span>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                  />
                  <small>Leave blank for a plan with no expiry.</small>
                </label>
                <label className="sw-field">
                  Approval reason
                  <textarea
                    value={approvalReason}
                    maxLength={500}
                    onChange={(event) => setApprovalReason(event.target.value)}
                    placeholder="Add a reason for this decision"
                  />
                </label>
              </div>
            ) : (
              <div className="approval-form-fields">
                <label className="sw-field">
                  Rejection reason
                  <textarea
                    value={rejectionReason}
                    maxLength={500}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Explain why this request is being declined"
                  />
                </label>
              </div>
            )}
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setPendingApprove(null);
                  setPendingReject(null);
                }}
              >
                Cancel
              </Button>
              {pendingApprove ? (
                <Button
                  disabled={
                    approvingId === getRequestId(pendingApprove) ||
                    approvalReason.trim().length < 3 ||
                    !grantedPlan
                  }
                  onClick={() =>
                    handleConfirmApprove({
                      grantedPlan,
                      reason: approvalReason.trim(),
                      paymentRequired: reviewDecision === "payment",
                      period: billingPeriod,
                      discountPercent,
                      ...(expiresAt
                        ? reviewDecision === "payment"
                          ? { planExpiresAt: new Date(expiresAt).toISOString() }
                          : { expiresAt: new Date(expiresAt).toISOString() }
                        : {}),
                    })
                  }
                >
                  {approvingId
                    ? "Approving…"
                    : reviewDecision === "payment"
                      ? "Send payment offer"
                      : "Approve"}
                </Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={
                    rejectingId === getRequestId(pendingReject) ||
                    rejectionReason.trim().length < 3
                  }
                  onClick={() => handleConfirmReject(rejectionReason.trim())}
                >
                  {rejectingId ? "Rejecting…" : "Reject request"}
                </Button>
              )}
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
