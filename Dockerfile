FROM node:24-trixie-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
RUN mkdir -p /data && chown node:node /data

RUN BASE_DIR=/data npm run build

RUN chown -R node:node /app

USER node

EXPOSE 3030

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl --fail --silent --show-error "http://127.0.0.1:${PORT:-3030}${BASE_PATH}/api/health/"

CMD ["node", "server.js"]
