# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root files for workspaces
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Install root dependencies (including workspaces)
RUN npm install

# Copy source
COPY . .

# Build web app
WORKDIR /app/apps/web
RUN npm run build

# Production stage (using nginx to serve static files)
FROM nginx:alpine
COPY --from=builder /app/apps/web/out /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
