# Build context: repo root (npm workspaces share one lockfile)
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY widget/package.json widget/
RUN npm ci -w server --omit=dev && npm cache clean --force
COPY server/src server/src

WORKDIR /app/server
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s CMD wget -qO- http://127.0.0.1:${PORT:-4000}/health || exit 1
# Node 24 runs TypeScript directly; no build step.
CMD ["node", "src/server.ts"]
