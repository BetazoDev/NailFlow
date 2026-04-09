FROM node:20-alpine AS builder
WORKDIR /app

# Cache bust
ARG CACHEBUST=1

# Copy manifests
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install
RUN npm install --no-package-lock

# Copy source
COPY . .

# Build API (if needed, but it's usually just TSC)
WORKDIR /app/apps/api
RUN npm run build

# Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy the built API
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
