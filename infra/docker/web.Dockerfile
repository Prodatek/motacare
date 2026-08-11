# ==============================================
# MOTACARE — Web (Next.js) Dockerfile
# Multi-stage: development | production
# ==============================================

# --- Base Stage ---
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install root dependencies (for workspace/turbo)
COPY package.json turbo.json ./
COPY tsconfig.base.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/ui-components/package.json ./packages/ui-components/
COPY apps/web/package.json ./apps/web/

RUN npm install --workspace=apps/web --workspace=packages/shared-types --workspace=packages/shared-utils --workspace=packages/ui-components

# --- Development Stage ---
FROM base AS development
WORKDIR /app

COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY packages/ui-components ./packages/ui-components
COPY apps/web ./apps/web

EXPOSE 3005

CMD ["npm", "run", "dev", "--workspace=apps/web"]

# --- Builder Stage ---
FROM base AS builder
WORKDIR /app

COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY packages/ui-components ./packages/ui-components
COPY apps/web ./apps/web

RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=packages/shared-utils
RUN npm run build --workspace=apps/web

# --- Production Stage ---
# Next.js's `output: 'standalone'` (see apps/web/next.config.js) produces
# a self-contained .next/standalone/ folder that already includes a
# pruned node_modules with everything actually needed at runtime — no
# need to separately copy/install shared-types, shared-utils, or
# ui-components here, unlike the backend services' Dockerfiles.
# .next/static and public/ are NOT included in standalone output and
# must be copied in manually — this is documented Next.js behavior,
# not an oversight.
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3005
ENV HOSTNAME=0.0.0.0

# Standalone output mirrors the monorepo path structure (apps/web/...)
# because of outputFileTracingRoot in next.config.js.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 motacare
USER motacare

EXPOSE 3005

CMD ["node", "apps/web/server.js"]
