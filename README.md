# Wealth Checker

Rebuild dari Google Sheets Template ke Aplikasi Web/Mobile — Personal finance tracker dengan level kebebasan finansial (0–6).

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js (PWA) |
| Backend API | Hono.js on Bun |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better Auth |
| Cache / Job Queue | Redis + BullMQ |
| Deploy | Docker + GitHub Actions |

## Struktur Monorepo

```
wealth-checker/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Hono.js backend
├── packages/
│   └── db/           # Drizzle schema + migrations
├── docs/             # PRD & task breakdown
└── docker-compose.yml
```

## Setup Development

```bash
# Copy env
cp .env.example .env

# Install dependencies
bun install

# Start database
docker compose up -d postgres redis

# Run migrations
bun run db:migrate

# Start dev servers
bun run dev
```

## Ports (Production)

| Service | Port |
|---------|------|
| Web (Next.js) | 3010 |
| API (Hono.js) | 3011 |
| PostgreSQL | 5433 |
| Redis | 6380 |
