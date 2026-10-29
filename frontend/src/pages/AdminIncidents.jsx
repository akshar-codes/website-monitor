import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminIncidents } from "../hooks/useAdmin";

export default function AdminIncidents() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const params = useMemo(
    () => ({
      page,
      limit: 20,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(severity ? { severity } : {}),
      ...(status ? { status } : {}),
    }),
    [page, search, severity, status],
  );
  const { data, loading, error, refetch } = useAdminIncidents(params);
  const incidents = data?.data || [];
  return null;
}
