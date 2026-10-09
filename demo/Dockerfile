# Stand-in for a customer HMIS. It knows nothing about our code except the script tag.
FROM nginx:1.29-alpine
COPY . /usr/share/nginx/html
COPY embed-urls.sh /docker-entrypoint.d/40-embed-urls.sh
RUN chmod +x /docker-entrypoint.d/40-embed-urls.sh && rm /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/embed-urls.sh
