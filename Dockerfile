FROM node:24-slim AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npx vite build

FROM node:24-slim AS server-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/ src/
COPY tsconfig.json ./
RUN npm run build

FROM node:24-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends stockfish \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=server-builder /app/dist/ dist/
COPY --from=web-builder /app/web/dist/ web/dist/
EXPOSE 5173
CMD ["node", "dist/server/serve.js", "--host", "0.0.0.0"]
