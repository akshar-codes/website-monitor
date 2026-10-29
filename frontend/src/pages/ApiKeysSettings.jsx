import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import * as apiKeysApi from "../services/api/apiKeys";

const dateLabel = (value) =>
  value ? new Date(value).toLocaleString() : "Never";

export default function ApiKeysSettings() {
  const { plan, isAdmin } = useAuth();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState("");
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const allowed = !isAdmin && ["pro", "unlimited"].includes(plan);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiKeysApi.getApiKeys();
      setKeys(result.data || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not load API keys.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = setTimeout(loadKeys, 0);
    return () => clearTimeout(request);
  }, [loadKeys]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const result = await apiKeysApi.createApiKey({
        name: name.trim(),
        expiresInDays: expiresInDays ? Number(expiresInDays) : null,
      });
      setCreatedSecret(result.data.secret);
      setName("");
      await loadKeys();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not create the API key.",
      );
    } finally {
      setCreating(false);
    }
  };

  const confirmAction = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      if (selected.action === "revoke")
        await apiKeysApi.revokeApiKey(selected.key.id || selected.key._id);
      else await apiKeysApi.deleteApiKey(selected.key.id || selected.key._id);
      toast.success(
        selected.action === "revoke" ? "API key revoked" : "API key deleted",
      );
      setSelected(null);
      await loadKeys();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not update the API key.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(createdSecret);
      toast.success("API key copied to clipboard");
    } catch {
      toast.error("Clipboard access failed. Select and copy the key manually.");
    }
  };

  return null;
}
