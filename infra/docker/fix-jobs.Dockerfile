# ==============================================
# MOTACARE — Fix Job Service Dockerfile
# Multi-stage: development | production
# ==============================================

# --- Base Stage ---
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install root dependencies (for workspace/turbo)
COPY package.json turbo.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY apps/fix-job-service/package.json ./apps/fix-job-service/

RUN npm install --workspace=apps/fix-job-service --workspace=packages/shared-types --workspace=packages/shared-utils

# --- Development Stage ---
FROM base AS development
WORKDIR /app

COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY apps/fix-job-service ./apps/fix-job-service

EXPOSE 3010

CMD ["npm", "run", "start", "--workspace=apps/fix-job-service"]

# --- Production Stage ---
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production

# Copy only what production needs
COPY --from=base /app/apps/fix-job-service ./apps/fix-job-service
COPY --from=base /app/packages/shared-types ./packages/shared-types
COPY --from=base /app/packages/shared-utils ./packages/shared-utils

RUN npm install --workspace=apps/fix-job-service --workspace=packages/shared-types --workspace=packages/shared-utils --omit=dev

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 motacare
USER motacare

EXPOSE 3010

CMD ["node", "apps/fix-job-service/src/main.js"]
