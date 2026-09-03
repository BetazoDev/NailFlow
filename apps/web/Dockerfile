# ─── Build ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Manifests first, so `npm ci` is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

RUN npm ci

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# NEXT_PUBLIC_* values are inlined at build time, so they must be present here
# rather than only in the runtime environment.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CDN_SLUG
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_ALLOW_TEST_BOOKINGS

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build --workspace @nailflow/shared \
    && npm run build --workspace @nailflow/web

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

USER node

# `output: 'standalone'` emits a server plus only the modules it actually needs.
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(()=>process.exit(0)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
