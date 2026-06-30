FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# ---------------------------------------------------------------------------
# deps — install dengan semua workspace package.json
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# build — butuh root package.json agar bun tahu workspace @wealth/db
# ---------------------------------------------------------------------------
FROM base AS build
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
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
# runtime — minimal image, bundle + native deps
# ---------------------------------------------------------------------------
FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/packages/db/migrations ./migrations

ENV NODE_ENV=production
EXPOSE 3011
CMD ["bun", "run", "dist/index.js"]
