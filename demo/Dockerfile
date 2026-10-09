# Stand-in for a customer HMIS. It knows nothing about our code except the script tag.
FROM node:24-alpine AS build
WORKDIR /demo
COPY . .
ARG WIDGET_URL
ARG SERVER_URL
ARG WIDGET_TOKEN
ARG INGEST_API_KEY
RUN node build.mjs

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /demo/dist /usr/share/nginx/html
