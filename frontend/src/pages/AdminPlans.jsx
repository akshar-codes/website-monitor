import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useAdminPlanOverview,
  useUserList,
  useUpdateUserPlan,
} from "../hooks/useAdmin";

const panel = "rounded-xl border border-border-subtle bg-bg-surface p-5";
export default function AdminPlans() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const {
    data: plans,
    loading: plansLoading,
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
  return null;
}
