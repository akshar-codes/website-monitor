import { useState, useId } from "react";
import { Plus, Trash2, KeyRound } from "lucide-react";
import { Input, Select } from "../ui/Primitives";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const BODY_SUPPORTED_METHODS = ["POST", "PUT", "PATCH"];
const MAX_BODY_BYTES = 64 * 1024; // 64 KB

export default function ApiMonitorFormFields({
  initialConfig = {},
  isEdit = false,
  onChange,
}) {
  const methodId = useId();
  const [method, setMethod] = useState(initialConfig.method || "GET");

  // Query parameters state: array of { key, value, secret }
  const [queryParams, setQueryParams] = useState(() => {
    const raw = initialConfig.queryParams || {};
    const secrets = new Set(initialConfig.secretQueryParamNames || []);
    const entries = Object.entries(raw).map(([key, value]) => ({
      key,
      value: String(value),
      secret: secrets.has(key),
    }));
    return entries.length > 0 ? entries : [];
  });

  // Headers state: array of { key, value, secret }
  const [headers, setHeaders] = useState(() => {
    const raw = initialConfig.headers || {};
    const secrets = new Set(initialConfig.secretHeaderNames || []);
    const entries = Object.entries(raw).map(([key, value]) => ({
      key,
      value: String(value),
      secret: secrets.has(key),
    }));
    return entries.length > 0 ? entries : [];
  });

  // Request body
  const [body, setBody] = useState(initialConfig.body || "");
  const bodyBytes = new Blob([body]).size;

  // Authentication state
  const initialAuthMode = initialConfig.authentication?.mode || "none";
  const [authMode, setAuthMode] = useState(initialAuthMode);
  const [authAction, setAuthAction] = useState(
    isEdit && initialConfig.authentication?.credentialConfigured
      ? "keep"
      : "replace",
  );
  const [authToken, setAuthToken] = useState("");
  const [authUsername, setAuthUsername] = useState(
    initialConfig.authentication?.username || "",
  );
  const [authPassword, setAuthPassword] = useState("");

  // Expected statuses & max timeout
  const [expectedStatuses, setExpectedStatuses] = useState(() => {
    const codes = initialConfig.expectedStatusCodes;
    return Array.isArray(codes) && codes.length > 0 ? codes.join(", ") : "200";
  });
  const [maxResponseTimeMs, setMaxResponseTimeMs] = useState(
    initialConfig.maxResponseTimeMs || 10000,
  );

  // Assertions state (max 20)
  const [assertions, setAssertions] = useState(() => {
    return Array.isArray(initialConfig.assertions)
      ? initialConfig.assertions.map((a) => ({
          id: a.id || crypto.randomUUID(),
          type: a.type || "statusCode",
          property: a.property || "",
          comparison: a.comparison || "equals",
          targetValue:
            typeof a.targetValue === "object" && a.targetValue !== null
              ? JSON.stringify(a.targetValue, null, 2)
              : String(a.targetValue ?? ""),
        }))
      : [];
  });

  // Notify parent on any state mutation
  const notifyChange = (updates = {}) => {
    const curMethod = updates.method ?? method;
    const curQueryParams = updates.queryParams ?? queryParams;
    const curHeaders = updates.headers ?? headers;
    const curBody = updates.body ?? body;
    const curAuthMode = updates.authMode ?? authMode;
    const curAuthAction = updates.authAction ?? authAction;
    const curAuthToken = updates.authToken ?? authToken;
    const curAuthUsername = updates.authUsername ?? authUsername;
    const curAuthPassword = updates.authPassword ?? authPassword;
    const curStatuses = updates.expectedStatuses ?? expectedStatuses;
    const curMaxTime = updates.maxResponseTimeMs ?? maxResponseTimeMs;
    const curAssertions = updates.assertions ?? assertions;

    const parsedStatuses = curStatuses
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n >= 100 && n <= 599);

    const queryParamsMap = {};
    const secretQueryParamNames = [];
    curQueryParams.forEach((q) => {
      if (q.key.trim()) {
        queryParamsMap[q.key.trim()] = q.value;
        if (q.secret) secretQueryParamNames.push(q.key.trim());
      }
    });

    const headersMap = {};
    const secretHeaderNames = [];
    curHeaders.forEach((h) => {
      if (h.key.trim()) {
        headersMap[h.key.trim()] = h.value;
        if (h.secret) secretHeaderNames.push(h.key.trim());
      }
    });

    let authPayload = { mode: "none" };
    if (curAuthMode === "bearer") {
      if (isEdit && curAuthAction === "keep") {
        authPayload = { mode: "bearer" };
      } else {
        authPayload = { mode: "bearer", token: curAuthToken };
      }
    } else if (curAuthMode === "basic") {
      if (isEdit && curAuthAction === "keep") {
        authPayload = { mode: "basic", username: curAuthUsername };
      } else {
        authPayload = {
          mode: "basic",
          username: curAuthUsername,
          password: curAuthPassword,
        };
      }
    }

    const formattedAssertions = curAssertions.map((a) => {
      let targetValue = a.targetValue;
      if (a.type === "statusCode" || a.type === "responseTime") {
        targetValue = Number(a.targetValue);
      } else if (a.type === "jsonSchema") {
        try {
          targetValue = JSON.parse(a.targetValue);
        } catch {
          // If invalid JSON, retain raw string so backend validator catches it
          targetValue = a.targetValue;
        }
      } else if (
        [
          "exists",
          "not_exists",
          "is_null",
          "is_not_null",
          "is_empty",
          "is_not_empty",
          "is_string",
          "is_number",
          "is_boolean",
          "is_array",
        ].includes(a.comparison)
      ) {
        targetValue = null;
      }
      return {
        id: a.id,
        type: a.type,
        property: a.property?.trim() || null,
        comparison: a.comparison,
        targetValue,
      };
    });

    const payload = {
      version: 1,
      method: curMethod,
      queryParams: queryParamsMap,
      secretQueryParamNames,
      headers: headersMap,
      secretHeaderNames,
      body: BODY_SUPPORTED_METHODS.includes(curMethod)
        ? curBody.trim() || null
        : null,
      authentication: authPayload,
      expectedStatusCodes: parsedStatuses.length > 0 ? parsedStatuses : [200],
      maxResponseTimeMs: Number(curMaxTime) || 10000,
      assertions: formattedAssertions,
    };

    if (onChange) onChange(payload);
  };

  // Add assertion
  const addAssertion = () => {
    if (assertions.length >= 20) return;
    const next = [
      ...assertions,
      {
        id: crypto.randomUUID(),
        type: "statusCode",
        property: "",
        comparison: "equals",
        targetValue: "200",
      },
    ];
    setAssertions(next);
    notifyChange({ assertions: next });
  };

  // Update assertion item
  const updateAssertion = (index, field, value) => {
    const next = [...assertions];
    const item = { ...next[index], [field]: value };
    if (field === "type") {
      item.property = "";
      if (value === "statusCode") {
        item.comparison = "equals";
        item.targetValue = "200";
      } else if (value === "responseTime") {
        item.comparison = "less_than";
        item.targetValue = "1000";
      } else if (value === "header") {
        item.property = "Content-Type";
        item.comparison = "contains";
        item.targetValue = "application/json";
      } else if (value === "bodyText") {
        item.comparison = "contains";
        item.targetValue = "success";
      } else if (value === "jsonPath") {
        item.property = "$.status";
        item.comparison = "equals";
        item.targetValue = "ok";
      } else if (value === "jsonSchema") {
        item.comparison = "matches_schema";
        item.targetValue = '{\n  "type": "object",\n  "required": ["id"]\n}';
      }
    }
    next[index] = item;
    setAssertions(next);
    notifyChange({ assertions: next });
  };

  // Remove assertion item
  const removeAssertion = (index) => {
    const next = assertions.filter((_, i) => i !== index);
    setAssertions(next);
    notifyChange({ assertions: next });
  };

  return (
    <div className="api-config-fields space-y-4">
      {/* HTTP Method, Status Codes & Max Timeout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="sw-field" htmlFor={methodId}>
          <span>HTTP Method</span>
          <select
            id={methodId}
            value={method}
            onChange={(e) => {
              const nextMethod = e.target.value;
              setMethod(nextMethod);
              notifyChange({ method: nextMethod });
            }}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {/* Expected Status Codes */}
        <Input
          label="Expected status codes"
          placeholder="e.g. 200, 201, 204"
          value={expectedStatuses}
          onChange={(e) => {
            setExpectedStatuses(e.target.value);
            notifyChange({ expectedStatuses: e.target.value });
          }}
        />

        {/* Max Timeout */}
        <Input
          label="Timeout (ms)"
          type="number"
          min="1000"
          max="120000"
          value={maxResponseTimeMs}
          onChange={(e) => {
            const val = Number(e.target.value);
            setMaxResponseTimeMs(val);
            notifyChange({ maxResponseTimeMs: val });
          }}
        />
      </div>

      {/* Query Parameters */}
      <fieldset className="rounded-lg border p-3">
        <div className="flex justify-between items-center mb-2">
          <legend className="font-semibold text-sm">Query parameters</legend>
          <button
            type="button"
            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800"
            onClick={() => {
              const next = [
                ...queryParams,
                { key: "", value: "", secret: false },
              ];
              setQueryParams(next);
              notifyChange({ queryParams: next });
            }}
          >
            <Plus size={14} /> Add query param
          </button>
        </div>
        {queryParams.length === 0 ? (
          <p className="text-xs text-slate-500">
            No query parameters configured.
          </p>
        ) : (
          <div className="space-y-2">
            {queryParams.map((param, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Key"
                  className="rounded border px-2 py-1 text-sm flex-1"
                  value={param.key}
                  onChange={(e) => {
                    const next = [...queryParams];
                    next[index].key = e.target.value;
                    setQueryParams(next);
                    notifyChange({ queryParams: next });
                  }}
                />
                <input
                  type="text"
                  placeholder="Value"
                  className="rounded border px-2 py-1 text-sm flex-1"
                  value={param.value}
                  onChange={(e) => {
                    const next = [...queryParams];
                    next[index].value = e.target.value;
                    setQueryParams(next);
                    notifyChange({ queryParams: next });
                  }}
                />
                <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={param.secret}
                    onChange={(e) => {
                      const next = [...queryParams];
                      next[index].secret = e.target.checked;
                      setQueryParams(next);
                      notifyChange({ queryParams: next });
                    }}
                  />
                  <span>Secret</span>
                </label>
                <button
                  type="button"
                  className="text-red-500 hover:text-red-700 p-1"
                  onClick={() => {
                    const next = queryParams.filter((_, i) => i !== index);
                    setQueryParams(next);
                    notifyChange({ queryParams: next });
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* HTTP Headers */}
      <fieldset className="rounded-lg border p-3">
        <div className="flex justify-between items-center mb-2">
          <legend className="font-semibold text-sm">HTTP headers</legend>
          <button
            type="button"
            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800"
            onClick={() => {
              const next = [...headers, { key: "", value: "", secret: false }];
              setHeaders(next);
              notifyChange({ headers: next });
            }}
          >
            <Plus size={14} /> Add header
          </button>
        </div>
        {headers.length === 0 ? (
          <p className="text-xs text-slate-500">
            No custom headers configured.
          </p>
        ) : (
          <div className="space-y-2">
            {headers.map((hdr, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Header Name"
                  className="rounded border px-2 py-1 text-sm flex-1"
                  value={hdr.key}
                  onChange={(e) => {
                    const next = [...headers];
                    next[index].key = e.target.value;
                    setHeaders(next);
                    notifyChange({ headers: next });
                  }}
                />
                <input
                  type="text"
                  placeholder="Value"
                  className="rounded border px-2 py-1 text-sm flex-1"
                  value={hdr.value}
                  onChange={(e) => {
                    const next = [...headers];
                    next[index].value = e.target.value;
                    setHeaders(next);
                    notifyChange({ headers: next });
                  }}
                />
                <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hdr.secret}
                    onChange={(e) => {
                      const next = [...headers];
                      next[index].secret = e.target.checked;
                      setHeaders(next);
                      notifyChange({ headers: next });
                    }}
                  />
                  <span>Secret</span>
                </label>
                <button
                  type="button"
                  className="text-red-500 hover:text-red-700 p-1"
                  onClick={() => {
                    const next = headers.filter((_, i) => i !== index);
                    setHeaders(next);
                    notifyChange({ headers: next });
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* Request Body (only for POST / PUT / PATCH) */}
      {BODY_SUPPORTED_METHODS.includes(method) && (
        <fieldset className="rounded-lg border p-3">
          <div className="flex justify-between items-center mb-1">
            <legend className="font-semibold text-sm">Request body</legend>
            <span
              className={`text-xs ${
                bodyBytes > MAX_BODY_BYTES
                  ? "text-red-600 font-bold"
                  : "text-slate-500"
              }`}
            >
              {bodyBytes.toLocaleString()} / {MAX_BODY_BYTES.toLocaleString()}{" "}
              bytes
            </span>
          </div>
          <textarea
            className="w-full h-24 rounded border p-2 text-sm font-mono"
            placeholder='e.g. { "query": "{ ping }" }'
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              notifyChange({ body: e.target.value });
            }}
          />
        </fieldset>
      )}

      {/* Authentication */}
      <fieldset className="rounded-lg border p-3">
        <legend className="font-semibold text-sm flex items-center gap-1.5">
          <KeyRound size={15} /> Authentication
        </legend>
        <div className="mt-2 space-y-3">
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="authMode"
                value="none"
                checked={authMode === "none"}
                onChange={() => {
                  setAuthMode("none");
                  notifyChange({ authMode: "none" });
                }}
              />
              <span>None</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="authMode"
                value="bearer"
                checked={authMode === "bearer"}
                onChange={() => {
                  setAuthMode("bearer");
                  notifyChange({ authMode: "bearer" });
                }}
              />
              <span>Bearer Token</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="authMode"
                value="basic"
                checked={authMode === "basic"}
                onChange={() => {
                  setAuthMode("basic");
                  notifyChange({ authMode: "basic" });
                }}
              />
              <span>Basic Auth</span>
            </label>
          </div>

          {authMode === "bearer" && (
            <div className="pt-2 border-t">
              {isEdit && initialConfig.authentication?.credentialConfigured ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="bearerAction"
                        checked={authAction === "keep"}
                        onChange={() => {
                          setAuthAction("keep");
                          notifyChange({ authAction: "keep" });
                        }}
                      />
                      <span>Keep existing token (********)</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="bearerAction"
                        checked={authAction === "replace"}
                        onChange={() => {
                          setAuthAction("replace");
                          notifyChange({ authAction: "replace" });
                        }}
                      />
                      <span>Replace token</span>
                    </label>
                  </div>
                  {authAction === "replace" && (
                    <Input
                      label="New Bearer Token"
                      type="password"
                      placeholder="Enter new token"
                      value={authToken}
                      onChange={(e) => {
                        setAuthToken(e.target.value);
                        notifyChange({ authToken: e.target.value });
                      }}
                      required
                    />
                  )}
                </div>
              ) : (
                <Input
                  label="Bearer Token"
                  type="password"
                  placeholder="eyJh..."
                  value={authToken}
                  onChange={(e) => {
                    setAuthToken(e.target.value);
                    notifyChange({ authToken: e.target.value });
                  }}
                  required
                />
              )}
            </div>
          )}

          {authMode === "basic" && (
            <div className="pt-2 border-t space-y-2">
              <Input
                label="Username"
                placeholder="api_user"
                value={authUsername}
                onChange={(e) => {
                  setAuthUsername(e.target.value);
                  notifyChange({ authUsername: e.target.value });
                }}
                required
              />
              {isEdit && initialConfig.authentication?.credentialConfigured ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="basicAction"
                        checked={authAction === "keep"}
                        onChange={() => {
                          setAuthAction("keep");
                          notifyChange({ authAction: "keep" });
                        }}
                      />
                      <span>Keep existing password (********)</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="basicAction"
                        checked={authAction === "replace"}
                        onChange={() => {
                          setAuthAction("replace");
                          notifyChange({ authAction: "replace" });
                        }}
                      />
                      <span>Replace password</span>
                    </label>
                  </div>
                  {authAction === "replace" && (
                    <Input
                      label="New Password"
                      type="password"
                      placeholder="Enter new password"
                      value={authPassword}
                      onChange={(e) => {
                        setAuthPassword(e.target.value);
                        notifyChange({ authPassword: e.target.value });
                      }}
                      required
                    />
                  )}
                </div>
              ) : (
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => {
                    setAuthPassword(e.target.value);
                    notifyChange({ authPassword: e.target.value });
                  }}
                  required
                />
              )}
            </div>
          )}
        </div>
      </fieldset>

      {/* Response Assertions */}
      <fieldset className="rounded-lg border p-3">
        <div className="flex justify-between items-center mb-2">
          <div>
            <legend className="font-semibold text-sm">
              Response assertions
            </legend>
            <p className="text-xs text-slate-500">
              Verify status codes, latency, headers, body text, JSONPath, or
              JSON Schema.
            </p>
          </div>
          <button
            type="button"
            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
            disabled={assertions.length >= 20}
            onClick={addAssertion}
          >
            <Plus size={14} /> Add assertion ({assertions.length}/20)
          </button>
        </div>

        {assertions.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            No assertions configured. Only the HTTP status code will be checked
            against the expected status list.
          </p>
        ) : (
          <div className="space-y-3">
            {assertions.map((assertion, index) => (
              <div
                key={assertion.id || index}
                className="p-2.5 rounded border bg-slate-50/50 space-y-2 text-sm"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-xs text-slate-700">
                    Assertion #{index + 1}
                  </span>
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => removeAssertion(index)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Select
                    label="Type"
                    value={assertion.type}
                    onChange={(e) =>
                      updateAssertion(index, "type", e.target.value)
                    }
                  >
                    <option value="statusCode">Status code</option>
                    <option value="responseTime">Response time (ms)</option>
                    <option value="header">Header</option>
                    <option value="bodyText">Body text</option>
                    <option value="jsonPath">JSONPath</option>
                    <option value="jsonSchema">JSON Schema</option>
                  </Select>

                  {/* Comparisons & Target fields depending on type */}
                  {assertion.type === "statusCode" && (
                    <>
                      <Select
                        label="Comparison"
                        value={assertion.comparison}
                        onChange={(e) =>
                          updateAssertion(index, "comparison", e.target.value)
                        }
                      >
                        <option value="equals">equals</option>
                        <option value="not_equals">not equals</option>
                      </Select>
                      <Input
                        label="Status code"
                        type="number"
                        min="100"
                        max="599"
                        value={assertion.targetValue}
                        onChange={(e) =>
                          updateAssertion(index, "targetValue", e.target.value)
                        }
                        required
                      />
                    </>
                  )}

                  {assertion.type === "responseTime" && (
                    <>
                      <Select
                        label="Comparison"
                        value={assertion.comparison}
                        onChange={(e) =>
                          updateAssertion(index, "comparison", e.target.value)
                        }
                      >
                        <option value="less_than">less than (&lt;)</option>
                        <option value="less_than_or_equal">
                          less than or equal (&lt;=)
                        </option>
                        <option value="greater_than">
                          greater than (&gt;)
                        </option>
                      </Select>
                      <Input
                        label="Threshold (ms)"
                        type="number"
                        min="1"
                        max="120000"
                        value={assertion.targetValue}
                        onChange={(e) =>
                          updateAssertion(index, "targetValue", e.target.value)
                        }
                        required
                      />
                    </>
                  )}

                  {assertion.type === "header" && (
                    <>
                      <Input
                        label="Header name"
                        placeholder="Content-Type"
                        value={assertion.property}
                        onChange={(e) =>
                          updateAssertion(index, "property", e.target.value)
                        }
                        required
                      />
                      <Select
                        label="Comparison"
                        value={assertion.comparison}
                        onChange={(e) =>
                          updateAssertion(index, "comparison", e.target.value)
                        }
                      >
                        <option value="exists">exists</option>
                        <option value="not_exists">does not exist</option>
                        <option value="equals">equals</option>
                        <option value="not_equals">not equals</option>
                        <option value="contains">contains</option>
                        <option value="not_contains">does not contain</option>
                      </Select>
                    </>
                  )}

                  {assertion.type === "bodyText" && (
                    <>
                      <Select
                        label="Comparison"
                        value={assertion.comparison}
                        onChange={(e) =>
                          updateAssertion(index, "comparison", e.target.value)
                        }
                      >
                        <option value="contains">contains</option>
                        <option value="not_contains">does not contain</option>
                        <option value="equals">equals</option>
                        <option value="not_equals">not equals</option>
                        <option value="starts_with">starts with</option>
                        <option value="ends_with">ends with</option>
                      </Select>
                      <Input
                        label="Target text"
                        placeholder="expected string"
                        value={assertion.targetValue}
                        onChange={(e) =>
                          updateAssertion(index, "targetValue", e.target.value)
                        }
                        required
                      />
                    </>
                  )}

                  {assertion.type === "jsonPath" && (
                    <>
                      <Input
                        label="JSONPath expression"
                        placeholder="$.data.user.role"
                        value={assertion.property}
                        onChange={(e) =>
                          updateAssertion(index, "property", e.target.value)
                        }
                        required
                      />
                      <Select
                        label="Comparison"
                        value={assertion.comparison}
                        onChange={(e) =>
                          updateAssertion(index, "comparison", e.target.value)
                        }
                      >
                        <option value="equals">equals</option>
                        <option value="not_equals">not equals</option>
                        <option value="contains">contains</option>
                        <option value="not_contains">does not contain</option>
                        <option value="exists">exists</option>
                        <option value="not_exists">does not exist</option>
                        <option value="is_string">is string</option>
                        <option value="is_number">is number</option>
                        <option value="is_boolean">is boolean</option>
                        <option value="is_array">is array</option>
                        <option value="is_null">is null</option>
                        <option value="is_empty">is empty</option>
                        <option value="is_not_empty">is not empty</option>
                      </Select>
                    </>
                  )}
                </div>

                {/* Extra value row for header & jsonPath when comparison needs targetValue */}
                {assertion.type === "header" &&
                  ["equals", "not_equals", "contains", "not_contains"].includes(
                    assertion.comparison,
                  ) && (
                    <div className="pt-1">
                      <Input
                        label="Header value"
                        placeholder="application/json"
                        value={assertion.targetValue}
                        onChange={(e) =>
                          updateAssertion(index, "targetValue", e.target.value)
                        }
                        required
                      />
                    </div>
                  )}

                {assertion.type === "jsonPath" &&
                  ["equals", "not_equals", "contains", "not_contains"].includes(
                    assertion.comparison,
                  ) && (
                    <div className="pt-1">
                      <Input
                        label="Target value"
                        placeholder="Expected value"
                        value={assertion.targetValue}
                        onChange={(e) =>
                          updateAssertion(index, "targetValue", e.target.value)
                        }
                        required
                      />
                    </div>
                  )}

                {/* JSON Schema Definition */}
                {assertion.type === "jsonSchema" && (
                  <div className="pt-1">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      JSON Schema (Draft 7)
                    </label>
                    <textarea
                      className="w-full h-24 rounded border p-2 text-xs font-mono"
                      value={assertion.targetValue}
                      onChange={(e) =>
                        updateAssertion(index, "targetValue", e.target.value)
                      }
                      required
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
