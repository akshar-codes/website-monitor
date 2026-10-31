import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Page, Panel } from "../components/ui/Primitives";
import {
  createIntegration,
  getIntegration,
  updateIntegration,
} from "../services/api/alerting";

const PROVIDERS = {
  slack: "Slack",
  discord: "Discord",
  telegram: "Telegram",
  webhook: "Custom Webhook",
};

export default function IntegrationForm() {
  const { provider, id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(id));
  const [form, setForm] = useState({
    name: "",
    webhookUrl: "",
    botToken: "",
    chatId: "",
    endpointUrl: "",
    signingSecret: "",
    username: "",
    customHeaders: "",
  });
  const change = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));
  useEffect(() => {
    if (!id) return;
    getIntegration(id)
      .then((integration) => {
        setForm((current) => ({
          ...current,
          name: integration.name,
          username: integration.config?.username || "",
          chatId: integration.config?.chatId || "",
          endpointUrl: integration.config?.endpointUrl || "",
        }));
      })
      .catch(() => setError("Could not load this integration."))
      .finally(() => setLoading(false));
  }, [id]);
  if (!id && !PROVIDERS[provider])
    return (
      <Page title="Unknown integration">
        <p>Choose a supported integration.</p>
      </Page>
    );

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = { name: form.name, ...(!id ? { provider } : {}) };
    if ((provider === "slack" || provider === "discord") && form.webhookUrl)
      payload.webhookUrl = form.webhookUrl;
    if (provider === "discord" && form.username)
      payload.username = form.username;
    if (provider === "telegram")
      Object.assign(payload, {
        ...(form.botToken ? { botToken: form.botToken } : {}),
        ...(form.chatId ? { chatId: form.chatId } : {}),
      });
    if (provider === "webhook") {
      Object.assign(payload, {
        ...(form.endpointUrl ? { endpointUrl: form.endpointUrl } : {}),
        ...(form.signingSecret ? { signingSecret: form.signingSecret } : {}),
      });
      if (form.customHeaders.trim()) {
        try {
          payload.customHeaders = JSON.parse(form.customHeaders);
        } catch {
          setError("Custom headers must be valid JSON.");
          setSaving(false);
          return;
        }
      }
    }
    try {
      const integration = id
        ? await updateIntegration(id, payload)
        : await createIntegration(payload);
      toast.success(
        id ? "Integration updated" : `${PROVIDERS[provider]} destination added`,
      );
      navigate(id ? "/integrations" : `/integrations?test=${integration._id}`, {
        replace: true,
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not save this integration.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title={`${id ? "Edit" : "Connect"} ${PROVIDERS[provider]}`}
      description="Credentials are encrypted before they are stored. They are never returned by the API."
    >
      <Link
        to="/integrations"
        className="inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft size={16} /> Back to integrations
      </Link>
      <Panel title={`${PROVIDERS[provider]} destination`}>
        {loading ? (
          <p>Loading integration…</p>
        ) : (
          <form className="grid gap-4 md:max-w-2xl" onSubmit={submit}>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <Input
              label="Integration name"
              required
              maxLength={80}
              value={form.name}
              onChange={change("name")}
              placeholder="Production alerts"
            />
            {(provider === "slack" || provider === "discord") && (
              <Input
                label={
                  id
                    ? "New webhook URL (leave blank to keep current)"
                    : "Incoming webhook URL"
                }
                type="url"
                required={!id}
                value={form.webhookUrl}
                onChange={change("webhookUrl")}
                placeholder={
                  provider === "slack"
                    ? "https://hooks.slack.com/services/…"
                    : "https://discord.com/api/webhooks/…"
                }
              />
            )}
            {provider === "discord" && (
              <Input
                label="Bot display name (optional)"
                maxLength={80}
                value={form.username}
                onChange={change("username")}
              />
            )}
            {provider === "telegram" && (
              <>
                <Input
                  label={
                    id
                      ? "New bot token (leave blank to keep current)"
                      : "Bot token"
                  }
                  type="password"
                  autoComplete="new-password"
                  required={!id}
                  value={form.botToken}
                  onChange={change("botToken")}
                />
                <Input
                  label="Chat, group, or channel ID"
                  required
                  value={form.chatId}
                  onChange={change("chatId")}
                />
              </>
            )}
            {provider === "webhook" && (
              <>
                <Input
                  label="HTTPS endpoint"
                  type="url"
                  required
                  value={form.endpointUrl}
                  onChange={change("endpointUrl")}
                  placeholder="https://alerts.example.com/sitewatch"
                />
                <Input
                  label={
                    id
                      ? "New signing secret (leave blank to keep current)"
                      : "Signing secret"
                  }
                  type="password"
                  autoComplete="new-password"
                  minLength={24}
                  required={!id}
                  value={form.signingSecret}
                  onChange={change("signingSecret")}
                  hint="Used to create the X-SiteWatch-Signature HMAC header."
                />
                <label className="grid gap-1 text-sm font-medium">
                  Custom headers (optional JSON)
                  <textarea
                    className="min-h-28 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                    value={form.customHeaders}
                    onChange={change("customHeaders")}
                    placeholder={'{"X-Environment":"production"}'}
                    aria-describedby="custom-header-help"
                  />
                </label>
                <p
                  id="custom-header-help"
                  className="text-xs text-muted-foreground"
                >
                  Use up to 10 X- headers. Values are encrypted; X-SiteWatch
                  signature headers are reserved. Leave blank to keep saved
                  headers unchanged.
                </p>
              </>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                <Send size={16} /> {saving ? "Saving…" : "Save destination"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/integrations")}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </Page>
  );
}
