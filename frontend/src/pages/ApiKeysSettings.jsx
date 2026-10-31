import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import * as apiKeysApi from "../services/api/apiKeys";
import {
  Page,
  Panel,
  Button,
  Input,
  Select,
  Notice,
  Table,
} from "../components/ui/Primitives";
import { Plus, Copy, Trash2, ShieldAlert, RefreshCw } from "lucide-react";

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

  const columns = [
    { key: "name", label: "Key name" },
    {
      key: "prefix",
      label: "Key prefix",
      render: (v, row) => v || row.keyPrefix || "••••••••",
    },
    { key: "createdAt", label: "Created", render: (v) => dateLabel(v) },
    { key: "lastUsedAt", label: "Last used", render: (v) => dateLabel(v) },
    { key: "expiresAt", label: "Expires", render: (v) => dateLabel(v) },
    {
      key: "status",
      label: "Status",
      render: (v, row) => (
        <span className={`sw-status ${row.revokedAt ? "down" : "up"}`}>
          <i />
          {row.revokedAt ? "Revoked" : "Active"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (_, row) => (
        <div className="row-actions">
          <button
            aria-label="Revoke"
            data-tooltip="Revoke"
            disabled={!!row.revokedAt}
            onClick={() => setSelected({ key: row, action: "revoke" })}
          >
            <ShieldAlert size={14} />
          </button>
          <button
            aria-label="Delete"
            data-tooltip="Delete"
            onClick={() => setSelected({ key: row, action: "delete" })}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];
  return (
    <Page
      title="API keys"
      description="Create and manage credentials for the SiteWatch API."
      eyebrow="SETTINGS"
      actions={
        <Button variant="secondary" onClick={loadKeys}>
          <RefreshCw size={14} /> Refresh
        </Button>
      }
    >
      {!allowed && (
        <Notice tone="warning">
          API keys require an eligible paid plan.{" "}
          <a href="/billing">View plans</a>
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <Panel
        title="Create an API key"
        subtitle="The secret is shown only once when created"
      >
        <form className="api-key-form" onSubmit={handleCreate}>
          <Input
            label="Key name"
            placeholder="Production integration"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Select
            label="Expiration"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
          >
            <option value="">No expiration</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
          </Select>
          <Button disabled={!allowed || creating}>
            <Plus size={14} />
            {creating ? "Creating…" : "Create key"}
          </Button>
        </form>
        {createdSecret && (
          <Notice tone="success">
            Copy this key now; it will not be shown again.
            <div className="secret-copy">
              <code>{createdSecret}</code>
              <Button variant="secondary" onClick={copySecret}>
                <Copy size={14} /> Copy
              </Button>
            </div>
          </Notice>
        )}
      </Panel>
      <Panel title="Your API keys" subtitle={`${keys.length} keys`}>
        <Table
          columns={columns}
          rows={keys}
          empty={loading ? "Loading keys…" : "No API keys created yet."}
        />
      </Panel>
      {selected && (
        <div className="modal-backdrop">
          <section className="form-modal">
            <h2>
              {selected.action === "revoke"
                ? "Revoke this API key?"
                : "Delete this API key?"}
            </h2>
            <p className="muted-copy">
              Apps using this credential may lose access immediately.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={actionLoading}
                onClick={confirmAction}
              >
                {actionLoading ? "Updating…" : "Confirm"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
