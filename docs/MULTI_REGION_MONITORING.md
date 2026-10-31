# Multi-Region Monitoring Operations

Regional monitoring uses the central API as a coordinator and separate probe-agent processes as geographic vantage points. A region is only real when its agent is deployed on infrastructure in that location; a central server cannot simulate regional network paths.

## Central API configuration

For each deployed agent, add an entry to `PROBE_AGENT_CONFIG` in the backend environment. The key is the agent ID and the value contains its assigned region and a unique secret:

```json
{"probe-india-1":{"regionId":"india-mumbai","secret":"REPLACE_WITH_A_RANDOM_SECRET"},"probe-us-1":{"regionId":"us-east","secret":"USE_A_DIFFERENT_RANDOM_SECRET"}}
```

Generate each secret with a cryptographically secure generator (at least 32 random bytes), store it in the central API's secret manager, and distribute the matching value only to that agent. Do not commit real secrets. Restart the API after changing this configuration. The backend accepts signed requests only for configured agent IDs and regions.

Supported region IDs are `india-mumbai`, `us-east`, `eu-west`, and `singapore`. The registry is in `backend/src/config/regions.js`.

## Deploying an agent

Run the backend package's `start:probe` script on a small Node.js 24 host in each region. The agent needs outbound HTTPS access to the central API and outbound access to the monitored sites. It does not need MongoDB credentials or direct database access.

Set these environment variables on each agent:

```text
PROBE_API_URL=https://api.example.com
PROBE_AGENT_ID=probe-india-1
PROBE_REGION_ID=india-mumbai
PROBE_AGENT_SECRET=<the matching secret from the central API configuration>
```

Then run:

```sh
cd backend
npm run start:probe
```

Run the process under the host's service manager or container orchestrator with automatic restart. Deploy at least one continuously running agent per region you want to offer. The agent sends heartbeats and claims jobs for its configured region; the API marks a region unavailable when its heartbeat is older than 90 seconds. A stopped agent therefore produces insufficient regional coverage, never a website failure by itself.

## Scheduling, leases, and coverage

The central scheduler creates one run and one MongoDB job per selected region. Jobs use short leases and can be retried after a worker crash. Each result is accepted once for its active lease. Runs finalize when all regions return or the deadline expires, then create one canonical `HealthCheck` from the observed regional quorum. Individual regional checks remain separate from global uptime and analytics.

The global result requires a strict majority of the configured regions to return actual observations. A majority of failed observations is a global outage; fewer observations yield `unknown`. A regional outage requires two consecutive failed observations and resolves after two consecutive successful observations.

Plan limits are centrally defined in `backend/src/config/plans.js`. The current initial limits are 1 region / 3,000 probes per day on Free, 3 regions / 250,000 probes per day on Pro, and 4 regions / unlimited daily probes on Enterprise. A regional check budget accounts for both selected regions and check interval.

## Operational checks

- Monitor agent heartbeat age and probe API request failures.
- Alert on regional job queue age, expired leases, run finalization failures, and low coverage.
- Keep each agent's clock synchronized; signed requests allow five minutes of clock skew.
- Use HTTPS between agents and the API. HMAC signatures and one-time nonces protect requests, but transport encryption is still required.
- Roll out one region at a time and confirm its displayed location using real external test endpoints before enabling it for customers.
- Do not add a region to the customer-facing registry until an agent is deployed and monitored there.

## Current scope and limitations

This repository provides the agent runtime and central coordination APIs, but it does not provision cloud infrastructure. Regional percentile and uptime analytics are based on regional results collected after deployment; they do not backfill old global checks. Regional performance anomaly detection currently uses independent per-region baselines. Notification delivery uses the existing notification pipeline and its configured preferences.

Before a production rollout, deploy actual agents in each advertised location and run the backend integration suite and frontend production build.
