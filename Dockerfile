# syntax=docker/dockerfile:1

# Production image for Cloud Run.
# Secrets (database URL, GitHub token, message key) are injected at runtime.
# They are not build arguments and they are not copied into the image.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# One-shot migration image. Build with: docker build --target migrate
# Run once per release, before the new Cloud Run revision receives traffic.
# It is not the web server and it does not contain production credentials.
FROM base AS migrate
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs package.json package-lock.json ./
COPY --chown=nextjs:nodejs prisma ./prisma
COPY --chown=nextjs:nodejs prisma.config.ts ./
USER nextjs
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
