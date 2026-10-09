# Stand-in for a customer HMIS. It knows nothing about our code except the script tag.
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY embed-urls.sh /docker-entrypoint.d/40-embed-urls.sh
RUN chmod +x /docker-entrypoint.d/40-embed-urls.sh
COPY index.html styles.css app.js hmis-integration.js /usr/share/nginx/html/
