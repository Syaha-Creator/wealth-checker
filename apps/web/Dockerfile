FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# ---------------------------------------------------------------------------
# deps
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# build — disable Turbopack (Next.js 16 default), gunakan webpack
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/web ./apps/web
COPY packages/db ./packages/db

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Paksa webpack, bukan Turbopack, agar monorepo path resolution benar
ENV TURBOPACK=0

RUN bun run --filter='@wealth/web' build

# ---------------------------------------------------------------------------
# runtime — Next.js standalone
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3010
ENV PORT=3010
CMD ["node", "apps/web/server.js"]
