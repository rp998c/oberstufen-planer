# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM node:22-alpine AS build
RUN corepack enable
# Fallback toolchain in case no prebuilt better-sqlite3 binary exists for the platform
RUN apk add --no-cache python3 make g++
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/abi-engine-bw/package.json packages/abi-engine-bw/
COPY packages/app-core/package.json packages/app-core/
# only the server and what it needs (not the Android app)
RUN pnpm install --frozen-lockfile --filter web...

COPY . .
RUN pnpm --filter web build \
	&& pnpm --filter web deploy --prod --legacy /out

# ---- runtime --------------------------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000 \
	DATA_DIR=/data \
	TZ=Europe/Berlin \
	MIGRATIONS_DIR=/app/drizzle
WORKDIR /app

COPY --from=build /out .
COPY docker/hash-password docker/reset-password /usr/local/bin/
RUN chmod +x /usr/local/bin/hash-password /usr/local/bin/reset-password \
	&& mkdir -p /data && chown node:node /data

# Starts as root only to hand /data to PUID:PGID (default 1000 = user "node"),
# then the app drops to that user (see scripts/drop-privileges.js).
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
	CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
