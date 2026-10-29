import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuditEvents } from "../hooks/useAdmin";

const field =
  "rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500";
const resourceUrl = (target) => {
  if (!target?.id) return null;
  if (target.type === "User") return `/admin/users/${target.id}`;
  if (target.type === "Monitor") return `/admin/monitors/${target.id}`;
  if (target.type === "Incident") return `/admin/incidents/${target.id}`;
  if (target.type === "PlanUpgradeRequest") return `/admin/plan-requests`;
  return null;
};
const eventLabel = (event) => event.eventType.replaceAll("_", " ");

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [actorId, setActorId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const params = useMemo(
    () => ({
      page,
      limit: 25,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(category ? { category } : {}),
      ...(outcome ? { outcome } : {}),
      ...(actorId.trim() ? { actorId: actorId.trim() } : {}),
      ...(targetId.trim() ? { targetId: targetId.trim() } : {}),
      ...(startDate && endDate
        ? {
            startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
            endDate: new Date(`${endDate}T23:59:59.999Z`).toISOString(),
          }
        : {}),
    }),
    [page, search, category, outcome, actorId, targetId, startDate, endDate],
  );
  const { data, loading, error, refetch } = useAdminAuditEvents(params);
  const events = data?.data || [];
  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
  };
  return null;
}
