# ==============================================
# MOTACARE — Subscription Service Dockerfile
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
COPY apps/subscription-service/package.json ./apps/subscription-service/

RUN npm install --workspace=apps/subscription-service --workspace=packages/shared-types --workspace=packages/shared-utils

# --- Development Stage ---
FROM base AS development
WORKDIR /app

COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY apps/subscription-service ./apps/subscription-service

EXPOSE 3007

CMD ["npm", "run", "dev", "--workspace=apps/subscription-service"]

# --- Builder Stage ---
FROM base AS builder
WORKDIR /app

COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY apps/subscription-service ./apps/subscription-service

RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=packages/shared-utils
RUN npm run build --workspace=apps/subscription-service

# --- Production Stage ---
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production

# npm needs the real workspace layout to resolve @motacare/shared-types
# and @motacare/shared-utils (private workspace packages, never published
# to any registry) and to install subscription-service's actual runtime dependencies —
# the previous approach flattened everything to a single package.json
# with no workspace context, so `npm install` silently installed almost
# none of this service's real dependencies (e.g. pg, drizzle-orm).
COPY --from=base /app/package.json /app/turbo.json ./
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/shared-utils/package.json ./packages/shared-utils/
COPY --from=builder /app/apps/subscription-service/package.json ./apps/subscription-service/

RUN npm install --workspace=apps/subscription-service --workspace=packages/shared-types --workspace=packages/shared-utils --omit=dev

# Compiled output — dist stays flattened to /app/dist to match CMD below.
COPY --from=builder /app/apps/subscription-service/dist ./dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-utils/dist ./packages/shared-utils/dist

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 motacare
USER motacare

EXPOSE 3007

CMD ["node", "dist/main.js"]
