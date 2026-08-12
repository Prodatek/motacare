# ==============================================
# MOTACARE — Alert Service Dockerfile
# ==============================================

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY apps/alert-service/package.json ./apps/alert-service/
COPY tsconfig.base.json ./

RUN npm install --workspace=apps/alert-service --workspace=packages/shared-types --workspace=packages/shared-utils

FROM base AS development
WORKDIR /app
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY apps/alert-service ./apps/alert-service
COPY tsconfig.base.json ./
EXPOSE 3005
CMD ["npm", "run", "dev", "--workspace=apps/alert-service"]

FROM base AS builder
WORKDIR /app
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY tsconfig.base.json ./

COPY apps/alert-service ./apps/alert-service
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=packages/shared-utils
RUN npm run build --workspace=apps/alert-service

FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/tsconfig.base.json ./

# npm needs the real workspace layout to resolve @motacare/shared-types
# and @motacare/shared-utils (private workspace packages, never published
# to any registry) and to install alert-service's actual runtime
# dependencies — the previous approach flattened everything to a single
# package.json with no workspace context, so `npm install` silently
# installed almost none of this service's real dependencies.
COPY --from=base /app/package.json /app/turbo.json ./
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/shared-utils/package.json ./packages/shared-utils/
COPY --from=builder /app/apps/alert-service/package.json ./apps/alert-service/

RUN npm install --workspace=apps/alert-service --workspace=packages/shared-types --workspace=packages/shared-utils --omit=dev

# Compiled output — dist stays flattened to /app/dist to match CMD below.
COPY --from=builder /app/apps/alert-service/dist ./dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-utils/dist ./packages/shared-utils/dist
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 motacare
USER motacare

EXPOSE 3005
CMD ["node", "dist/main.js"]