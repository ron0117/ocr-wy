#!/bin/sh
set -eu

domain="${CERTBOT_DOMAIN:-}"
cert="/etc/letsencrypt/live/${domain}/fullchain.pem"

if [ -n "$domain" ] && [ -f "$cert" ]; then
  chmod -R a+rX /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
  sed "s/__DOMAIN__/${domain}/g" /opt/nginx/https.conf > /etc/nginx/conf.d/default.conf
  (while true; do sleep 86400; nginx -s reload; done) &
else
  if [ -n "$domain" ]; then
    sed "s/__DOMAIN__/${domain}/g" /opt/nginx/http.conf > /etc/nginx/conf.d/default.conf
  else
    sed 's/__DOMAIN__/_/g' /opt/nginx/http.conf > /etc/nginx/conf.d/default.conf
  fi
fi

exec nginx -g 'daemon off;'
