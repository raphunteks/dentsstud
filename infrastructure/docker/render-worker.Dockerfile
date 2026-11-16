# syntax=docker/dockerfile:1.7
# Remotion render worker: pulls jobs from BullMQ (Upstash), talks to the API only via /internal + WORKER_TOKEN.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/render-worker ./apps/render-worker
RUN pnpm install --frozen-lockfile --filter @dentweb/render-worker... \
 && pnpm --filter @dentweb/motion-schema build && pnpm --filter @dentweb/remotion-compositions build && pnpm --filter @dentweb/render-worker build \
 && pnpm deploy --filter @dentweb/render-worker --prod --legacy /out \
 && cp -r apps/render-worker/dist /out/dist

FROM node:22-bookworm-slim AS runtime
# Debian Chromium + fonts for Remotion; ffmpeg ships inside @remotion/compositor.
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-noto-core fonts-noto-color-emoji ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium
WORKDIR /app
RUN useradd --system --uid 10002 --create-home renderer
COPY --from=build /out ./
USER renderer
CMD ["node", "dist/index.js"]
