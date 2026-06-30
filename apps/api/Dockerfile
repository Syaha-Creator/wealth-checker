FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app

# Install dependencies (semua workspace package.json)
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/db ./packages/db
COPY apps/api ./apps/api

ENV NODE_ENV=production
EXPOSE 3011
CMD ["bun", "run", "apps/api/src/index.ts"]
