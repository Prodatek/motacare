# ==============================================
# MOTACARE — Invoicing Service Dockerfile
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
COPY apps/invoicing-service/package.json ./apps/invoicing-service/

RUN npm install --workspace=apps/invoicing-service --workspace=packages/shared-types --workspace=packages/shared-utils

# --- Development Stage ---
FROM base AS development
WORKDIR /app

COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY apps/invoicing-service ./apps/invoicing-service

EXPOSE 3011

CMD ["npm", "run", "dev", "--workspace=apps/invoicing-service"]

# --- Builder Stage ---
FROM base AS builder
WORKDIR /app

COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY apps/invoicing-service ./apps/invoicing-service

RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=packages/shared-utils
RUN npm run build --workspace=apps/invoicing-service

# --- Production Stage ---
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production

# npm needs the real workspace layout to resolve @motacare/shared-types
# and @motacare/shared-utils (private workspace packages, never published
# to any registry) and to install invoicing-service's actual runtime dependencies —
# the previous approach flattened everything to a single package.json
# with no workspace context, so `npm install` silently installed almost
# none of this service's real dependencies (e.g. pg, drizzle-orm).
COPY --from=base /app/package.json /app/turbo.json ./
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/shared-utils/package.json ./packages/shared-utils/
COPY --from=builder /app/apps/invoicing-service/package.json ./apps/invoicing-service/

RUN npm install --workspace=apps/invoicing-service --workspace=packages/shared-types --workspace=packages/shared-utils --omit=dev

# Compiled output — kept at its real nested path (NOT flattened to
# /app/dist like the other services). invoicing-service pins an older
# drizzle-orm (^0.30.10) that conflicts with the root package.json's own
# drizzle-orm (^0.45.2), so npm nests invoicing-service's own copy at
# apps/invoicing-service/node_modules rather than hoisting it to
# /app/node_modules. Node's module resolution only finds that nested
# copy by walking up from the file's real directory — flattening dist
# to /app/dist would put migrate.js outside that ancestor chain
# entirely, causing "Cannot find module 'drizzle-orm/node-postgres'".
COPY --from=builder /app/apps/invoicing-service/dist ./apps/invoicing-service/dist
COPY --from=builder /app/apps/invoicing-service/drizzle ./apps/invoicing-service/drizzle
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-utils/dist ./packages/shared-utils/dist

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 motacare
USER motacare

EXPOSE 3011

CMD ["node", "apps/invoicing-service/dist/main.js"]
