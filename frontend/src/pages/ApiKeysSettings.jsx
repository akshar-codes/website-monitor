import { useCallback, useEffect, useState } from "react";
import { Ban, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { FormField, Input, Select } from "../components/ui/Input";
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
    loadKeys();
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

  return (
    <PageContainer className="px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="API keys"
        subtitle="Create and manage keys for read-only access to your monitor data."
      />
      <div className="mt-5 space-y-5">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}
        {createdSecret && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">
                  Copy your new API key
                </h2>
                <p className="mt-1 text-sm text-amber-300">
                  This secret is shown once. Store it securely; it cannot be
                  retrieved later.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreatedSecret("")}
                className="text-xs text-text-muted hover:text-white"
              >
                Dismiss
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-border-subtle bg-bg-base p-3 text-sm text-emerald-300">
                {createdSecret}
              </code>
              <Button type="button" icon={Copy} onClick={copySecret}>
                Copy key
              </Button>
            </div>
          </Card>
        )}

        {allowed ? (
          <Card>
            <div className="mb-5 flex items-center gap-3">
              <KeyRound className="text-emerald-400" size={19} />
              <div>
                <h2 className="font-semibold text-white">Create an API key</h2>
                <p className="text-sm text-text-muted">
                  Keys can read your monitors through the versioned API.
                </p>
              </div>
            </div>
            <form
              onSubmit={handleCreate}
              className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end"
            >
              <FormField
                label="Key name"
                hint="Use a name that identifies the app or service."
              >
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={60}
                  placeholder="Production dashboard"
                />
              </FormField>
              <FormField label="Expires">
                <Select
                  value={expiresInDays}
                  onChange={(event) => setExpiresInDays(event.target.value)}
                >
                  <option value="">Never</option>
                  <option value="30">In 30 days</option>
                  <option value="90">In 90 days</option>
                  <option value="180">In 180 days</option>
                  <option value="365">In 365 days</option>
                </Select>
              </FormField>
              <Button
                type="submit"
                icon={Plus}
                loading={creating}
                disabled={name.trim().length < 2}
              >
                Create key
              </Button>
            </form>
          </Card>
        ) : (
          <Card>
            <h2 className="font-semibold text-white">API keys require Pro</h2>
            <p className="mt-1 text-sm text-text-muted">
              Upgrade to Pro or Unlimited to create API keys. Administrative
              accounts cannot create personal keys.
            </p>
          </Card>
        )}

        <Card className="p-0">
          <div className="border-b border-border-subtle px-5 py-4">
            <h2 className="font-semibold text-white">Existing keys</h2>
            <p className="mt-1 text-sm text-text-muted">
              Secrets are never stored in readable form or returned by this
              list.
            </p>
          </div>
          {loading ? (
            <p className="px-5 py-8 text-sm text-text-muted">
              Loading API keys…
            </p>
          ) : keys.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-text-muted">
              No API keys yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-bg-overlay text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Key prefix</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3">Last used</th>
                    <th className="px-5 py-3">Expires</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {keys.map((key) => {
                    const expired =
                      key.expiresAt && new Date(key.expiresAt) <= new Date();
                    const active = !key.revokedAt && !expired;
                    const id = key.id || key._id;
                    return (
                      <tr key={id}>
                        <td className="px-5 py-3 font-medium text-white">
                          {key.name}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-text-muted">
                          {key.prefix}…
                        </td>
                        <td className="px-5 py-3 text-text-muted">
                          {dateLabel(key.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-text-muted">
                          {dateLabel(key.lastUsedAt)}
                        </td>
                        <td className="px-5 py-3 text-text-muted">
                          {dateLabel(key.expiresAt)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={
                              active ? "text-emerald-400" : "text-text-muted"
                            }
                          >
                            {active
                              ? "Active"
                              : key.revokedAt
                                ? "Revoked"
                                : "Expired"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2">
                            {active && (
                              <Button
                                size="sm"
                                variant="outline"
                                icon={Ban}
                                onClick={() =>
                                  setSelected({ key, action: "revoke" })
                                }
                              >
                                Revoke
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Trash2}
                              aria-label={`Delete ${key.name}`}
                              onClick={() =>
                                setSelected({ key, action: "delete" })
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-white">
            Read-only API usage
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Send your key as a bearer token. Requests are limited to 120 per
            minute per key.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-bg-base p-3 text-xs text-emerald-300">{`Authorization: Bearer wm_live_…\nGET /api/v1/monitors`}</pre>
        </Card>
      </div>
      <ConfirmDialog
        open={Boolean(selected)}
        onClose={() => !actionLoading && setSelected(null)}
        onConfirm={confirmAction}
        loading={actionLoading}
        title={
          selected?.action === "revoke" ? "Revoke API key?" : "Delete API key?"
        }
        description={
          selected?.action === "revoke"
            ? `Requests using “${selected?.key.name}” will stop working immediately.`
            : `“${selected?.key.name}” and its metadata will be permanently removed.`
        }
        confirmLabel={
          selected?.action === "revoke" ? "Revoke key" : "Delete key"
        }
      />
    </PageContainer>
  );
}
