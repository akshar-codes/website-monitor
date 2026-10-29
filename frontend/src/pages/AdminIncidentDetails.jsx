import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAdminIncident, useResolveAdminIncident } from "../hooks/useAdmin";

const panel = "rounded-xl border border-border-subtle bg-bg-surface p-5";
export default function AdminIncidentDetails() {
  const { id } = useParams();
  const [confirm, setConfirm] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [rootCause, setRootCause] = useState("");
  const { data, loading, error, refetch } = useAdminIncident(id);
  const onDone = () => {
    setConfirm(false);
    refetch();
  };
  const { resolve, submitting } = useResolveAdminIncident(onDone);
  return null;
}
