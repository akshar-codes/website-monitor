import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Check, CircleAlert, Clock3, PlugZap, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Input,
  Notice,
  Page,
  Panel,
} from "../components/ui/Primitives";
import { getMonitors } from "../services/api/monitors";
import * as alertingApi from "../services/api/alerting";

const PROVIDERS = [
  {
    id: "slack",
    name: "Slack",
    description: "Send formatted alerts to Slack channels.",
  },
  {
    id: "discord",
    name: "Discord",
    description: "Send incident embeds to Discord servers.",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Deliver alerts to a chat, group, or channel.",
  },
  {
    id: "webhook",
    name: "Custom Webhook",
    description: "Sign and deliver JSON events to your services.",
  },
];
const EVENTS = [
  ["monitor.down", "Monitor down"],
  ["monitor.recovered", "Monitor recovered"],
  ["monitor.degraded", "Monitor degraded"],
  ["incident.created", "Incident created"],
  ["incident.updated", "Incident updated"],
  ["incident.resolved", "Incident resolved"],
  ["ssl.expiring", "SSL expiring"],
  ["domain.expiring", "Domain expiring"],
  ["monitor.ssl_error", "SSL validation error"],
];
const pretty = (value = "") =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function CheckList({
  title,
  items,
  values,
  onChange,
  empty = "No options available.",
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-semibold">{title}</legend>
      {items.length ? (
        items.map((item) => (
          <label className="flex items-center gap-2 text-sm" key={item.id}>
            <input
              type="checkbox"
              checked={values.includes(item.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...values, item.id]
                    : values.filter((value) => value !== item.id),
                )
              }
            />
            {item.name}
          </label>
        ))
      ) : (
        <small className="text-slate-500">{empty}</small>
      )}
    </fieldset>
  );
}

export default function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const tab =
    searchParams.get("tab") ||
    (location.pathname.endsWith("/deliveries")
      ? "deliveries"
      : location.pathname.endsWith("/escalations")
        ? "escalations"
        : location.pathname.endsWith("/rules")
          ? "rules"
          : "integrations");
  const [integrations, setIntegrations] = useState([]);
  const [rules, setRules] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliveryProvider, setDeliveryProvider] = useState("");
  const [deliveryStart, setDeliveryStart] = useState("");
  const [deliveryEnd, setDeliveryEnd] = useState("");
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [testBusy, setTestBusy] = useState(null);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [editingPolicyId, setEditingPolicyId] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    name: "",
    integrationIds: [],
    events: [],
    monitorIds: [],
    severity: [],
  });
  const [policyForm, setPolicyForm] = useState({
    name: "",
    triggerEvents: ["incident.created"],
    initialIntegrationIds: [],
    escalationSteps: [
      { afterMinutes: 5, integrationIds: [], priority: "high" },
    ],
    repeatPolicy: {
      enabled: false,
      intervalMinutes: 30,
      maxRepeats: 3,
      integrationIds: [],
    },
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        integrationRows,
        ruleRows,
        policyRows,
        deliveryResponse,
        monitorResponse,
      ] = await Promise.all([
        alertingApi.getIntegrations(),
        alertingApi.getNotificationRules(),
        alertingApi.getAlertPolicies(),
        alertingApi.getNotificationDeliveries({
          page: 1,
          limit: 25,
          ...(deliveryStatus ? { status: deliveryStatus } : {}),
          ...(deliveryProvider ? { provider: deliveryProvider } : {}),
          ...(deliveryStart
            ? { startDate: `${deliveryStart}T00:00:00.000Z` }
            : {}),
          ...(deliveryEnd ? { endDate: `${deliveryEnd}T23:59:59.999Z` } : {}),
        }),
        getMonitors({ page: 1, limit: 100 }),
      ]);
      setIntegrations(integrationRows || []);
      setRules(ruleRows || []);
      setPolicies(policyRows || []);
      setDeliveries(deliveryResponse.data || []);
      setMonitors(
        Array.isArray(monitorResponse.data)
          ? monitorResponse.data
          : monitorResponse.data?.monitors || monitorResponse.monitors || [],
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not load alert integrations.",
      );
    } finally {
      setLoading(false);
    }
  }, [deliveryStatus, deliveryProvider, deliveryStart, deliveryEnd]);
  useEffect(() => {
    Promise.resolve().then(() => refresh());
  }, [refresh]);

  const selectedTab = (value) =>
    setSearchParams(value === "integrations" ? {} : { tab: value });
  const setRule = (key, value) =>
    setRuleForm((current) => ({ ...current, [key]: value }));
  const setPolicy = (key, value) =>
    setPolicyForm((current) => ({ ...current, [key]: value }));
  const availableIntegrations = integrations.filter(
    (integration) => integration.isActive,
  );
  const monitorOptions = useMemo(
    () =>
      monitors.map((monitor) => ({
        id: String(monitor._id || monitor.id),
        name: monitor.name,
      })),
    [monitors],
  );
  const integrationOptions = useMemo(
    () =>
      availableIntegrations.map((integration) => ({
        id: String(integration._id),
        name: `${integration.name} · ${pretty(integration.provider)}`,
      })),
    [availableIntegrations],
  );

  useEffect(() => {
    const testId = searchParams.get("test");
    if (!testId) return;
    setSearchParams({}, { replace: true });
    alertingApi
      .testIntegration(testId)
      .then((result) =>
        result.success
          ? toast.success("Test alert delivered")
          : toast.error("Test delivery failed; check the destination."),
      )
      .catch(() => toast.error("Test delivery could not be completed."))
      .finally(() => refresh());
  }, [searchParams, setSearchParams, refresh]);

  const createRule = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...ruleForm,
        filters: {
          monitorIds: ruleForm.monitorIds,
          severity: ruleForm.severity,
        },
        ...(editingRuleId ? {} : { isActive: true }),
      };
      if (editingRuleId)
        await alertingApi.updateNotificationRule(editingRuleId, payload);
      else await alertingApi.createNotificationRule(payload);
      toast.success(
        editingRuleId
          ? "Notification rule updated"
          : "Notification rule created",
      );
      setEditingRuleId(null);
      setRuleForm({
        name: "",
        integrationIds: [],
        events: [],
        monitorIds: [],
        severity: [],
      });
      await refresh();
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.message || "Could not create rule",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const createPolicy = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...policyForm,
        ...(editingPolicyId ? {} : { isActive: true }),
      };
      if (editingPolicyId)
        await alertingApi.updateAlertPolicy(editingPolicyId, payload);
      else await alertingApi.createAlertPolicy(payload);
      toast.success(
        editingPolicyId
          ? "Escalation policy updated"
          : "Escalation policy created",
      );
      setEditingPolicyId(null);
      setPolicyForm({
        name: "",
        triggerEvents: ["incident.created"],
        initialIntegrationIds: [],
        escalationSteps: [
          { afterMinutes: 5, integrationIds: [], priority: "high" },
        ],
        repeatPolicy: {
          enabled: false,
          intervalMinutes: 30,
          maxRepeats: 3,
          integrationIds: [],
        },
      });
      await refresh();
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.message || "Could not create policy",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const runTest = async (id) => {
    setTestBusy(id);
    try {
      const result = await alertingApi.testIntegration(id);
      result.success
        ? toast.success("Test alert delivered")
        : toast.error("Test delivery failed; check the destination.");
      await refresh();
    } catch {
      toast.error("Test delivery could not be completed.");
    } finally {
      setTestBusy(null);
    }
  };
  const deleteIntegration = async (integration) => {
    if (
      !window.confirm(
        `Delete ${integration.name}? Pending deliveries will be cancelled.`,
      )
    )
      return;
    try {
      await alertingApi.deleteIntegration(integration._id);
      toast.success("Integration deleted");
      await refresh();
    } catch {
      toast.error("Could not delete integration");
    }
  };

  return (
    <Page
      title="Alert integrations"
      description="Route monitoring events to your team's tools and escalate incidents that need attention."
      actions={
        <Link className="sw-button primary" to="/integrations/new/slack">
          <PlugZap size={16} /> Add integration
        </Link>
      }
    >
      <div
        className="mb-5 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Alert configuration"
      >
        {[
          ["integrations", "Destinations"],
          ["rules", "Notification rules"],
          ["escalations", "Escalations"],
          ["deliveries", "Delivery history"],
        ].map(([value, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`sw-button ${tab === value ? "primary" : "secondary"}`}
            onClick={() => selectedTab(value)}
            key={value}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? (
        <Panel title="Loading alert settings…">
          <p>Fetching integrations and delivery history.</p>
        </Panel>
      ) : (
        <>
          {tab === "integrations" && (
            <>
              <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {PROVIDERS.map((provider) => (
                  <Panel
                    key={provider.id}
                    title={provider.name}
                    subtitle={provider.description}
                  >
                    <Link
                      className="sw-button secondary"
                      to={`/integrations/new/${provider.id}`}
                    >
                      Configure {provider.name}
                    </Link>
                  </Panel>
                ))}
              </div>
              <Panel
                title="Connected destinations"
                subtitle={`${integrations.length} configured`}
              >
                {integrations.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No destinations configured yet. Add Slack, Discord,
                    Telegram, or a signed webhook.
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {integrations.map((integration) => (
                      <article
                        key={integration._id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">
                              {integration.name}
                            </h3>
                            <p className="text-sm text-slate-500">
                              {pretty(integration.provider)} ·{" "}
                              {integration.isActive ? "Active" : "Disabled"}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${integration.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                          >
                            {integration.isActive ? "Connected" : "Paused"}
                          </span>
                        </div>
                        {integration.lastError && (
                          <p className="mt-3 flex items-center gap-2 text-sm text-amber-800">
                            <CircleAlert size={15} /> {integration.lastError}
                          </p>
                        )}
                        {integration.lastSuccessAt && (
                          <small className="mt-2 block text-slate-500">
                            Last delivered{" "}
                            {new Date(
                              integration.lastSuccessAt,
                            ).toLocaleString()}
                          </small>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            disabled={testBusy === integration._id}
                            onClick={() => runTest(integration._id)}
                          >
                            {testBusy === integration._id
                              ? "Sending…"
                              : "Send test"}
                          </Button>
                          <Link
                            className="sw-button secondary"
                            to={`/integrations/${integration.provider}/${integration._id}/edit`}
                          >
                            Edit / rotate secret
                          </Link>
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              await alertingApi.setIntegrationActive(
                                integration._id,
                                !integration.isActive,
                              );
                              await refresh();
                            }}
                          >
                            {integration.isActive ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => deleteIntegration(integration)}
                          >
                            <Trash2 size={15} /> Delete
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </Panel>
            </>
          )}

          {tab === "rules" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
              <Panel
                title={
                  editingRuleId
                    ? "Edit notification rule"
                    : "Create notification rule"
                }
                subtitle="Choose events, destinations, and optional monitor/severity filters."
              >
                <form className="grid gap-5" onSubmit={createRule}>
                  <Input
                    label="Rule name"
                    required
                    maxLength={100}
                    value={ruleForm.name}
                    onChange={(event) => setRule("name", event.target.value)}
                    placeholder="Production notifications"
                  />
                  <CheckList
                    title="Events"
                    items={EVENTS.map(([id, name]) => ({ id, name }))}
                    values={ruleForm.events}
                    onChange={(value) => setRule("events", value)}
                  />
                  <CheckList
                    title="Destinations"
                    items={integrationOptions}
                    values={ruleForm.integrationIds}
                    onChange={(value) => setRule("integrationIds", value)}
                    empty="Add and enable a destination first."
                  />
                  <CheckList
                    title="Limit to monitors (optional)"
                    items={monitorOptions}
                    values={ruleForm.monitorIds}
                    onChange={(value) => setRule("monitorIds", value)}
                  />
                  <CheckList
                    title="Severity filter (optional)"
                    items={[
                      "critical",
                      "major",
                      "minor",
                      "high",
                      "normal",
                      "low",
                    ].map((id) => ({ id, name: pretty(id) }))}
                    values={ruleForm.severity}
                    onChange={(value) => setRule("severity", value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={
                        submitting ||
                        !ruleForm.integrationIds.length ||
                        !ruleForm.events.length
                      }
                    >
                      {submitting
                        ? "Saving…"
                        : editingRuleId
                          ? "Save changes"
                          : "Create rule"}
                    </Button>
                    {editingRuleId && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setEditingRuleId(null);
                          setRuleForm({
                            name: "",
                            integrationIds: [],
                            events: [],
                            monitorIds: [],
                            severity: [],
                          });
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </Panel>
              <Panel
                title="Active rules"
                subtitle={`${rules.length} configured`}
              >
                <div className="grid gap-3">
                  {rules.map((rule) => (
                    <article key={rule._id} className="rounded-lg border p-3">
                      <div className="flex justify-between gap-2">
                        <b>{rule.name}</b>
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => {
                              setEditingRuleId(rule._id);
                              setRuleForm({
                                name: rule.name,
                                integrationIds: rule.integrationIds.map(String),
                                events: rule.events,
                                monitorIds:
                                  rule.filters?.monitorIds?.map(String) || [],
                                severity: rule.filters?.severity || [],
                              });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              await alertingApi.updateNotificationRule(
                                rule._id,
                                { isActive: !rule.isActive },
                              );
                              await refresh();
                            }}
                          >
                            {rule.isActive ? "Disable" : "Enable"}
                          </button>
                          <button
                            className="text-red-700"
                            onClick={async () => {
                              await alertingApi.deleteNotificationRule(
                                rule._id,
                              );
                              await refresh();
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {rule.events.map(pretty).join(" · ")}
                      </p>
                      <small>
                        {rule.integrationIds.length} destination(s) ·{" "}
                        {rule.isActive ? "enabled" : "disabled"}
                      </small>
                    </article>
                  ))}
                  {!rules.length && (
                    <p className="text-sm text-slate-500">
                      Create a rule to start routing events.
                    </p>
                  )}
                </div>
              </Panel>
            </div>
          )}

          {tab === "escalations" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
              <Panel
                title={
                  editingPolicyId
                    ? "Edit escalation policy"
                    : "Create escalation policy"
                }
                subtitle="Steps run only while the incident is open and unacknowledged."
              >
                <form className="grid gap-5" onSubmit={createPolicy}>
                  <Input
                    label="Policy name"
                    required
                    maxLength={100}
                    value={policyForm.name}
                    onChange={(event) => setPolicy("name", event.target.value)}
                    placeholder="Production incident escalation"
                  />
                  <CheckList
                    title="Trigger events"
                    items={[
                      { id: "incident.created", name: "Incident created" },
                      { id: "monitor.down", name: "Monitor down" },
                    ]}
                    values={policyForm.triggerEvents}
                    onChange={(value) => setPolicy("triggerEvents", value)}
                  />
                  <CheckList
                    title="Initial destinations"
                    items={integrationOptions}
                    values={policyForm.initialIntegrationIds}
                    onChange={(value) =>
                      setPolicy("initialIntegrationIds", value)
                    }
                  />
                  <div className="grid gap-3">
                    {policyForm.escalationSteps.map((step, index) => (
                      <fieldset
                        className="grid gap-3 rounded-lg border p-3"
                        key={index}
                      >
                        <legend>Escalation step {index + 1}</legend>
                        <Input
                          label="Minutes after incident"
                          type="number"
                          min="1"
                          max="10080"
                          required
                          value={step.afterMinutes}
                          onChange={(event) =>
                            setPolicy(
                              "escalationSteps",
                              policyForm.escalationSteps.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      afterMinutes: Number(event.target.value),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                        <CheckList
                          title="Notify destinations"
                          items={integrationOptions}
                          values={step.integrationIds}
                          onChange={(value) =>
                            setPolicy(
                              "escalationSteps",
                              policyForm.escalationSteps.map((item, i) =>
                                i === index
                                  ? { ...item, integrationIds: value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <label className="grid max-w-xs gap-1 text-sm">
                          Priority
                          <select
                            className="sw-input"
                            value={step.priority}
                            onChange={(event) =>
                              setPolicy(
                                "escalationSteps",
                                policyForm.escalationSteps.map((item, i) =>
                                  i === index
                                    ? { ...item, priority: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          >
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {index > 0 && (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                const next = [...policyForm.escalationSteps];
                                [next[index - 1], next[index]] = [
                                  next[index],
                                  next[index - 1],
                                ];
                                setPolicy("escalationSteps", next);
                              }}
                            >
                              Move up
                            </Button>
                          )}
                          {index < policyForm.escalationSteps.length - 1 && (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                const next = [...policyForm.escalationSteps];
                                [next[index + 1], next[index]] = [
                                  next[index],
                                  next[index + 1],
                                ];
                                setPolicy("escalationSteps", next);
                              }}
                            >
                              Move down
                            </Button>
                          )}
                          {index > 0 && (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() =>
                                setPolicy(
                                  "escalationSteps",
                                  policyForm.escalationSteps.filter(
                                    (_, i) => i !== index,
                                  ),
                                )
                              }
                            >
                              Remove step
                            </Button>
                          )}
                        </div>
                      </fieldset>
                    ))}
                    {policyForm.escalationSteps.length < 10 && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setPolicy("escalationSteps", [
                            ...policyForm.escalationSteps,
                            {
                              afterMinutes:
                                (policyForm.escalationSteps.at(-1)
                                  ?.afterMinutes || 0) + 10,
                              integrationIds: [],
                              priority: "high",
                            },
                          ])
                        }
                      >
                        Add escalation step
                      </Button>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={policyForm.repeatPolicy.enabled}
                      onChange={(event) =>
                        setPolicy("repeatPolicy", {
                          ...policyForm.repeatPolicy,
                          enabled: event.target.checked,
                        })
                      }
                    />{" "}
                    Repeat alerts after the final step
                  </label>
                  {policyForm.repeatPolicy.enabled && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        label="Repeat interval (minutes)"
                        type="number"
                        min="5"
                        max="10080"
                        value={policyForm.repeatPolicy.intervalMinutes}
                        onChange={(event) =>
                          setPolicy("repeatPolicy", {
                            ...policyForm.repeatPolicy,
                            intervalMinutes: Number(event.target.value),
                          })
                        }
                      />
                      <Input
                        label="Maximum repeats"
                        type="number"
                        min="0"
                        max="20"
                        value={policyForm.repeatPolicy.maxRepeats}
                        onChange={(event) =>
                          setPolicy("repeatPolicy", {
                            ...policyForm.repeatPolicy,
                            maxRepeats: Number(event.target.value),
                          })
                        }
                      />
                      <div className="md:col-span-2">
                        <CheckList
                          title="Repeat destinations (empty uses initial destinations)"
                          items={integrationOptions}
                          values={policyForm.repeatPolicy.integrationIds}
                          onChange={(value) =>
                            setPolicy("repeatPolicy", {
                              ...policyForm.repeatPolicy,
                              integrationIds: value,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={
                        submitting ||
                        !policyForm.triggerEvents.length ||
                        !policyForm.initialIntegrationIds.length ||
                        policyForm.escalationSteps.some(
                          (step) => !step.integrationIds.length,
                        )
                      }
                    >
                      {submitting
                        ? "Saving…"
                        : editingPolicyId
                          ? "Save changes"
                          : "Create policy"}
                    </Button>
                    {editingPolicyId && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setEditingPolicyId(null);
                          setPolicyForm({
                            name: "",
                            triggerEvents: ["incident.created"],
                            initialIntegrationIds: [],
                            escalationSteps: [
                              {
                                afterMinutes: 5,
                                integrationIds: [],
                                priority: "high",
                              },
                            ],
                            repeatPolicy: {
                              enabled: false,
                              intervalMinutes: 30,
                              maxRepeats: 3,
                              integrationIds: [],
                            },
                          });
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </Panel>
              <Panel title="Escalation policies">
                {policies.length ? (
                  <div className="grid gap-3">
                    {policies.map((policy) => (
                      <article
                        className="rounded-lg border p-3"
                        key={policy._id}
                      >
                        <div className="flex justify-between gap-2">
                          <b>{policy.name}</b>
                          <div className="flex flex-wrap gap-3">
                            <button
                              onClick={() => {
                                setEditingPolicyId(policy._id);
                                setPolicyForm({
                                  name: policy.name,
                                  triggerEvents: policy.triggerEvents,
                                  initialIntegrationIds:
                                    policy.initialIntegrationIds.map(String),
                                  escalationSteps: policy.escalationSteps.map(
                                    (step) => ({
                                      afterMinutes: step.afterMinutes,
                                      integrationIds:
                                        step.integrationIds.map(String),
                                      priority: step.priority,
                                    }),
                                  ),
                                  repeatPolicy: {
                                    enabled: Boolean(
                                      policy.repeatPolicy?.enabled,
                                    ),
                                    intervalMinutes:
                                      policy.repeatPolicy?.intervalMinutes ||
                                      30,
                                    maxRepeats:
                                      policy.repeatPolicy?.maxRepeats ?? 3,
                                    integrationIds:
                                      policy.repeatPolicy?.integrationIds?.map(
                                        String,
                                      ) || [],
                                  },
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={async () => {
                                await alertingApi.updateAlertPolicy(
                                  policy._id,
                                  { isActive: !policy.isActive },
                                );
                                await refresh();
                              }}
                            >
                              {policy.isActive ? "Disable" : "Enable"}
                            </button>
                            <button
                              className="text-red-700"
                              onClick={async () => {
                                await alertingApi.deleteAlertPolicy(policy._id);
                                await refresh();
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500">
                          {policy.escalationSteps.length} step(s) ·{" "}
                          {policy.repeatPolicy?.enabled
                            ? "repeats enabled"
                            : "no repeats"}{" "}
                          · {policy.isActive ? "enabled" : "disabled"}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No escalation policies configured.
                  </p>
                )}
              </Panel>
            </div>
          )}

          {tab === "deliveries" && (
            <Panel
              title="Delivery history"
              subtitle="Recent integration attempts and retry state."
            >
              <div className="mb-4 grid gap-3 md:grid-cols-4">
                <label className="grid gap-1 text-sm">
                  Provider
                  <select
                    className="sw-input"
                    value={deliveryProvider}
                    onChange={(event) =>
                      setDeliveryProvider(event.target.value)
                    }
                  >
                    <option value="">All providers</option>
                    {PROVIDERS.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Status
                  <select
                    className="sw-input"
                    value={deliveryStatus}
                    onChange={(event) => setDeliveryStatus(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    {[
                      "pending",
                      "processing",
                      "delivered",
                      "failed",
                      "dead_letter",
                      "cancelled",
                    ].map((value) => (
                      <option key={value} value={value}>
                        {pretty(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="From date"
                  type="date"
                  value={deliveryStart}
                  onChange={(event) => setDeliveryStart(event.target.value)}
                />
                <Input
                  label="To date"
                  type="date"
                  value={deliveryEnd}
                  onChange={(event) => setDeliveryEnd(event.target.value)}
                />
              </div>
              {deliveries.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Destination</th>
                        <th>Status</th>
                        <th>Attempts</th>
                        <th>Last attempt</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map((delivery) => (
                        <tr className="border-t" key={delivery._id}>
                          <td>{pretty(delivery.eventType)}</td>
                          <td>
                            {delivery.integration?.name ||
                              "Deleted integration"}
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-1">
                              {delivery.status === "delivered" ? (
                                <Check size={14} />
                              ) : (
                                <Clock3 size={14} />
                              )}
                              {pretty(delivery.status)}
                            </span>
                            {delivery.error && (
                              <small className="block text-amber-800">
                                {delivery.error}
                              </small>
                            )}
                          </td>
                          <td>{delivery.attempts}</td>
                          <td>
                            {new Date(
                              delivery.lastAttemptAt || delivery.createdAt,
                            ).toLocaleString()}
                          </td>
                          <td>
                            {["failed", "dead_letter"].includes(
                              delivery.status,
                            ) && (
                              <Button
                                variant="secondary"
                                onClick={async () => {
                                  await alertingApi.retryNotificationDelivery(
                                    delivery._id,
                                  );
                                  await refresh();
                                }}
                              >
                                Retry
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No deliveries yet. Events will appear here once they match a
                  rule or escalation policy.
                </p>
              )}
            </Panel>
          )}
        </>
      )}
    </Page>
  );
}
