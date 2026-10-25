# Deployment guide

This project deploys as a static React frontend and a long-running Node.js API. The API process also runs the monitoring schedulers, notification digests, and retention maintenance.

## Build and run

Use Node.js 24.16.0 and install dependencies from each lockfile:

```sh
cd backend
npm ci
npm start
```

In the frontend build environment:

```sh
cd frontend
npm ci
npm run lint
npm run build
```

Publish `frontend/dist` to a static host. Run the backend as a persistent service; it must remain online for scheduled checks to run.

## Routing and browser sessions

The frontend API client uses the relative base path `/api` and serves uploaded avatars from `/uploads`. Configure the production reverse proxy or hosting platform to:

- Serve frontend static files for application routes.
- Forward `/api/*` to the backend.
- Forward `/uploads/*` to the backend or the configured avatar storage service.

Keeping the frontend and API on one site simplifies session-cookie behavior. If they use different origins, configure `CORS_ORIGIN` with the exact allowed frontend origin and verify credentialed cookie behavior in the target browsers. Production session cookies use HTTPS-only and `SameSite=Strict` settings.

## Required environment

Start with [`backend/.env.example`](../backend/.env.example). At minimum, configure:

| Variable                                                 | Purpose                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                               | Set to `production` in production deployments.                                               |
| `PORT`                                                   | Port on which the backend listens.                                                           |
| `MONGO_URI`                                              | MongoDB connection string. Use a dedicated database user with only required access.          |
| `CORS_ORIGIN`                                            | Comma-separated exact frontend origins allowed to make credentialed requests.                |
| `CLIENT_URL`                                             | Canonical frontend URL used for OAuth redirects and email links.                             |
| `COOKIE_SECRET`                                          | Cookie signing secret, at least 32 characters.                                               |
| `SESSION_SECRET`                                         | Session signing secret, at least 32 characters and independent from `COOKIE_SECRET`.         |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL` | Outbound email transport for account verification and notifications.                         |
| `TRUST_PROXY`                                            | Number of trusted proxy hops; configure to match the actual network path to the application. |

Generate secrets from a secure random source and store them in the deployment platform's secret manager. Do not commit production `.env` files or put credentials in frontend build variables.

Optional Google/GitHub OAuth providers are enabled only when each provider's client ID, client secret, and callback URL are configured. Register the exact backend callback URL with the provider.

## Database and persistence

- Use a managed or otherwise backed-up MongoDB deployment with TLS and network access restricted to application hosts.
- Create and verify the indexes described in [Monitoring operations](../backend/MONITORING_OPERATIONS.md) before receiving production traffic.
- Keep `backend/uploads` on persistent storage. If running more than one API instance, use shared storage for avatars or migrate the upload implementation to object storage so every instance can serve the same files.
- Keep MongoDB sessions enabled and ensure the database is reachable from every API instance.

## Monitoring workers and scaling

The HTTP health-check scheduler uses MongoDB leases to coordinate work across API replicas. Configure `MONITOR_JOB_CONCURRENCY` and `MONITOR_JOB_LEASE_MS` based on resource limits and request timeouts. The lease must exceed `POLL_TOTAL_TIMEOUT_MS` by at least five seconds.

SSL/domain checks use a bounded per-process pool but do not use a distributed lease. Multiple API replicas may perform duplicate SSL checks for the same monitor. Account for this when scaling; the total possible SSL concurrency is `SSL_CHECK_CONCURRENCY` multiplied by the number of API instances. See the operations guide for retention behavior, scheduler logs, and troubleshooting.

## Release checklist

1. Set production secrets and exact URLs in the hosting platform.
2. Ensure HTTPS is enabled at the public edge and proxy trust settings match the deployment topology.
3. Apply database index changes and any required migrations before deploying code that depends on them.
4. Deploy the backend and frontend build, then request `/api/health` and confirm the response reports MongoDB as connected.
5. Verify account verification email delivery, login/session cookies, monitor checks, notifications, and avatar persistence.
