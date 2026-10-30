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

const STATUS_FILTERS = [
  { label: "Pending", value: "pending" },
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
  const [paymentMode, setPaymentMode] = useState(false);
  useEffect(() => {
    let active = true;
    getBillingMode()
      .then(
        (response) =>
          active && setPaymentMode(response?.data?.mode === "payment"),
      )
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Both "pending" actions route through a confirmation step before the
  // mutation fires, mirroring the pattern used throughout AdminUsers.jsx.
  const [pendingApprove, setPendingApprove] = useState(null); // request
  const [pendingReject, setPendingReject] = useState(null); // request

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
          Direct checkout mode is active. New upgrades are paid through customer
          checkout; manual approvals are paused until request review mode is
          restored.
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
                              disabled={paymentMode}
                              onClick={() => setPendingApprove(request)}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              title="Reject"
                              onClick={() => setPendingReject(request)}
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
                ? `Grant ${pendingApprove.requestedPlan} to ${pendingApprove.user?.name || pendingApprove.user?.email}?`
                : "The customer will be notified of the decision."}
            </p>
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
                  disabled={approvingId === getRequestId(pendingApprove)}
                  onClick={() => {
                    const reason = window.prompt("Approval reason (required):");
                    if (reason?.trim())
                      handleConfirmApprove({
                        grantedPlan: pendingApprove.requestedPlan,
                        reason: reason.trim(),
                      });
                  }}
                >
                  {approvingId ? "Approving…" : "Approve"}
                </Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={rejectingId === getRequestId(pendingReject)}
                  onClick={() => {
                    const reason = window.prompt(
                      "Reason for rejection (required):",
                    );
                    if (reason?.trim()) handleConfirmReject(reason.trim());
                  }}
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
