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

# Copy only what production needs
COPY --from=builder /app/apps/invoicing-service/dist ./dist
COPY --from=builder /app/apps/invoicing-service/package.json ./
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-utils/dist ./packages/shared-utils/dist
COPY --from=base /app/package.json ./
COPY --from=base /app/turbo.json ./

RUN npm install --omit=dev

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 motacare
USER motacare

EXPOSE 3011

CMD ["node", "dist/main.js"]
