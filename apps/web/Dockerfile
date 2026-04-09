# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy lockfiles and package manifests first (layer-cache friendly)
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

# Install all workspace dependencies using lockfile (deterministic)
RUN npm ci --legacy-peer-deps

# Copy all source files
COPY . .

# Build the Next.js web app (clear any stale cache first)
WORKDIR /app/apps/web
RUN rm -rf .next
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Copy Next.js standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
