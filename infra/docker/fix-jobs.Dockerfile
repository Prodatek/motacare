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
COPY apps/fix-jobs/package.json ./apps/fix-jobs/

RUN npm install --workspace=apps/fix-jobs --workspace=packages/shared-types --workspace=packages/shared-utils

# --- Development Stage ---
FROM base AS development
WORKDIR /app

COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY apps/fix-jobs ./apps/fix-jobs

EXPOSE 3004

CMD ["npm", "run", "dev", "--workspace=apps/fix-jobs"]

# --- Production Stage ---
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production

# Copy only what production needs
COPY --from=base /app/apps/fix-jobs ./apps/fix-jobs
COPY --from=base /app/packages/shared-types ./packages/shared-types
COPY --from=base /app/packages/shared-utils ./packages/shared-utils

RUN npm install --workspace=apps/fix-jobs --workspace=packages/shared-types --workspace=packages/shared-utils --omit=dev

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 motacare
USER motacare

EXPOSE 3004

CMD ["npm", "run", "dev", "--workspace=apps/fix-jobs"]
