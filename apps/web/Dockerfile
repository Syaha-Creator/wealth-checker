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
# build — copy root node_modules (.bun store) + workspace symlinks
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json ./
COPY apps/web ./apps/web
COPY packages/db ./packages/db

# next.config.ts's rewrites() (output: "standalone") is resolved at build time —
# these values get baked into the compiled routes manifest, NOT re-read from the
# container's runtime environment. They MUST be passed as build args, matching
# whatever will be set at runtime via docker-compose.
ARG NEXT_PUBLIC_API_URL
ARG INTERNAL_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV INTERNAL_API_URL=${INTERNAL_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN bun run --filter='@wealth/web' build

# ---------------------------------------------------------------------------
# runtime — Next.js standalone (pakai Node, tidak butuh bun)
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
