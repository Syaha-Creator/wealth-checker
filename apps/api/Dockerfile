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
# build — output di apps/api/dist agar module resolution benar saat runtime
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY package.json ./
COPY apps/api ./apps/api
COPY packages/db ./packages/db

WORKDIR /app/apps/api
RUN bun build src/index.ts \
      --outdir dist \
      --target bun \
      --minify \
      --external drizzle-orm \
      --external postgres \
      --external better-auth

# ---------------------------------------------------------------------------
# runtime — WORKDIR di workspace agar node resolution temukan node_modules
# ---------------------------------------------------------------------------
FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app/apps/api

COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/packages/db/migrations /app/migrations

ENV NODE_ENV=production
EXPOSE 3011
CMD ["bun", "run", "dist/index.js"]
