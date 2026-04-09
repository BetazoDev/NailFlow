# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Cache bust argument - forces rebuild of all layers below
ARG CACHEBUST=1
RUN echo "Cache bust: $CACHEBUST"

# Define Build Args for Next.js
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CDN_CLIENT_ID
ARG NEXT_PUBLIC_CDN_PROJECT_ID
ARG NEXT_PUBLIC_CDN_CLIENT_SLUG
ARG NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_CDN_API_URL

# Environment variables for build time
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CDN_CLIENT_ID=$NEXT_PUBLIC_CDN_CLIENT_ID
ENV NEXT_PUBLIC_CDN_PROJECT_ID=$NEXT_PUBLIC_CDN_PROJECT_ID
ENV NEXT_PUBLIC_CDN_CLIENT_SLUG=$NEXT_PUBLIC_CDN_CLIENT_SLUG
ENV NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL
ENV NEXT_PUBLIC_CDN_API_URL=$NEXT_PUBLIC_CDN_API_URL

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
