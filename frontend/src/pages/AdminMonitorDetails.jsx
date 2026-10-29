import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAdminMonitor, useAdminMonitorCheck } from "../hooks/useAdmin";

const panel = "rounded-xl border border-border-subtle bg-bg-surface p-5";
export default function AdminMonitorDetails() {
  const { id } = useParams();
  const [window, setWindow] = useState("30d");
  const [confirm, setConfirm] = useState(false);
  const { data, loading, error, refetch } = useAdminMonitor(id, window);
  const onCheck = () => {
    setConfirm(false);
    refetch();
  };
  const { check, submitting } = useAdminMonitorCheck(onCheck);
  const monitor = data?.monitor;
  return null;
}
