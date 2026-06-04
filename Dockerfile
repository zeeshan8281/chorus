# Verifiable Agent Memory — single TEE container (Node + PostgreSQL 16),
# deployed into an Intel TDX enclave by `ecloud compute app deploy`.

# --- build stage ---
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json tsconfig*.json ./
RUN npm ci
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# --- runtime: PostgreSQL 16 base + Node 20 ---
FROM postgres:16-bookworm
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY scripts ./scripts

ENV PGDATA=/data/pgdata \
    DATA_DIR=/data \
    PORT=3000 \
    DATABASE_URL=postgresql://memory@127.0.0.1:5432/memory
EXPOSE 3000
VOLUME /data
ENTRYPOINT ["bash", "scripts/entrypoint.sh"]
