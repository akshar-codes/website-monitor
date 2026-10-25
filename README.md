# Website Monitor

Website Monitor **v2.0.0** is a web application for checking website availability, tracking incidents, and reviewing endpoint response data. It includes a React frontend and an Express API backed by MongoDB.

## Features

- Scheduled HTTP health checks, incident tracking, and uptime/performance analytics.
- SSL certificate and domain expiry monitoring.
- Email and in-app notifications with per-user preferences.
- Subscription plans with monitor, polling interval, retention, and team limits.
- Administrator tools for users, subscriptions, upgrade requests, plan history, monitors, incidents, and audit logs. Admins do not have a subscription and cannot create personal monitors.
- Read-only, owner-scoped API access using API keys for eligible plans.
- Response snapshots on the ten newest checks per monitor. Response inspection is available to Pro and Enterprise users.

## Plans

| Plan       | Monitors | Minimum interval | Data retention | Team members |
| ---------- | -------: | ---------------: | -------------: | -----------: |
| Free       |        3 |        5 minutes |         7 days |            1 |
| Pro        |       25 |       30 seconds |        90 days |            5 |
| Enterprise | No limit |       30 seconds |       365 days |     No limit |

Enterprise retains the internal plan ID `unlimited` for compatibility with existing accounts and records.

## Requirements

- Node.js **24.16.0** (see `backend/package.json`).
- A reachable MongoDB instance.
- SMTP credentials for account verification and email notifications. A local mail catcher can be used during development.

## Local development

Install and configure the backend:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Edit `backend/.env`. Set `MONGO_URI`, `CORS_ORIGIN`, `CLIENT_URL`, SMTP settings, and independent values for `COOKIE_SECRET` and `SESSION_SECRET`. Generate a secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run the API in one terminal:

```powershell
cd backend
npm start
```

Install and run the frontend in a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

The frontend is available at `http://localhost:5173`. Vite proxies `/api` and `/uploads` to the backend at `http://localhost:5000`. The API health endpoint is `http://localhost:5000/api/health`.

## Development commands

Run commands from the relevant application directory.

| Directory  | Command                                                                | Description                                  |
| ---------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| `backend`  | `npm start`                                                            | Start the API and monitoring workers         |
| `backend`  | `npm test`                                                             | Run the Node.js test suite                   |
| `backend`  | `npm run optimize:monitor-storage`                                     | Apply the monitor storage/index optimization |
| `backend`  | `npm run reconcile:daily-stats -- --start=YYYY-MM-DD --end=YYYY-MM-DD` | Rebuild daily stats for a date range         |
| `frontend` | `npm run dev`                                                          | Start the Vite development server            |
| `frontend` | `npm run lint`                                                         | Run ESLint                                   |
| `frontend` | `npm run build`                                                        | Create a production build in `frontend/dist` |
| `frontend` | `npm run preview`                                                      | Preview the production build locally         |

GitHub Actions runs backend tests and frontend lint/build checks for pushes and pull requests. See [Contributing](CONTRIBUTING.md).

## Project layout

```text
backend/                 Express API, MongoDB models, workers, tests
  README.md               Backend setup and command reference
  src/config/             Environment, plans, permissions, integrations
  src/controllers/        HTTP request handlers
  src/routes/             API route definitions
  src/services/           Application and persistence logic
  src/workers/            Health-check scheduling and retention
  tests/                  Node.js test suite
  MONITORING_OPERATIONS.md Worker operations and storage lifecycle
frontend/                React application built with Vite
  README.md               Frontend setup and command reference
docs/                    Deployment guidance
.github/workflows/       Continuous integration
```

## Documentation

- [Deployment guide](docs/DEPLOYMENT.md)
- [Contributing and CI](CONTRIBUTING.md)
- [Monitoring operations](backend/MONITORING_OPERATIONS.md)
