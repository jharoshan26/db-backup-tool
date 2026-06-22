# DB Backup Tool — Enterprise Database Backup / Restore / Import / Export Platform

A production-grade, multi-tenant platform to manage many database servers (MySQL, MariaDB,
PostgreSQL) and run **backups, restores, exports, imports, clones/migrations**, on demand or on a
schedule — with JWT auth, RBAC, encrypted credentials, background job processing, live progress,
tamper-evident audit logging, notifications, and S3 storage.

> Full design (architecture, schema, security, queue, audit, deployment, sequence diagrams):
> **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

## Features

| Area | Capability |
|---|---|
| Engines | MySQL, MariaDB, PostgreSQL (pluggable adapter layer) |
| Operations | Backup, Restore, Export (CSV/Excel/SQL), Import (CSV/Excel), Clone/Migrate |
| Scheduling | Cron-based scheduled backups with retention policies |
| Security | JWT (access + rotating refresh), RBAC, envelope-encrypted credentials (AES-256-GCM) |
| Multi-tenant | Tenant-scoped isolation across every resource |
| Async | BullMQ on Redis — one queue per job class, retries, dead-letter |
| Observability | Live progress via SSE, structured logs, health/readiness probes |
| Audit | Append-only, hash-chained (tamper-evident) audit log + chain verification |
| Storage | Local FS or S3/MinIO (streamed, content-addressed, checksummed) |
| Notifications | In-app + optional email (SMTP) |

## Architecture at a glance

A stateless **control plane** (API) and an elastic **data plane** (workers) communicate only via a
durable queue (Redis/BullMQ) and a shared metadata DB (PostgreSQL). Large data streams directly
between target databases and object storage — never through the API.

```
React UI ──► API (stateless, N replicas) ──► Postgres (metadata) + Redis (queues)
                          │                         ▲
                          ▼                         │ progress (SSE)
                   BullMQ queues ──► Workers (elastic) ──► target DBs + S3
                          ▲
                   Scheduler (cron → repeatable jobs)
```

Components (one image, three entrypoints):
- `dist/server.js` — REST API + SSE
- `dist/worker.js` — job processors (backup/restore/export/import/clone)
- `dist/scheduler.js` — materializes schedules into repeatable jobs + retention

## Quick start (Docker)

```bash
cp .env.example .env          # then edit secrets (JWT, CREDENTIAL_MASTER_KEY, ...)
# generate a real master key:  openssl rand -base64 32
docker compose up --build
```

- Frontend:  http://localhost:8080
- API:       http://localhost:4000/api/v1  (health: `/health`, ready: `/ready`)
- MinIO console: http://localhost:9001 (minioadmin / minioadmin)

Bootstrap the first tenant + owner via the UI (Register) or:

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"tenantName":"Acme","email":"admin@acme.com","password":"ChangeMe123!"}'
```

## Local development

```bash
# Infra only
docker compose up postgres redis minio -d

npm install
cp .env.example .env
npx prisma migrate deploy        # apply schema
npm run db:seed                  # demo tenant: admin@example.com / ChangeMe123!

npm run dev:api                  # API on :4000
npm run dev:worker               # workers
npm run dev:scheduler            # scheduler

cd frontend && npm install && npm run dev   # UI on :5173 (proxies /api → :4000)
```

## Configuration

All config is environment-driven (12-factor). See [`.env.example`](.env.example). Key variables:

- `DATABASE_URL`, `REDIS_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `CREDENTIAL_MASTER_KEY` — base64 32-byte KEK for credential envelope encryption (**required in prod**; back with KMS/Vault)
- `STORAGE_DRIVER` = `local | s3` (+ `S3_*`)
- `WORKER_CONCURRENCY`, `SMTP_*`

## Security notes

- Target DB passwords are never stored in plaintext — each is encrypted with a per-credential DEK,
  itself wrapped by the master KEK (`src/lib/crypto.ts`). Plaintext exists only in worker memory
  during a dump/restore and is never logged or returned by the API.
- Dump/restore tools receive secrets via environment (`MYSQL_PWD`/`PGPASSWORD`), never argv, and
  arguments are passed as arrays (no shell interpolation).
- RBAC permissions gate every mutating route; audit entries are hash-chained and verifiable
  (`GET /api/v1/audit/verify`).

## Project layout

```
src/
  api/            Express app, routes, error handling
  auth/           JWT, password hashing, RBAC, permissions, middleware
  audit/          tamper-evident hash-chained audit log
  db/adapters/    MySQL/MariaDB + PostgreSQL adapters (dump/restore/query/stream)
  lib/            config, logger, prisma, redis, crypto, storage (local/s3), hashing
  modules/        servers, jobs, notifications, tenancy/bootstrap
  queue/          BullMQ queues, job types, progress pub/sub
  scheduler/      schedule manager, cron processor, retention
  worker/         job processors
  server.ts | worker.ts | scheduler.ts   process entrypoints
prisma/           schema + migrations + seed
frontend/         React + TS admin UI (Vite, Tailwind, TanStack Query)
docs/             ARCHITECTURE.md
```

## Scripts

| Command | Description |
|---|---|
| `npm run build` | Compile TS → `dist/` (with path-alias rewrite) |
| `npm run typecheck` | Type-check without emit |
| `npm run dev:api` / `dev:worker` / `dev:scheduler` | Dev with hot reload |
| `npm run prisma:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | Seed a demo tenant + owner |

## License

MIT
