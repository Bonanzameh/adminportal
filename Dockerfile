FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN set -eux; \
    npm config set fund false; \
    npm config set audit false; \
    npm config set update-notifier false; \
    npm ci --omit=dev || npm install --omit=dev

COPY src ./src
COPY public ./public

RUN mkdir -p /app/data /app/generated-pdfs && chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER node

CMD ["node", "src/server.js"]
