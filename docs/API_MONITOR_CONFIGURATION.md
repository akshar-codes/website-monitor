# API Monitor Configuration Contract (v1)

This document defines the Phase 1 contract and plan limits implemented by Phase 2. It covers configuration, validation, ownership, and secret handling only. API requests are not yet executed, and assertions are not yet evaluated or stored as results.

## Resource shape

API monitors use the existing monitor resource and CRUD routes. Existing monitors without `kind` are treated as `website`.

```json
{
  "name": "Orders API",
  "url": "https://api.example.com/v1/orders",
  "kind": "api",
  "interval": 300,
  "apiConfig": {
    "version": 1,
    "method": "POST",
    "queryParams": { "page": "1", "access_token": "replace-me" },
    "headers": {
      "content-type": "application/json",
      "x-api-key": "replace-me"
    },
    "body": "{\"orderId\":\"123\"}",
    "authentication": { "mode": "bearer", "token": "replace-me" },
    "expectedStatusCodes": [200, 201],
    "maxResponseTimeMs": 5000
  }
}
```

The endpoint target is the top-level `url`. Put query values in `apiConfig.queryParams`; API URLs cannot contain a query string or fragment. Supported methods are `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`. `GET` and `DELETE` bodies are rejected. Authentication is `none`, `bearer`, or `basic`. Expected status codes contain 1-20 unique codes from 100 through 599. The response-time threshold is 1-120,000 ms.

Create, update, duplicate, list, and read use the existing `/api/monitors` routes and permissions. All service reads and writes remain scoped to the authenticated owner. The existing API-key v1 endpoints stay read-only and do not return API configuration.

## Bounds and validation

| Input                         | Limit or rule                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| API URL                       | HTTP/HTTPS, no userinfo/query/fragment, at most 2,048 characters                                                                   |
| Query parameters              | At most 30; key at most 128 characters; value at most 2,048                                                                        |
| Headers                       | At most 30; name at most 128 characters; value at most 2,048                                                                       |
| Header names                  | Valid token syntax, unique case-insensitively; reject host, authorization, cookie, framing, hop-by-hop, and other reserved headers |
| Request body                  | At most 65,536 UTF-8 bytes; body is rejected for GET and DELETE                                                                    |
| Bearer token / Basic password | 1–4,096 characters                                                                                                                 |
| Basic username                | 1–256 characters                                                                                                                   |

Unknown fields and malformed nested objects are rejected. Website URL validation and its existing ignored top-level `method` input remain compatible with current website forms; API methods belong under `apiConfig.method`.

## Secret handling and update semantics

- Bearer tokens, Basic passwords, non-empty request bodies, and header/query values whose names look credential-related (for example `x-api-key`, `access_token`, `password`, or `client_secret`) are encrypted with the existing AES-256-GCM credential utility.
- Sensitive header/query names are detected case-insensitively by common key, token, secret, password, credential, and auth terms. Non-sensitive header/query values remain readable configuration data.
- Monitor reads never return auth ciphertext, usernames, encrypted bodies, or encrypted header/query values. Auth returns `{ "mode": "bearer", "configured": true }`; Basic returns the same shape with mode `basic`. Bodies return `bodyConfigured`; sensitive header/query values are represented as `********` while their keys remain visible.
- Omitting authentication or body on an update preserves the stored value. Use `authentication: { "mode": "none" }` to remove auth, and `body: null` (or an empty body) to remove the body. When a supplied header/query map includes a masked `********` value for a configured sensitive key, its ciphertext is preserved; omitting a key from a supplied map removes that entry. Omitting the whole map preserves it.
- API activity metadata contains changed field names only. API request bodies, auth values, and sensitive header/query values are not logged.
- `ALERT_CREDENTIAL_ENCRYPTION_KEY` must be configured before storing any values that require encryption. Encryption failures return generic errors without echoing the value.

## Ownership, duplication, and uniqueness

The existing unique index on `{ owner, url }` remains in place. A user cannot create a website and API monitor with the same URL, or two API monitors for the same URL, even if their methods or parameters differ. This avoids an index migration in this phase.

API duplication copies non-secret settings and does not copy auth credentials, request bodies, or encrypted sensitive header/query values. Owners can add replacement values after duplication. Regional monitoring is rejected for API monitors until a later phase supports secure regional job configuration.

## Plan limits

API-monitor counts are scoped by owner and `kind: "api"`; they also count toward the existing total monitor limit.

| Plan       | API-monitor feature | API-monitor limit |
| ---------- | ------------------- | ----------------: |
| Free       | Disabled            |                 0 |
| Pro        | Enabled             |                 5 |
| Enterprise | Enabled             |                25 |

These are explicit conservative initial entitlements; the repository had no previous API-monitor limits. Backend services enforce feature and count limits on create, duplicate, API conversion, and API configuration updates. Usage output exposes availability, used count, limit, remaining count, and at-limit state.

## Compatibility and rollout

No data migration or index migration is required. Missing `kind` values hydrate as `website`, and no existing index definition changes. Deploy code and verify that `ALERT_CREDENTIAL_ENCRYPTION_KEY` is configured before enabling API-monitor availability for a plan. Do not enable API execution until the later execution phase reuses the existing poller's destination validation, DNS pinning, redirect checks, timeout budgets, retry limits, and response-size cap.

## Next-phase contract boundaries

- A failed required assertion will make an API check unhealthy and use the existing incident thresholds; optional assertion failures will be visible but will not change health.
- Applicable response assertions will run when an HTTP response exists, including on non-2xx responses.
- Manual runs will share the scheduled persistence and incident path with duplicate-run protection.
- API execution from regional agents remains deferred.
- The assertion input schema and execution status mapping should be versioned when assertion execution is introduced; this phase deliberately rejects and does not persist arbitrary assertion definitions.
