# Website Monitor frontend

The frontend is a React 19 single-page application built with Vite. It uses the relative `/api` path for backend requests and the backend's `/uploads` path for local avatar files. The Vite development server proxies both paths to `http://localhost:5000`.

## Commands

```sh
npm ci
npm run dev
```

Other scripts:

```sh
npm run lint
npm run build
npm run preview
```

`npm run build` writes the static production app to `dist/`. Configure the production host to serve the SPA and proxy `/api/*` and `/uploads/*` to the backend.

For full local setup, backend configuration, deployment, and CI instructions, see the [project README](../README.md), [deployment guide](../docs/DEPLOYMENT.md), and [contributing guide](../CONTRIBUTING.md).
