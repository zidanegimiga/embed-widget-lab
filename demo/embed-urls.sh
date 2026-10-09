#!/bin/sh
# Points the embed snippet at wherever the widget and server are deployed.
set -e
html=/usr/share/nginx/html/index.html
[ -n "$WIDGET_URL" ] && sed -i "s#http://localhost:4100#$WIDGET_URL#g" "$html"
[ -n "$SERVER_URL" ] && sed -i "s#http://localhost:4000#$SERVER_URL#g" "$html"
[ -n "$WIDGET_TOKEN" ] && sed -i "s#data-token=\"[^\"]*\"#data-token=\"$WIDGET_TOKEN\"#" "$html"
exit 0
