FROM node:22-alpine

WORKDIR /app

# Install dependencies first (layer-cached unless package.json changes)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY server.js ./
COPY public ./public

# Data directory for sessions.db (mount a volume here)
RUN mkdir -p /data

EXPOSE 3000

ENV NODE_ENV=production
ENV DB_PATH=/data/sessions.db

# Injected at build time by GitHub Actions
ARG GIT_SHA=dev
ARG BUILD_TIME=local
ENV GIT_SHA=$GIT_SHA
ENV BUILD_TIME=$BUILD_TIME

CMD ["node", "server.js"]
