# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter @dentweb/api... \
 && pnpm --filter @dentweb/shared-types build && pnpm --filter @dentweb/database build && pnpm --filter @dentweb/api build \
 && pnpm deploy --filter @dentweb/api --prod --legacy /out \
 && cp -r apps/api/dist /out/dist \
 && mkdir -p /out/db && cp -r packages/database/migrations /out/db/migrations

FROM node:22-bookworm-slim AS runtime
# ffmpeg/ffprobe: production QC, cover frames and reference-video analysis.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
RUN useradd --system --uid 10001 dentweb && mkdir -p /app/.data/storage && chown -R dentweb /app/.data
COPY --from=build /out ./
USER dentweb
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
