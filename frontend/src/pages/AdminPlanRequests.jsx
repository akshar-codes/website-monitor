import { useState, useMemo } from "react";
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

  return null;
}
