# Architecture, ERD & Deployment Runbook

**Fase 4 Sprint 28 deliverable** — this document is the "final" technical reference for the system as of Fase 4 (Sprint 24-28): system architecture, entity-relationship diagram (household-centric), and the production deployment runbook including the new `worker` process and notification secrets. It complements [`API.md`](./API.md) (endpoint-level reference) and [`STAGING.md`](./STAGING.md) (manual QA environment).

---

## 1. System Architecture

```mermaid
graph TB
    subgraph Client
        WebApp["Next.js 16 Web App<br/>(apps/web)"]
        SW["Service Worker<br/>(public/sw.js)"]
    end

    subgraph "API Container (256MB limit)"
        Hono["Hono.js on Bun<br/>(apps/api/src/index.ts)"]
        MW["Middleware chain<br/>requireAuth -> resolveHousehold -> requireRole"]
        Routes["Route handlers<br/>(accounts, transactions, wealth,<br/>analytics, export, notifications, households, ...)"]
        Services["Service layer<br/>(wealth.ts, analytics.ts, reportData.ts,<br/>pdfReport.ts, excelReport.ts, notificationScheduler.ts, household.ts)"]
    end

    subgraph "Worker Container (128MB limit)"
        BullWorker["BullMQ Worker<br/>(apps/api/src/worker.ts)"]
        Reconcile["Boot-time reconciliation:<br/>re-upsertReminderJob for all<br/>reminderEnabled=true users"]
    end

    subgraph "Data Layer"
        PG[("PostgreSQL 17<br/>wealth_postgres · 256MB limit")]
        Redis[("Redis 7<br/>wealth_redis · 64MB limit<br/>BullMQ queue + export rate-limit keys")]
    end

    subgraph "Push Delivery (adapter pattern, lib/push/)"
        WebPush["web-push adapter<br/>(VAPID, active)"]
        FCM["FCM adapter<br/>(firebase-admin, stub —<br/>no-op until credentials set)"]
        PushSvc(["Browser Push Service /<br/>FCM/APNs (external)"])
    end

    WebApp -- "fetch, credentials: include,<br/>X-Household-Id header" --> Hono
    WebApp -- "PushManager.subscribe()" --> SW
    SW -- "POST /notifications/subscribe" --> Hono
    Hono --> MW --> Routes --> Services
    Services -- "Drizzle ORM" --> PG
    Services -- "rate limit SET NX,<br/>BullMQ job enqueue" --> Redis
    BullWorker -- "consume repeatable jobs" --> Redis
    BullWorker -- "query today's transactions" --> PG
    BullWorker -- "sendPush()" --> WebPush & FCM
    WebPush --> PushSvc
    FCM --> PushSvc
    PushSvc -. "push event" .-> SW
    Reconcile -.-> BullWorker
```

**Key architectural decisions (and why):**

| Decision | Rationale |
|---|---|
| BullMQ + Redis for reminders (not cron polling) | Per-user repeatable job (`jobId = userId`) with a `tz` field gives exact per-user local-time delivery without custom timezone bucketing logic, and scales to any number of users without a growing polling loop. |
| Separate `worker` container/process | Keeps the cron/push workload off the request-serving `api` process — a slow push delivery never blocks HTTP responses, and the two containers can be scaled/restarted independently. |
| Push adapter pattern (`lib/push/types.ts`) | `sendPush()` dispatches by `platform` column; `web-push` (VAPID) is the only *active* adapter today (no Flutter mobile app in this repo), but `fcm.ts` is fully wired and simply no-ops until FCM credentials are set — adding mobile push later needs zero schema/route changes. |
| `pdf-lib` + `exceljs` over Puppeteer for exports | Headless Chromium needs 300-500MB+ RAM on its own — the `api` container is capped at **256MB**. Both chosen libraries are pure-JS, no native binary, and run comfortably inside that budget even under concurrent export requests. |
| `households`/`household_members` + `household_id` on 9 data tables (Sprint 27) | Enables family/multi-user sharing without duplicating financial data per member; `userId`/`createdBy` is preserved on every row for attribution even after `household_id` becomes the access-control boundary. |
| `resolveHousehold` re-validates membership from DB on every request (no session-cached role) | The `X-Household-Id` header is client-supplied and therefore untrusted input — every request re-checks `household_members` before honoring it, closing the horizontal-privilege-escalation class of bug (see [households.e2e.test.ts](../apps/api/src/routes/households.e2e.test.ts)). |

---

## 2. Entity-Relationship Diagram (Final — Fase 4)

`households` is the new central entity: 9 of the 10 original data tables now hang off `household_id` instead of `user_id` directly. `user_profile` and `retirement_assumptions` remain per-individual by design (retirement planning is personal even inside a shared household).

```mermaid
erDiagram
    USER ||--o{ HOUSEHOLD_MEMBER : "belongs to N households"
    USER ||--o| USER_PROFILE : "has (personal, not shared)"
    USER ||--o| RETIREMENT_ASSUMPTIONS : "has (personal, not shared)"
    USER ||--o{ NOTIFICATION_SUBSCRIPTION : "registers devices"
    USER ||--o| NOTIFICATION_PREFERENCE : "has"
    USER ||--o{ HOUSEHOLD_INVITE : "sends (invited_by)"

    HOUSEHOLD ||--o{ HOUSEHOLD_MEMBER : "has members"
    HOUSEHOLD ||--o{ HOUSEHOLD_INVITE : "has pending invites"
    HOUSEHOLD ||--o{ ACCOUNT : "owns"
    HOUSEHOLD ||--o{ TRANSACTION : "owns"
    HOUSEHOLD ||--o{ DEBT : "owns"
    HOUSEHOLD ||--o{ RECEIVABLE : "owns"
    HOUSEHOLD ||--o{ LIQUID_ASSET : "owns"
    HOUSEHOLD ||--o{ FIXED_ASSET : "owns"
    HOUSEHOLD ||--o{ WEALTH_SNAPSHOT : "owns"
    HOUSEHOLD ||--o{ DREAM_GOAL : "owns"
    HOUSEHOLD ||--o{ BUDGET_PLAN : "owns"

    ACCOUNT ||--o{ TRANSACTION : "account_id / to_account_id"
    ACCOUNT ||--o{ DREAM_GOAL : "optional account_id"
    DEBT ||--o{ TRANSACTION : "related_entity_id (bayar_utang)"
    RECEIVABLE ||--o{ TRANSACTION : "related_entity_id (penerimaan_piutang)"
    LIQUID_ASSET ||--o{ TRANSACTION : "related_entity_id (jual_investasi)"
    FIXED_ASSET ||--o{ TRANSACTION : "related_entity_id (jual_barang)"

    WEALTH_LEVEL_REFERENCE ||--o{ BUDGET_ALLOCATION_REFERENCE : "seed data, joined by level"

    HOUSEHOLD {
        uuid id PK
        varchar nama
        timestamp created_at
    }
    HOUSEHOLD_MEMBER {
        uuid household_id PK,FK
        text user_id PK,FK
        enum role "owner | editor | viewer"
        timestamp joined_at
    }
    HOUSEHOLD_INVITE {
        uuid id PK
        uuid household_id FK
        varchar invited_email
        enum role
        varchar token UK
        text invited_by_user_id FK
        enum status "pending | accepted | revoked"
        timestamp expires_at
    }
    USER {
        text id PK
        text email UK
        text name
    }
    USER_PROFILE {
        text id PK,FK
        date tanggal_lahir
        int rencana_usia_pensiun
        int rencana_usia_warisan
        int anggota_keluarga_ditanggung
        numeric pemasukan_bulanan_rata_rata
        numeric pengeluaran_bulanan_rata_rata
    }
    RETIREMENT_ASSUMPTIONS {
        text user_id PK,FK
        numeric inflasi_persen "default 5"
        numeric return_investasi_persen "default 8"
        boolean use_advanced_formula
    }
    NOTIFICATION_SUBSCRIPTION {
        uuid id PK
        text user_id FK
        enum platform "web | android | ios"
        text endpoint UK
        text p256dh
        text auth
        boolean is_active
    }
    NOTIFICATION_PREFERENCE {
        text user_id PK,FK
        boolean reminder_enabled
        time reminder_time "default 20:00"
        varchar timezone "default Asia/Jakarta"
        timestamp last_notified_at
    }
    ACCOUNT {
        uuid id PK
        text user_id FK "createdBy"
        uuid household_id FK
        varchar nama
        numeric saldo_cache
        boolean is_active
    }
    TRANSACTION {
        uuid id PK
        text user_id FK "createdBy"
        uuid household_id FK
        date tanggal
        enum type "11 kinds, see API.md"
        varchar kategori
        uuid account_id FK
        uuid related_entity_id "polymorphic FK: debt/receivable/asset"
        numeric nominal
        numeric untung_rugi
    }
    DEBT {
        uuid id PK
        text user_id FK
        uuid household_id FK
        varchar pemberi_utang
        enum tipe "utang_biasa | kartu_kredit"
        numeric saldo_awal
        numeric sisa_saldo
    }
    RECEIVABLE {
        uuid id PK
        text user_id FK
        uuid household_id FK
        varchar peminjam
        numeric saldo_awal
        numeric sisa_saldo
    }
    LIQUID_ASSET {
        uuid id PK
        text user_id FK
        uuid household_id FK
        varchar nama_aset
        numeric jumlah
        numeric harga_beli_rata_rata "moving average cost"
    }
    FIXED_ASSET {
        uuid id PK
        text user_id FK
        uuid household_id FK
        varchar nama_aset
        numeric jumlah
        numeric harga_beli_rata_rata
    }
    WEALTH_SNAPSHOT {
        uuid id PK
        text user_id FK
        uuid household_id FK
        date tanggal
        numeric total_aset
        numeric total_utang
        numeric kekayaan_bersih
    }
    DREAM_GOAL {
        uuid id PK
        text user_id FK
        uuid household_id FK
        varchar nama_goal
        uuid account_id "nullable"
        numeric target_nominal
        numeric saldo_manual "used only if account_id is null"
    }
    BUDGET_PLAN {
        uuid id PK
        text user_id FK
        uuid household_id FK
        numeric rencana_pemasukan_bulanan
        varchar bulan_tahun "YYYY-MM"
    }
    WEALTH_LEVEL_REFERENCE {
        int level PK "0-6"
        varchar nama_level
        text diagnosa
        text saran
    }
    BUDGET_ALLOCATION_REFERENCE {
        int id PK
        int level
        varchar kategori_1_nama
        numeric kategori_1_persen
    }
```

**Notes on the diagram:**
- `TRANSACTION.related_entity_id` is a **polymorphic** reference (no DB-level FK constraint) — it points at `debts`, `receivables`, `liquid_assets`, or `fixed_assets` depending on `type`; the application layer resolves which table based on the enum value. This is why `idx_tx_household_related_entity` (Sprint 28, migration `0014`) is a plain composite index rather than a foreign key.
- Every household-scoped table keeps **both** `user_id` (who created/last-modified the row — attribution only) and `household_id` (who can see/edit it — access control). This was a deliberate Sprint 27 design choice so that removing a member from a household doesn't orphan or delete their historical contributions.
- `wealth_level_reference` / `budget_allocation_reference` are global seed data (not scoped to any household or user).

---

## 3. Data Model Evolution (Fase 1-4)

```mermaid
graph LR
    F1["Fase 1-3<br/>10 tabel inti, semua user_id"] -->|"Sprint 24"| F4a["+ notification_subscriptions<br/>+ notification_preferences"]
    F4a -->|"Sprint 25"| F4b["(no schema change —<br/>export reads existing tables)"]
    F4b -->|"Sprint 26"| F4c["+ retirement_assumptions"]
    F4c -->|"Sprint 27 migration 0012"| F4d["+ households / household_members /<br/>household_invites<br/>+ household_id NULLABLE on 9 tables"]
    F4d -->|"backfillHouseholds.ts"| F4e["Backfill: 1 household per<br/>existing user, owner role"]
    F4e -->|"Sprint 27 migration 0013"| F4f["household_id NOT NULL + indexes<br/>userId-based access control retired"]
    F4f -->|"Sprint 28 migration 0014"| F4g["Retire dead idx_tx_user_type,<br/>add idx_tx_household_type +<br/>idx_tx_household_related_entity"]
```

---

## 4. Performance Audit (Sprint 28)

Reviewed every index on the 9 household-scoped tables against the query patterns introduced across Sprint 24-27 (see `packages/db/src/schema/*.ts` for the full annotated list). Findings:

- **Dead index removed:** `idx_tx_user_type` (`transactions.user_id, type`) — no query filters transactions by `(user_id, type)` anymore since Sprint 27 moved every route to `household_id`-based scoping. Dropped in migration `0014`.
- **New composite indexes added** (migration `0014`):
  - `idx_tx_household_type` (`household_id, type`) — serves `essential-expenses`, `income`, and both asset summary services' realized P/L aggregation, none of which filter by date range.
  - `idx_tx_household_related_entity` (`household_id, related_entity_id`) — serves the "still has related transactions?" guard before deleting a debt/receivable/asset (`debts.ts`, `assets.ts`); previously an index scan on `household_id` followed by an in-memory filter.
- **Intentionally kept:** `idx_tx_user_tanggal` (`user_id, tanggal`) is still live — `notificationScheduler.ts`'s "does this user have a transaction today?" check is deliberately per-**user**, not per-household (a reminder is about *your own* logging habit even if you share a household with others), so this is not dead code despite most other indexes moving to `household_id`.
- **Unique-name guards migrated to household scope** (already done in migration `0013`, re-verified here): `accounts`, `liquid_assets`, `fixed_assets`, `debts`, `receivables` all moved their "no duplicate name" unique index from `(user_id, lower(nama))` to `(household_id, lower(nama))` — correct, since the "find-or-create by name" logic in `transactions.ts` now searches within the active household, not just the caller's own rows.
- **Materialized views — considered, not implemented.** The plan floats a materialized view for the heaviest analytics report. After review, the current data volumes (personal finance — hundreds to low-thousands of transactions per household, not millions) don't justify the added operational complexity (refresh triggers/cron, staleness window, extra migration surface) yet. `reportData.ts` already reuses the same aggregation functions as the live dashboard endpoints, so a materialized view would only optimize the export path specifically. **Recommendation:** revisit if/when a household's transaction count regularly exceeds ~50k rows or export P95 latency (see § Load Testing below) exceeds ~2s under realistic load — at that point, a materialized view refreshed nightly (or on-write via a lightweight trigger) covering `monthly-pl` and `budget-vs-actual` would be the highest-leverage next optimization.

---

## 5. Load Testing

**Script:** [`apps/api/src/scripts/loadTest.ts`](../apps/api/src/scripts/loadTest.ts) (`bun run --filter=@wealth/api loadtest`). Simulates `LOADTEST_CONCURRENCY` (default 100) independent users — each gets their own account (and therefore their own household, via the same auto-provisioning `resolveHousehold` uses for real users) — seeds a handful of transactions each, then fires 100 concurrent requests at:

- `GET /api/analytics/monthly-pl`, `/budget-vs-actual`, `/income` (heaviest read endpoints — several aggregation queries each)
- `GET /api/export/excel` and `/api/export/pdf` (heaviest endpoints overall — N queries + in-memory file generation per request)

It reports p50/p95/p99/max latency and error count per endpoint.

**⚠️ Where to run this — do NOT point it at shared staging or production.** [`STAGING.md`](./STAGING.md) already documents that the staging profile shares VPS resources with production; firing 100 concurrent requests at it would degrade real users' experience. Run it only against the ephemeral, isolated `docker-compose.e2e.yml` stack (same one CI uses) or an equivalent local/dedicated environment:

```bash
docker compose -f docker-compose.e2e.yml up -d --build
DATABASE_URL=postgresql://wealth:wealth_e2e_pass@localhost:5440/wealth_checker_e2e bun run db:migrate
LOADTEST_API_URL=http://localhost:4001 LOADTEST_CONCURRENCY=100 bun run apps/api/src/scripts/loadTest.ts
```

**Execution note for this Sprint 28 pass:** the sandboxed environment this documentation/tooling was authored in has no Docker/Postgres/Redis available, so the script above could be written and typechecked but **not actually executed against a live stack** in this session — it needs to be run once (by a maintainer, or in a future CI job) in an environment with Docker before its output can be cited as a real benchmark. Treat the thresholds below as the *targets to validate against*, not yet-measured results:

| Endpoint class | Target p95 (100 concurrent) | Rationale |
|---|---|---|
| Analytics reads (`monthly-pl`, `budget-vs-actual`, `income`) | < 500ms | Read-only aggregation queries over indexed `household_id` columns; should scale near-linearly with Postgres connection pool size, not request count, given the indexes audited in § 4. |
| Export (`excel`, `pdf`) | < 3s | Generates an in-memory file (multi-sheet workbook / multi-page PDF) on top of several aggregation queries — inherently heavier; the per-user rate limit (1/min) caps sustained concurrent load from any single user, so this measures worst-case simultaneous first-time exports across many *different* users/households. |
| Error rate | 0% at 100 concurrent | No endpoint here should degrade to errors under this load — a non-zero error rate points at connection pool exhaustion (`postgres` driver pool size) or the 256MB `api` container OOM-killing under export memory pressure, either of which would need follow-up before increasing concurrency further. |

If a future run shows the export container approaching its 256MB memory limit under concurrent load, the next steps (not yet needed) would be: lowering `RATE_LIMIT_WINDOW_SECONDS` further, adding a per-container concurrent-export semaphore, or moving export generation to the `worker` process (which already exists for BullMQ and has its own memory budget) instead of the request-serving `api` process.

---

## 6. Deployment Runbook

### 6.1 Environments

| Environment | Compose file | Ports (web/api/pg) | Purpose |
|---|---|---|---|
| Production | `docker-compose.yml` | `3010`/`3011`/`5433` | Live traffic. Deployed automatically by `deploy-production` job on every push to `main` (after `quality-gate` + `e2e-test` pass). |
| CI E2E (ephemeral) | `docker-compose.e2e.yml` | `4000`/`4001`/`5440` | Spun up and torn down by every CI run — also the recommended target for load testing (§5). |
| Staging (manual) | `docker-compose.staging.yml` | `4010`/`4011`/`5434` | On-demand manual QA on the same VPS — see [`STAGING.md`](./STAGING.md). Not part of any automated pipeline. |

### 6.2 Standard deploy (no risky migration)

The existing pipeline (`.github/workflows/deploy.yml`, `deploy-production` job) already does this correctly for ordinary changes — summarized here for reference:

1. `quality-gate`: lint, typecheck, unit tests, build web + api.
2. `e2e-test`: spins up `docker-compose.e2e.yml`, runs migrations, runs concurrency/wealth/**household isolation** (`households.e2e.test.ts`) regression suites + Playwright.
3. `deploy-production`: rsync code to the VPS, `docker compose build --no-cache`, bring up `postgres`+`redis`, run `bun run db:migrate` against production, then `docker compose up -d api web worker`, health-check `web` on port `3010`.

**Required production secrets** (`.env` on the VPS, not committed): alongside the pre-existing `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, etc., Fase 4 adds:

| Variable | Used by | Notes |
|---|---|---|
| `REDIS_PASSWORD` | `api`, `worker` | Redis was provisioned since Fase 1 infra but had **zero code using it** before Sprint 24 — this is the first real consumer. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | `api` (`lib/push/webPush.ts`) | Generate once with `bunx web-push generate-vapid-keys`; the public key is also needed client-side as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (build-time, `web` service). |
| `FCM_*` (project id / credentials) | `api` (`lib/push/fcm.ts`) | **Optional** — the FCM adapter no-ops if unset; only needed once/if a mobile app is added. |
| `WEB_APP_URL` | `api` (`routes/households.ts`) | Used to build the `inviteUrl` returned from `POST /households/invite` (e.g. `https://wealthchecker.example.com`). Falls back to `http://localhost:3010` if unset — **must** be set in production or invite links will be broken/unreachable for recipients. |

### 6.3 High-risk migration runbook — Sprint 27 household rollout

This is the rollout sequencing the Sprint 27 plan calls out explicitly (schema change touching 9 tables + access-control rewrite across the whole API) — documented here as the template for any similarly risky future migration, and as the actual plan followed for this one:

1. **Dry-run in staging first.** Bring up `docker-compose.staging.yml` with a copy of production data (`pg_dump`/`pg_restore` from production into the staging Postgres volume), then run migrations `0012` → `backfillHouseholds.ts` → `0013` against that copy. Verify `countRowsMissingHousehold()` (from `services/household.ts`) returns all-zero counts before proceeding, and manually smoke-test login + a few CRUD operations as an existing pre-Sprint-27 user.
2. **Schedule the production migration for low-traffic hours.** The additive migration (`0012`, nullable `household_id`) is safe to run anytime (no lock contention risk, no behavior change yet). The **enforcing** migration (`0013`, `NOT NULL` + constraint) should run during a low-traffic window since it takes a table lock briefly on 9 tables — small tables in this app's expected data volumes, but still worth scheduling deliberately rather than mid-peak.
3. **Order of operations for the actual cutover:**
   - Deploy code + run migration `0012` (additive — households/members/invites tables, nullable `household_id` columns). Old code paths still work unchanged (nothing reads `household_id` yet).
   - Run `bun run backfill:households` (idempotent — safe to re-run; creates one household per existing user, backfills all 9 tables' `household_id`).
   - Verify backfill completeness (`countRowsMissingHousehold` all zero) **before** proceeding — this is the go/no-go gate.
   - Run migration `0013` (`NOT NULL` + household-scoped indexes/unique constraints) and deploy the code that actually reads `household_id` for access control (`resolveHousehold`/`requireRole` middleware + all route query filters).
   - Verify with the `households.e2e.test.ts` regression suite (already wired into CI's `e2e-test` job) before/after — confirms household A can never see household B's data, `X-Household-Id` spoofing is rejected, and role enforcement (`viewer` blocked from mutations) works.
   - Only after the above is confirmed stable, ship the household-management **UI** (switcher, invite flow, `HouseholdSettings` page) — the plan deliberately sequences UI last so the backend access-control change is validated in isolation first.
4. **Rollback plan.** Because `0012`/`0013` are additive-then-constraining rather than destructive (no columns dropped, no data deleted), rollback is: revert the API/web deploy to the previous image tag (`docker compose up -d` with the prior build, or re-run the pipeline against the previous commit) while **leaving the schema migration in place** — the old code never read `household_id`, so it continues operating exactly as before purely off `user_id`, unaffected by the now-populated `household_id` columns sitting alongside it. A full schema rollback (dropping `household_id`/`households`/etc.) is intentionally avoided as a rollback strategy since it would delete the backfilled household memberships; if the feature needs to be fully reverted, do it by reverting the *application code* only, not the migration.

### 6.4 Worker process operational notes

- `worker` is a **separate long-running container** (not a cron-triggered one-off) running `apps/api/src/worker.ts` — it holds open BullMQ connections to Redis and processes reminder jobs as they fire.
- **Boot-time reconciliation:** every time `worker.ts` starts (deploy, restart, crash-recovery), it re-registers repeatable jobs for every user with `reminderEnabled=true` in the database. This means a Redis data loss event (e.g. `wealth_redis` volume wiped) self-heals on the next worker restart — no manual re-seeding of jobs needed.
- If `worker` is down but `api` is up, preference changes (`PATCH /notifications/preferences`) still save successfully (fail-soft, see `API.md` §11) — reminders simply won't fire until `worker` comes back and reconciles.
- Memory budget: `worker` is capped at 128MB (vs `api`'s 256MB) — it does no PDF/Excel generation, only DB queries + push payload construction, so this is comfortably sized based on current usage.
