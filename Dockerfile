FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
RUN mkdir -p /data && chown node:node /data

RUN NODE_ENV=production \
  PORT=3030 \
  NAME=gdl-api \
  HOST=localhost \
  BIND=0.0.0.0 \
  BASE_DIR=/data \
  DISALLOWED_DIRS='["config/","functions/","logs/","node_modules"]' \
  DISALLOWED_FILES='[".env",".DS_STORE","Thumbs.db","desktop.ini"]' \
  DISALLOWED_EXTENSIONS='["part","tmp","temp","log"]' \
  MONGODB_URL=mongodb://localhost:27017/gdl \
  REDIS_CACHE_TTL_SECONDS=300 \
  SESSION_SECRET=build-only-secret \
  COOKIE_MAX_AGE=30d \
  MAX_DEPTH=50 \
  PAGINATION_LIMIT=1000 \
  RATE_LIMIT_WINDOW=1m \
  RATE_LIMIT_MAX=100 \
  OAUTH_PROVIDERS='[]' \
  MAX_PIXELS=10000 \
  MAX_SCALE=1000 \
  MAX_SEARCH_RESULTS=1000 \
  npm run build

RUN chown -R node:node /app

ENV NODE_ENV=production \
    PORT=3030 \
    BIND=0.0.0.0 \
    BASE_DIR=/data

USER node

EXPOSE 3030

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["curl", "--fail", "--silent", "--show-error", "http://127.0.0.1:3030/api/health/"]

CMD ["node", "server.js"]
