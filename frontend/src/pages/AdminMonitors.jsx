import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminMonitors } from "../hooks/useAdmin";

export default function AdminMonitors() {
  const [search, setSearch] = useState("");
  const params = useMemo(
    () => ({ page: 1, limit: 100, ...(search ? { search } : {}) }),
    [search],
  );
  const { data, loading, error, refetch } = useAdminMonitors(params);
  const monitors = data?.data || [];

  return null;
}
