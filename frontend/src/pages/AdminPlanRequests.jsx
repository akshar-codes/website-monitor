import { useState, useMemo } from "react";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Pagination from "../components/ui/Pagination";
import EmptyState from "../components/ui/EmptyState";
import { SkeletonRow } from "../components/ui/Skeleton";
import PlanRequestRow from "../features/admin/PlanRequestRow";
import RejectPlanRequestDialog from "../features/admin/RejectPlanRequestDialog";
import ApprovePlanRequestDialog from "../features/admin/ApprovePlanRequestDialog";
import {
  usePlanUpgradeRequestList,
  useApprovePlanUpgradeRequest,
  useRejectPlanUpgradeRequest,
} from "../hooks/useAdmin";
import { cn } from "../utils/cn";

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
    <PageContainer>
      <PageHeader
        title="Plan Requests"
        subtitle="Review and act on manual plan upgrade requests"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={refetch}
          >
            Refresh
          </Button>
        }
        className="mb-6"
      />

      <div className="mb-5 flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border-default bg-bg-elevated p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => changeStatusFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all",
                statusFilter === f.value
                  ? "bg-bg-subtle text-white"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {pagination && (
          <p className="ml-auto text-xs text-text-muted">
            {pagination.total} request{pagination.total !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300"
        >
          Upgrade requests could not be loaded.{" "}
          <button onClick={refetch} className="underline">
            Retry
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border-subtle bg-bg-surface">
        <div className="grid grid-cols-[1fr_110px_130px_130px_100px_180px] items-center gap-3 border-b border-border-subtle px-5 py-3">
          {COLUMN_HEADERS.map((h, i) => (
            <p
              key={i}
              className="text-[11px] font-semibold uppercase tracking-wider text-text-disabled"
            >
              {h}
            </p>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : !requests.length ? (
          <EmptyState
            icon={ClipboardCheck}
            title={
              statusFilter === "pending"
                ? "No pending requests"
                : "No requests found"
            }
            description={
              statusFilter === "pending"
                ? "New upgrade requests from users will appear here."
                : "Try a different filter."
            }
            className="py-16"
          />
        ) : (
          requests.map((request) => (
            <PlanRequestRow
              key={getRequestId(request)}
              request={request}
              onApprove={() => setPendingApprove(request)}
              onReject={() => setPendingReject(request)}
              approving={approvingId === getRequestId(request)}
              rejecting={rejectingId === getRequestId(request)}
            />
          ))
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          className="mt-4"
        />
      )}

      <ApprovePlanRequestDialog
        open={!!pendingApprove}
        onClose={() => setPendingApprove(null)}
        onConfirm={handleConfirmApprove}
        targetRequest={pendingApprove}
        loading={approvingId === getRequestId(pendingApprove)}
      />

      <RejectPlanRequestDialog
        open={!!pendingReject}
        onClose={() => setPendingReject(null)}
        onConfirm={handleConfirmReject}
        targetRequest={pendingReject}
        loading={rejectingId === getRequestId(pendingReject)}
      />
    </PageContainer>
  );
}
