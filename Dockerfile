# ---- Builder ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN npm run build

# Prune dev dependencies for the runtime image.
RUN npm prune --omit=dev

# ---- Runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Database client tools used by the data plane (mysqldump/mysql, pg_dump/psql).
RUN apt-get update \
    && apt-get install -y --no-install-recommends default-mysql-client postgresql-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# Non-root runtime user.
RUN useradd -r -u 10001 appuser && mkdir -p /app/storage && chown -R appuser /app
USER appuser

EXPOSE 4000
# Entry is selected by the compose/k8s command: server.js | worker.js | scheduler.js
CMD ["node", "dist/server.js"]
