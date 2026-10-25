# Contributing

## Before opening a pull request

1. Keep changes focused and update documentation when behavior or configuration changes.
2. From `backend/`, run `npm test`.
3. From `frontend/`, run `npm run lint` and `npm run build`.
4. Describe behavior changes and any deployment or data migration steps in the pull request.

## GitHub Actions

The `CI` workflow runs for pushes, pull requests, and manual dispatches. It uses Node.js 24.16.0 and runs two independent jobs:

- **Backend:** installs from `backend/package-lock.json` with `npm ci`, then runs `npm test`.
- **Frontend:** installs from `frontend/package-lock.json` with `npm ci`, then runs `npm run lint` and `npm run build`.

The workflow needs no repository secrets or MongoDB service. Integration tests replace the session boundary and do not connect to the configured MongoDB URL.

## Working with plans and permissions

- Backend plan limits and display names are defined in `backend/src/config/plans.js`.
- Plan identifiers and role identifiers are defined in `backend/src/config/constants.js`.
- Role permissions are defined in `backend/src/config/permissions.js`.
- The frontend reads the plan catalog from the backend; avoid duplicating plan pricing and limits in UI code.
- The displayed Enterprise plan retains the internal ID `unlimited` for existing user records and upgrade history.

## Configuration changes

Update `backend/.env.example` and the [deployment guide](docs/DEPLOYMENT.md) when adding required environment variables. Never commit `.env` files, credentials, API keys, or real user data.
