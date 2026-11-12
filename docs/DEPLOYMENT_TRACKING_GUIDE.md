# Deployment correlation and release tracking guide

SiteWatch release tracking allows CI/CD deployment pipelines (GitHub Actions, GitLab CI, CircleCI, Jenkins, ArgoCD, or custom webhooks) to securely report software deployments and associate them with existing monitors. SiteWatch automatically tracks performance impact, detects post-deployment regressions, correlates overlapping incidents, and overlays deployment events onto monitor response time charts.

---

## 1. Credential management

Deployment write access uses dedicated deployment integration credentials. General API keys (`wm_live_*`) are strictly read-only and rejected for deployment event ingestion.

### Creating an integration

To create a deployment integration, navigate to **Integrations > Deployments** in the UI or call the API:

```http
POST /api/deployments/integrations
Content-Type: application/json

{
  "name": "Production GitHub Actions",
  "description": "Primary deployment pipeline for web-app",
  "environment": "production",
  "monitors": ["64b000000000000000000001", "64b000000000000000000002"]
}
```

**Response:**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Deployment integration created. Copy the secret now; it will not be shown again.",
  "data": {
    "id": "64c000000000000000000010",
    "name": "Production GitHub Actions",
    "prefix": "dep_live_a1b2c3",
    "secret": "dep_live_a1b2c3_dGhpc2lzYXNlY3JldHRva2VudmFsdWUxMjM0NTY",
    "environment": "production",
    "monitors": ["64b000000000000000000001", "64b000000000000000000002"]
  }
}
```

> [!IMPORTANT]
> The full plaintext secret is returned **only once** upon creation or rotation. The backend stores only an unsalted SHA-256 hash for authentication and an AES-256-GCM encrypted ciphertext at rest using `ALERT_CREDENTIAL_ENCRYPTION_KEY`. Raw secrets are never logged or returned by listing endpoints.

### Secret rotation with zero downtime

Rotate secrets without breaking active deployments using a 15-minute grace period:

```http
POST /api/deployments/integrations/:id/rotate
Content-Type: application/json

{
  "immediateRevocation": false
}
```

During the 15-minute grace period, both the old and new secrets authenticate successfully. Setting `immediateRevocation: true` revokes the previous secret immediately.

### Revocation

Revoke compromised or retired credentials immediately:

```http
POST /api/deployments/integrations/:id/revoke
```

Revoked credentials reject all subsequent ingestion requests with HTTP 401.

---

## 2. Authentication mechanisms

The ingestion endpoint (`POST /api/deployments/events`) supports two authentication methods:

### Option A: Bearer token (Standard)

Include the secret token in the `Authorization` header:

```http
POST /api/deployments/events
Authorization: Bearer dep_live_a1b2c3_dGhpc2lzYXNlY3JldHRva2VudmFsdWUxMjM0NTY
Content-Type: application/json
```

### Option B: HMAC-SHA256 signature (Enhanced security)

Compute the HMAC-SHA256 hex digest of the raw request payload using the deployment secret as the signing key:

```http
POST /api/deployments/events
Content-Type: application/json
x-deployment-signature: sha256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945
```

---

## 3. Ingestion payload specification

`POST /api/deployments/events` (or `POST /api/deployments`) accepts JSON payloads up to 64 KB.

### Schema fields

| Field            | Type                      | Required | Description                                                                                 |
| ---------------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `version`        | string                    | **Yes**  | Release version or name (max 128 chars, e.g. `v2.4.1`, `release-2026-11-12`).               |
| `monitors`       | array of ObjectId strings | No*      | List of monitor IDs affected by this release. (*Required if integration is not pre-scoped). |
| `environment`    | string                    | No       | Target environment (default: `production`, e.g. `staging`, `preview`).                      |
| `commitSha`      | string                    | No       | Git commit hash (up to 64 chars, e.g. `9f82d3a`).                                           |
| `deployedAt`     | ISO 8601 string           | No       | Actual deployment completion timestamp (defaults to current server time).                   |
| `source`         | string                    | No       | CI/CD platform identifier (e.g. `github-actions`, `gitlab-ci`, `circleci`).                 |
| `url`            | string                    | No       | URL to deployment logs, PR, or build run (max 2048 chars).                                  |
| `description`    | string                    | No       | Release notes or deployment summary (max 2000 chars).                                       |
| `externalId`     | string                    | No       | CI/CD build run ID (max 256 chars, enforces idempotency per owner).                         |
| `idempotencyKey` | string                    | No       | Explicit deduplication key (also accepted via `Idempotency-Key` HTTP header).               |
| `metadata`       | object                    | No       | Arbitrary JSON key-value pairs for custom deployment attributes.                            |

### Sample request payload

```json
{
  "version": "v3.2.0",
  "monitors": ["64b000000000000000000001"],
  "environment": "production",
  "commitSha": "9f82d3a4b5c6",
  "deployedAt": "2026-11-12T17:30:00.000Z",
  "source": "github-actions",
  "url": "https://github.com/my-org/my-repo/actions/runs/12345678",
  "description": "Optimized database connection pooling and upgraded checkout service dependencies.",
  "externalId": "gh-run-12345678-job-checkout",
  "idempotencyKey": "dep-v3.2.0-checkout-prod"
}
```

### Idempotency guarantees

Repeated submissions with the same `externalId` or `idempotencyKey` return HTTP 200 with `{ "meta": { "duplicate": true } }` and return the existing deployment event without creating duplicate records or inflating regression signals.

---

## 4. Automated regression detection & alerting

SiteWatch automatically evaluates post-deployment telemetry and dispatches targeted alerts when regressions are suspected.

### Evaluation boundaries & data sufficiency

1. **Configurable comparison window:** Evaluates performance before and after the release (default: 30 minutes before vs. 30 minutes after).
2. **Sample count thresholds:** Requires at least 3 scheduled health check samples in both before and after windows. If sample history is sparse or the evaluation window is incomplete, SiteWatch withholds classification as `insufficient_data` or `evaluating` to prevent false alarms.
3. **Regression triggers:**
   - **Response time degradation:** Median latency degraded by $\ge$ 20% and $\ge$ 30 ms, OR P95 latency degraded by $\ge$ 25% and $\ge$ 50 ms.
   - **Elevated failure rate:** Failure rate increased by $\ge$ 5.0%, or availability dropped by $\ge$ 5.0%.
   - **Post-deployment incidents:** Confirmed incidents opening on the monitor within the post-deployment window.
4. **Durable deduplication & cooldown:** Alerts use a durable deduplication key (`${deploymentId}:${monitorId}:${regressionType}`) and a 60-minute cooldown to prevent alert storms and duplicate worker notifications.
5. **Causality disclaimer:** All notifications and investigation summaries explicitly label regressions as _suspected_ and temporal associations, advising manual investigation before initiating rollbacks.

---

## 5. Production GitHub Actions workflow

Add the following workflow to `.github/workflows/deploy.yml` in your repository.

```yaml
name: Deploy and Track Release

on:
  push:
    branches:
      - main
    tags:
      - "v*"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Deploy Application
        run: |
          echo "Executing production deployment..."
          # Deploy steps here (e.g. AWS, Kubernetes, Vercel, Railway, Docker)

      - name: Report Deployment to SiteWatch
        if: success()
        env:
          SITEWATCH_URL: ${{ secrets.SITEWATCH_INSTANCE_URL }} # e.g. https://monitor.yourdomain.com
          SITEWATCH_SECRET: ${{ secrets.SITEWATCH_DEPLOYMENT_SECRET }} # dep_live_...
          MONITOR_ID: ${{ secrets.SITEWATCH_MONITOR_ID }} # 64b...
        run: |
          VERSION="${GITHUB_REF_NAME:-$(git rev-parse --short HEAD)}"
          COMMIT_SHA="${GITHUB_SHA}"
          BUILD_URL="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
          EXTERNAL_ID="gh-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"

          PAYLOAD=$(cat <<EOF
          {
            "version": "${VERSION}",
            "monitors": ["${MONITOR_ID}"],
            "environment": "production",
            "commitSha": "${COMMIT_SHA}",
            "deployedAt": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
            "source": "github-actions",
            "url": "${BUILD_URL}",
            "description": "Automated deployment from GitHub Actions workflow.",
            "externalId": "${EXTERNAL_ID}"
          }
          EOF
          )

          curl -sS -X POST "${SITEWATCH_URL}/api/deployments/events" \
            -H "Authorization: Bearer ${SITEWATCH_SECRET}" \
            -H "Content-Type: application/json" \
            -H "Idempotency-Key: ${EXTERNAL_ID}" \
            -d "${PAYLOAD}" \
            --fail-with-body
```

---

## 6. GitLab CI example

In `.gitlab-ci.yml`:

```yaml
stages:
  - deploy
  - notify

track_deployment:
  stage: notify
  image: curlimages/curl:latest
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
  script:
    - |
      curl -sS -X POST "${SITEWATCH_URL}/api/deployments/events" \
        -H "Authorization: Bearer ${SITEWATCH_DEPLOYMENT_SECRET}" \
        -H "Content-Type: application/json" \
        -d "{
          \"version\": \"${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}\",
          \"monitors\": [\"${SITEWATCH_MONITOR_ID}\"],
          \"environment\": \"production\",
          \"commitSha\": \"${CI_COMMIT_SHA}\",
          \"source\": \"gitlab-ci\",
          \"url\": \"${CI_PIPELINE_URL}\",
          \"externalId\": \"gitlab-${CI_PIPELINE_ID}\"
        }"
```

---

## 7. Troubleshooting & FAQ

| Symptom                         | Cause                                                                                | Solution                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **401 Invalid credentials**     | Token typo, revoked integration, or using a read-only general API key (`wm_live_*`). | Use the dedicated deployment integration secret (`dep_live_*`) created via Integrations > Deployments. |
| **403 Cross-tenant monitor**    | The referenced monitor belongs to a different user account.                          | Verify that all IDs in `monitors` belong to the integration creator's account.                         |
| **400 Invalid ID format**       | Monitor ID is not a 24-character hexadecimal MongoDB ObjectId.                       | Copy the exact monitor ID from the monitor details URL or API response.                                |
| **Status: `insufficient_data`** | Less than 3 scheduled health checks occurred in the comparison window.               | Adjust the monitor check interval or wait for scheduled checks to accumulate.                          |
| **No chart reference lines**    | Selected chart range does not overlap with the deployment timestamp.                 | Select a wider time window (e.g. `24h` or `7d`) on the monitor details page.                           |
