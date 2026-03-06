# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root files for workspaces
COPY package.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

# Install root dependencies without lockfile to resolve linux bindings
RUN npm install --no-package-lock

# Copy source
COPY . .

# Build web app
WORKDIR /app/apps/web
# Next.js may need environment variables from root (if dokploy generated it at root)
RUN cp ../../.env .env || true
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV PORT 3000

# Next.js standalone folder includes a bundled node_modules, so we just copy it
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

# The server.js is generated inside apps/web folder
CMD ["node", "apps/web/server.js"]
