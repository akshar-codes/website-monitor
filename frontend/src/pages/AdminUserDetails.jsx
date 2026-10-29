import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAdminUser,
  useAdminUserPlan,
  useAdminMonitors,
  useUpdateUserPlan,
} from "../hooks/useAdmin";
import { ROLES } from "../constants/roles";

const panel = "rounded-xl border border-border-subtle bg-bg-surface p-5";
export default function AdminUserDetails() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useAdminUser(id);
  const planQuery = useAdminUserPlan(id);
  const monitorsQuery = useAdminMonitors({ ownerId: id, page: 1, limit: 100 });
  const user = data?.user;
  const monitors = monitorsQuery.data?.data || [];

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const { updatePlan, submitting: planSubmitting } = useUpdateUserPlan(() => {
    setPlanDialogOpen(false);
    refetch();
    planQuery.refetch();
  });

  const handleConfirmPlanChange = async ({ plan, reason }) => {
    await updatePlan(user.id, plan, reason);
  };
  return null;
}
