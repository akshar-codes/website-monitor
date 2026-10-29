import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMonitorDetails, useMonitorMutations } from "../hooks/useMonitors";
import { useUsage } from "../hooks/useUsage";
import { ROUTES } from "../constants/routes";
import { FEATURES } from "../constants/features";
import { formatRelative } from "../utils/format";

const WINDOWS = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

export default function MonitorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [window, setWindow] = useState("24h");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, loading, error, refetch } = useMonitorDetails(id, window);
  const details = data?.data;

  const { data: usageData } = useUsage();
  const usage = usageData?.data;

  const handleMutationSuccess = useCallback(
    (action) => {
      if (action === "delete") {
        navigate(ROUTES.MONITORS, { replace: true });
        return;
      }
      setEditOpen(false);
      setDeleteOpen(false);
      refetch();
    },
    [navigate, refetch],
  );

  const {
    updateMonitor,
    deleteMonitor,
    toggleMonitor,
    runMonitorCheck,
    submitting,
  } = useMonitorMutations(handleMutationSuccess);

  const handleFormSubmit = (payload) => {
    updateMonitor(id, payload);
  };

  // Full-page error — the monitor doesn't exist, isn't owned by the
  // caller, or the request failed outright with no cached data to show.
  return null;
}
