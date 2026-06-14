Output

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

RUN npm install \
  --workspace=apps/alert-service \
  --workspace=packages/shared-types \
  --workspace=packages/shared-utils

FROM base AS development
WORKDIR /app
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY apps/alert-service ./apps/alert-service
EXPOSE 3005
CMD ["npm", "run", "dev", "--workspace=apps/alert-service"]

FROM base AS builder
WORKDIR /app
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY apps/alert-service ./apps/alert-service
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=packages/shared-utils
RUN npm run build --workspace=apps/alert-service

FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/alert-service/dist ./dist
COPY --from=builder /app/apps/alert-service/package.json ./
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-utils/dist ./packages/shared-utils/dist

RUN npm install --omit=dev
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 motacare
USER motacare

EXPOSE 3005
CMD ["node", "dist/main.js"]