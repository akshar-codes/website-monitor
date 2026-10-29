import { useAdminPlanHistory } from "../hooks/useAdmin";

const panel = "rounded-xl border border-border-subtle bg-bg-surface";

export default function AdminPlanHistory() {
  const { data, loading, error, refetch } = useAdminPlanHistory();
  const events = Array.isArray(data) ? data : [];

  return null;
}
