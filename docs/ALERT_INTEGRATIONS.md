# SiteWatch alert integrations

SiteWatch routes its existing notification events through a MongoDB-backed delivery outbox. Monitoring and incident handlers persist events; a worker matches notification rules, queues provider deliveries, retries transient failures, and evaluates escalation executions. Provider outages do not block health checks or incident transitions.

## Enable encrypted credential storage

Before creating any integration, configure `ALERT_CREDENTIAL_ENCRYPTION_KEY` for the backend. It must encode exactly 32 random bytes as either 64 hexadecimal characters or base64. Generate a different key for each environment, store it in your secret manager, and keep it stable across restarts and deployments. Losing or changing this key makes existing provider credentials unreadable; rotate destination credentials or re-encrypt them as part of a planned key rotation.

Slack webhook URLs, Discord webhook URLs, Telegram bot tokens, and custom webhook signing secrets are AES-256-GCM encrypted at rest. They are never returned by management APIs. Integration updates accept replacement secrets for credential rotation.

## Provider setup

- **Slack:** Create an incoming webhook and connect its `hooks.slack.com` URL.
- **Discord:** Create a server webhook and connect its `discord.com` or `discordapp.com` API webhook URL. User mentions are disabled in alert embeds.
- **Telegram:** Create a bot with BotFather, then provide its token and a chat, group, or channel ID. The bot must be allowed to post there.
- **Custom webhook:** Configure an HTTPS endpoint and a signing secret of at least 24 characters. Each request includes `X-SiteWatch-Event`, `X-SiteWatch-Delivery`, `X-SiteWatch-Timestamp`, and `X-SiteWatch-Signature`. The signature is `sha256=` plus HMAC-SHA256 of `<timestamp>.<raw JSON body>`.

All outbound destinations are DNS-resolved, reject private/reserved IPs, pin the request to a validated public address, and do not follow redirects. Requests have bounded time and response size. Custom webhook destinations may add up to 10 `X-` headers; values are encrypted at rest, line breaks and `X-SiteWatch-*` names are rejected. Configure destination firewalls to accept only the SiteWatch sender IPs if your environment supports stable egress addresses.

## Configure rules and escalation

Use `/integrations` to add and test destinations, create event rules, define escalation steps, and inspect delivery history. Rules support event, monitor, and severity filters. Existing incident and SSL/domain notification events are adapted to these logical events:

| Existing notification | Alert event |
| --- | --- |
| `incident_opened` | `incident.created`, `monitor.down` |
| `incident_updated` | `incident.updated` |
| `incident_resolved` | `incident.resolved`, `monitor.recovered` |
| `monitor_down`, `monitor_up`, `monitor_degraded` | Corresponding monitor event |
| SSL/domain expiration and invalid certificate events | `ssl.expiring`, `domain.expiring`, `monitor.ssl_error` |

Escalation executions and delivery rows are persisted in MongoDB with unique idempotency keys and atomic worker claims. Retry delays are bounded exponential backoff; provider `Retry-After` values are honored. A user acknowledgement stops pending escalation steps while keeping the incident open. Incident resolution cancels the remaining schedule.

The worker starts with the API process and is safe to run on multiple instances because work is claimed with database leases. Monitor and incident paths only persist internal notifications; they do not make Slack, Discord, Telegram, or custom webhook calls.

## API overview

- `GET/POST/PATCH/DELETE /api/integrations`
- `POST /api/integrations/:id/test|enable|disable`
- `GET /api/integrations/deliveries` and `POST /api/integrations/deliveries/:id/retry`
- `GET/POST/PATCH/DELETE /api/notification-rules`
- `GET/POST/PATCH/DELETE /api/alert-policies`, plus `POST /api/alert-policies/test`
- `POST/DELETE /api/incidents/:id/acknowledge` and `GET /api/incidents/:id/escalations`

All management routes enforce permissions and owner scoping. Integrations created before a key is configured are not possible; configure the key first, then create a destination.
