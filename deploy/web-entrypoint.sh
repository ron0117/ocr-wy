#!/bin/sh
set -eu

# 备案完成前只用 HTTP，用服务器 IP 访问。
# 备案并解析域名后，去掉下面注释，有证书时会自动切回 HTTPS。
# domain="${CERTBOT_DOMAIN:-}"
# cert="/etc/letsencrypt/live/${domain}/fullchain.pem"
#
# if [ -n "$domain" ] && [ -f "$cert" ]; then
#   chmod -R a+rX /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
#   sed "s/__DOMAIN__/${domain}/g" /opt/nginx/https.conf > /etc/nginx/conf.d/default.conf
#   (while true; do sleep 86400; nginx -s reload; done) &
# else
cp /opt/nginx/http.conf /etc/nginx/conf.d/default.conf
# fi

exec nginx -g 'daemon off;'
