# Staging Environment (Manual QA)

A lightweight, **persistent** staging profile for manual QA before merging/deploying to `main` — it runs on the same VPS (`velrox-vps`) as production, using different ports and its own database, so it can run alongside the production stack without conflicts.

**Scope note:** this is deliberately lightweight — it is a `docker-compose.staging.yml` profile on the existing VPS, **not** a separate VPS or subdomain. It is also **manual/on-demand only** and is **not** wired into any CI job (unlike the ephemeral `docker-compose.e2e.yml` stack, which CI creates and tears down automatically on every run). Bring staging up/down yourself when you need it.

## Ports & services

| Service | Container | Port (host) | Notes |
|---|---|---|---|
| PostgreSQL | `wealth_postgres_staging` | `5434` (→ 5432) | Own volume `wealth_staging_postgres_data`, own DB `wealth_checker_staging` |
| API | `wealth_api_staging` | `4011` | |
| Web | `wealth_web_staging` | `4010` | |

These are distinct from both production (`3010`/`3011`/`5433`) and the CI-only E2E stack (`4000`/`4001`/`5440`), so all three can coexist on the VPS.

## First-time setup on `velrox-vps`

1. SSH into the VPS (see the `velrox-vps` alias) and go to wherever you keep the checked-out repo for manual staging use (this can be a separate checkout from the production deploy directory, or the same one on a different branch/worktree — just make sure it has the code you want to QA).

2. Copy the example env file and fill in real values:

   ```bash
   cp .env.staging.example .env.staging
   # edit .env.staging — set POSTGRES_PASSWORD, BETTER_AUTH_SECRET, etc.
   ```

   `.env.staging` is git-ignored — never commit real secrets.

3. Bring the stack up (builds images on first run):

   ```bash
   docker compose -f docker-compose.staging.yml up -d --build
   ```

4. Wait for Postgres to be healthy, then run migrations against the **staging** database:

   ```bash
   DATABASE_URL=postgresql://wealth:<POSTGRES_PASSWORD>@localhost:5434/wealth_checker_staging \
     bun run db:migrate
   ```

   (Use the same `POSTGRES_PASSWORD` you set in `.env.staging`.)

5. Open `http://localhost:4010` (or `http://<vps-host>:4010` if reachable externally) to use the staging web app. The API is at `http://localhost:4011`.

## Day-to-day usage

- **Bring up / rebuild after pulling new code:**

  ```bash
  docker compose -f docker-compose.staging.yml up -d --build
  ```

- **Run new migrations** (whenever `packages/db/migrations` changes):

  ```bash
  DATABASE_URL=postgresql://wealth:<POSTGRES_PASSWORD>@localhost:5434/wealth_checker_staging \
    bun run db:migrate
  ```

- **View logs:**

  ```bash
  docker compose -f docker-compose.staging.yml logs -f api-staging
  docker compose -f docker-compose.staging.yml logs -f web-staging
  ```

- **Stop the stack** (keeps data — safe to bring back up later):

  ```bash
  docker compose -f docker-compose.staging.yml down
  ```

- **Stop and wipe staging data** (fresh database next time you bring it up):

  ```bash
  docker compose -f docker-compose.staging.yml down -v
  ```

## Notes / caveats

- Staging shares the VPS's resources with production — it's meant for quick manual verification, not load testing.
- If you need staging reachable from outside `localhost` on the VPS (e.g. to test from your own browser), open/forward ports `4010`/`4011` as appropriate for your network setup, and update `ADDITIONAL_TRUSTED_ORIGINS` / `NEXT_PUBLIC_API_URL` in `.env.staging` to match the externally-reachable origin before rebuilding (`NEXT_PUBLIC_API_URL` is baked in at build time — see the comment in `docker-compose.staging.yml`).
- There is no automated CI deploy for this environment and no plan to add one — that's an intentional scope decision, not a gap. Automated staging deploy and a fully separate staging VPS/domain remain explicitly out of scope.
