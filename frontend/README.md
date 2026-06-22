# DB Backup Console — Frontend

Production React + TypeScript admin UI for the Enterprise Database
Backup / Restore / Import / Export platform.

## Stack

- **Vite** + **React 18** + **TypeScript**
- **React Router v6** for routing + protected routes
- **TanStack Query** for server state / caching
- **Axios** with auth interceptor (Bearer token + automatic 401 → refresh)
- **Zustand** (persisted) for the auth store
- **Tailwind CSS** for styling — sidebar + topbar enterprise dashboard layout

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173 (proxies /api → http://localhost:4000)
```

Other scripts:

```bash
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

The dev server proxies `/api` to the backend at `http://localhost:4000`
(see `vite.config.ts`). The backend API base path is `/api/v1`.

## Authentication

- `POST /auth/login` returns `{ accessToken, user }`; the refresh token is set
  as an httpOnly cookie by the backend.
- The access token is held in a persisted Zustand store and attached to every
  request via an Axios request interceptor.
- On a `401`, the response interceptor calls `POST /auth/refresh` once
  (de-duped), retries the original request, and falls back to `/login` if the
  refresh fails.
- `permissions: string[]` from `GET /me` drives nav-item and action visibility
  through `<PermissionGate>` and `<ProtectedRoute permission="…">`. The `*`
  permission acts as a super-user wildcard.

## Live jobs (SSE + polling fallback)

The job drawer (`src/pages/jobs/JobDrawer.tsx`) uses `useJobStream`, which
prefers the SSE endpoint `GET /jobs/:id/stream` and automatically falls back to
polling `GET /jobs/:id` every 2s if the stream errors. Because `EventSource`
cannot send headers, the access token is passed as an `access_token` query
param to the stream endpoint.

## Project structure

```
src/
  components/      Reusable UI (Layout, Sidebar, Topbar, Modal, Table, Button,
                   Input, Select, Badge, Card, StatusBadge, Drawer, Menu,
                   Toast, ProtectedRoute, PermissionGate, …)
  hooks/           TanStack Query hooks (useServers, useBackups, useJobs,
                   useSchedules, useAudit, useUsers, useNotifications, useAuth)
  lib/             api.ts (axios + interceptors), format/cn helpers
  pages/           One folder/file per route (Login, Dashboard, Servers,
                   Backups, Jobs, Schedules, Import/Export, Audit, Users)
  store/           auth.ts (Zustand)
  types.ts         Shared API/domain types
```

## Docker

Multi-stage build (Node build → nginx serve):

```bash
docker build -t dbbackup-frontend .
docker run -p 8080:80 dbbackup-frontend
```

`nginx.conf` serves the SPA (history-fallback to `index.html`) and proxies
`/api/` to the backend service named `api` on port `4000` (adjust the
`proxy_pass` host to match your compose service). SSE proxying is configured
with buffering disabled.
```
