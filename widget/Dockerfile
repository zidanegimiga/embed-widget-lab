# Build context: repo root (npm workspaces share one lockfile)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY widget/package.json widget/
COPY server/package.json server/
RUN npm ci -w widget
COPY widget widget
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN npm run build -w widget

FROM nginx:1.29-alpine
COPY widget/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/widget/dist /usr/share/nginx/html
