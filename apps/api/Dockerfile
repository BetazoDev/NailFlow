# ─── Build ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Manifests first, so `npm ci` is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN npm ci --workspace @nailflow/api --workspace @nailflow/shared --include-workspace-root

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run build --workspace @nailflow/shared \
    && npm run build --workspace @nailflow/api

# Drop dev dependencies from the tree we are about to copy.
RUN npm prune --omit=dev --workspace @nailflow/api --workspace @nailflow/shared --include-workspace-root

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Run as an unprivileged user; the node image ships one.
USER node

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/package.json

EXPOSE 3000

# Dokploy and Docker both use this to tell "started" from "healthy".
# Checked often and early: Swarm only marks the task healthy after the first
# success, and Dokploy stops waiting before a 20s start period plus a 30s
# interval elapses — which made successful deploys report as failed.
# Comprobar la salud cuesta un proceso de Node entero, porque la imagen no
# trae curl. Arrancar Node son 200ms con el servidor tranquilo y varios
# segundos cuando no lo esta, asi que un intervalo corto con un margen corto
# se convierte en una espiral: la comprobacion tarda de mas, Swarm da el
# contenedor por muerto, arranca otro, y ese arranque consume justo lo que
# faltaba. Paso de verdad: cada 5s, dos contenedores, 47% de la CPU en
# comprobar si estaban vivos.
#
# El margen ahora es holgado a proposito. Una caida real se detecta 30
# segundos mas tarde, que no le cuesta nada a nadie; la espiral costaba el
# producto entero.
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]
