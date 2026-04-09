# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Cache bust argument - forces rebuild of all layers below
ARG CACHEBUST=1
RUN echo "Cache bust: $CACHEBUST"

# Copy package manifests
COPY package.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN npm install --no-package-lock

# Copy ALL source files
COPY . .

# Build the web app (force clean .next)
WORKDIR /app/apps/web
RUN rm -rf .next
RUN cp ../../.env .env 2>/dev/null || true
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
