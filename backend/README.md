# SiteWatch backend

The backend is an Express API with MongoDB persistence. Starting the server also starts scheduled HTTP health checks, SSL/domain checks, notification digest dispatch, and retention maintenance.

## Local setup

```sh
npm ci
```

Copy `.env.example` to `.env` and configure MongoDB, frontend URLs, cookie/session secrets, and SMTP credentials before starting the service:

```sh
cp .env.example .env
npm start
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. The API defaults to port `5000`; the health endpoint is `/api/health`.

## Commands

| Command                                                                | Purpose                                             |
| ---------------------------------------------------------------------- | --------------------------------------------------- |
| `npm start`                                                            | Start the API and background workers                |
| `npm test`                                                             | Run the Node.js test suite                          |
| `npm run migrate:monitor-owners`                                       | Backfill monitor ownership for an existing database |
| `npm run reconcile:daily-stats -- --start=YYYY-MM-DD --end=YYYY-MM-DD` | Reconcile daily statistics for a date range         |
| `npm run optimize:monitor-storage`                                     | Apply the monitor storage/index optimization        |

Read [Monitoring operations](MONITORING_OPERATIONS.md) before production rollout or database maintenance. See the [deployment guide](../docs/DEPLOYMENT.md) for production settings and the [project README](../README.md) for application features and local setup.
