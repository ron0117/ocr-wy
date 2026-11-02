#!/usr/bin/env bash
# 同机双站方案 A：宿主机 Nginx 占 80/443，识单 9080、wiki 9081，一次脚本完成。
#
# 用法（项目根目录，root）：
#   sudo bash deploy/bootstrap-dual-host-centos.sh
#
# 依赖：.env.production、.env.guide.production（不存在则从 example 生成）。
# 可选环境变量：MAIN_DOMAIN、WIKI_DOMAIN、CERTBOT_EMAIL、SKIP_BUILD=1（仍强制 build web/api，仅跳过 compose up --build）

set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "请使用 root 运行：sudo bash deploy/bootstrap-dual-host-centos.sh" >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
# shellcheck source=deploy-common.sh
source deploy/deploy-common.sh
fix_deploy_script_crlf

OCR_ENV=".env.production"
GUIDE_ENV=".env.guide.production"
NGINX_CONF_DIR="/etc/nginx/conf.d"
CERT_WEBROOT="/var/www/certbot"

MAIN_DOMAIN="${MAIN_DOMAIN:-}"
WIKI_DOMAIN="${WIKI_DOMAIN:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

random_hex() {
  od -An -N "$1" -tx1 /dev/urandom | tr -d ' \n'
}

env_val() {
  local file="$1" key="$2"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$file" 2>/dev/null || true
}

set_env_var() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

# 仅当 .env 中尚无该键时写入（已在 prod 里配置的项不覆盖）
ensure_env_default() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    return
  fi
  printf '\n%s=%s\n' "$key" "$value" >> "$file"
}

require_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi
  echo "未检测到 Docker Compose。请先运行：sudo bash deploy/bootstrap-centos.sh" >&2
  exit 1
}

ensure_ocr_env() {
  if [[ ! -f "$OCR_ENV" ]]; then
    umask 077
    sed \
      -e "s|POSTGRES_PASSWORD=change-me|POSTGRES_PASSWORD=$(random_hex 24)|" \
      -e "s|JWT_SECRET=change-me|JWT_SECRET=$(random_hex 48)|" \
      deploy/.env.production.example > "$OCR_ENV"
    echo "已生成 ${OCR_ENV}"
  fi
}

ensure_guide_env() {
  if [[ ! -f "$GUIDE_ENV" ]]; then
    umask 077
    sed \
      -e "s|GUIDE_POSTGRES_PASSWORD=change-me|GUIDE_POSTGRES_PASSWORD=$(random_hex 24)|" \
      deploy/.env.guide.production.example > "$GUIDE_ENV"
    echo "已生成 ${GUIDE_ENV}"
  fi
}

resolve_domains() {
  if [[ -z "$MAIN_DOMAIN" ]]; then
    MAIN_DOMAIN="$(env_val "$OCR_ENV" CERTBOT_DOMAIN)"
    MAIN_DOMAIN="${MAIN_DOMAIN:-wuyouclub.online}"
  fi
  if [[ -z "$WIKI_DOMAIN" ]]; then
    WIKI_DOMAIN="$(env_val "$GUIDE_ENV" GUIDE_CERTBOT_DOMAIN)"
    WIKI_DOMAIN="${WIKI_DOMAIN:-wiki.wuyouclub.online}"
  fi
  if [[ -z "$CERTBOT_EMAIL" ]]; then
    CERTBOT_EMAIL="$(env_val "$OCR_ENV" CERTBOT_EMAIL)"
    CERTBOT_EMAIL="${CERTBOT_EMAIL:-$(env_val "$GUIDE_ENV" CERTBOT_EMAIL)}"
    CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@example.com}"
  fi
}

apply_dual_compose_env() {
  ensure_env_default "$OCR_ENV" DEPLOY_DUAL_HOST "true"
  ensure_env_default "$GUIDE_ENV" DEPLOY_DUAL_HOST "true"

  ensure_env_default "$OCR_ENV" OCR_PUBLISH_HTTP "127.0.0.1:9080:80"
  ensure_env_default "$OCR_ENV" OCR_PUBLISH_HTTPS "127.0.0.1:19080:443"
  ensure_env_default "$OCR_ENV" OCR_CONTAINER_CERTBOT_DOMAIN "none"
  ensure_env_default "$OCR_ENV" CERTBOT_DOMAIN "$MAIN_DOMAIN"
  ensure_env_default "$OCR_ENV" CERTBOT_EMAIL "$CERTBOT_EMAIL"
  ensure_env_default "$OCR_ENV" WEB_ORIGIN "https://${MAIN_DOMAIN}"
  ensure_env_default "$OCR_ENV" GUIDE_API_URL "http://guide-api:3001"

  ensure_env_default "$GUIDE_ENV" GUIDE_PUBLISH_HTTP "127.0.0.1:9081:80"
  ensure_env_default "$GUIDE_ENV" GUIDE_PUBLISH_HTTPS "127.0.0.1:19081:443"
  ensure_env_default "$GUIDE_ENV" GUIDE_CONTAINER_CERTBOT_DOMAIN "none"
  ensure_env_default "$GUIDE_ENV" GUIDE_CERTBOT_DOMAIN "$WIKI_DOMAIN"
  ensure_env_default "$GUIDE_ENV" GUIDE_WEB_ORIGIN "https://${WIKI_DOMAIN}"
  ensure_env_default "$GUIDE_ENV" CERTBOT_EMAIL "$CERTBOT_EMAIL"
}

install_nginx_if_needed() {
  if command -v nginx >/dev/null 2>&1; then
    return
  fi
  local pm=dnf
  command -v dnf >/dev/null 2>&1 || pm=yum
  echo "安装 Nginx..."
  "$pm" -y install nginx
}

install_certbot_if_needed() {
  if command -v certbot >/dev/null 2>&1; then
    return
  fi
  local pm=dnf
  command -v dnf >/dev/null 2>&1 || pm=yum
  echo "安装 certbot..."
  "$pm" -y install certbot || "$pm" -y install certbot python3-certbot-nginx
}

configure_firewall() {
  if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
  fi
}

ocr_build_app_images() {
  echo "构建识单 web / api 镜像（使用当前工作区代码）..."
  docker compose --env-file "$OCR_ENV" -f docker-compose.prod.yml build web api
}

ensure_ocr_guide_network() {
  if ! docker network inspect ocr_guide_internal >/dev/null 2>&1; then
    echo "创建 Docker 网络 ocr_guide_internal（识单 api ↔ guide-api）..."
    docker network create ocr_guide_internal
  fi
}

compose_up_stacks() {
  ensure_ocr_guide_network
  export COMPOSE_PARALLEL_LIMIT=1
  echo "构建并启动识单（回环 9080）..."
  if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
    docker compose --env-file "$OCR_ENV" -f docker-compose.prod.yml up -d --remove-orphans
    ocr_build_app_images
  else
    docker compose --env-file "$OCR_ENV" -f docker-compose.prod.yml up -d --build --remove-orphans
  fi
  docker compose --env-file "$OCR_ENV" -f docker-compose.prod.yml up -d --force-recreate web api

  echo "构建并启动 Guide / wiki（回环 9081）..."
  # wiki 前端/API 必须随 git 更新重建；SKIP_BUILD 仅加快识单栈，不影响 Guide
  docker compose --env-file "$GUIDE_ENV" -f docker-compose.guide.yml up -d --build --remove-orphans
  docker compose --env-file "$GUIDE_ENV" -f docker-compose.guide.yml up -d --force-recreate guide-app guide-proxy
}

assert_loopback_upstreams() {
  curl -fsS -o /dev/null -H "Host: ${MAIN_DOMAIN}" http://127.0.0.1:9080/ || {
    echo "识单 9080 不可达，请检查 docker compose logs web" >&2
    exit 1
  }
  curl -fsS http://127.0.0.1:9081/api/v1/health | grep -q '"status":"ok"' || {
    echo "Guide 9081 /api/v1/health 异常" >&2
    exit 1
  }
}

assert_public_ports_for_host_nginx() {
  if ss -tlnp 2>/dev/null | grep -E ':80 |:443 ' | grep -q docker-proxy; then
    echo "公网 80/443 仍被 Docker 占用。请确认 ${OCR_ENV} 含 OCR_PUBLISH_HTTP=127.0.0.1:9080:80 并已重建 web：" >&2
    echo "  docker compose --env-file ${OCR_ENV} -f docker-compose.prod.yml up -d --force-recreate web" >&2
    ss -tlnp | grep -E ':80 |:443 ' || true
    exit 1
  fi
}

render_nginx_template() {
  local src="$1" dest="$2"
  sed \
    -e "s|__MAIN_DOMAIN__|${MAIN_DOMAIN}|g" \
    -e "s|__WIKI_DOMAIN__|${WIKI_DOMAIN}|g" \
    -e "s|__CERT_PRIMARY__|${MAIN_DOMAIN}|g" \
    "$src" > "$dest"
}

install_host_nginx_configs() {
  local mode="$1"
  mkdir -p "$NGINX_CONF_DIR" "$CERT_WEBROOT"
  cp deploy/nginx.00-performance.conf "${NGINX_CONF_DIR}/00-performance.conf"

  if [[ -f "${NGINX_CONF_DIR}/default.conf" ]]; then
    mv "${NGINX_CONF_DIR}/default.conf" "${NGINX_CONF_DIR}/default.conf.disabled"
  fi

  if [[ "$mode" == "http" ]]; then
    render_nginx_template deploy/nginx.host.dual.http.conf.example "${NGINX_CONF_DIR}/wuyouclub-dual.conf"
  else
    render_nginx_template deploy/nginx.host.dual.conf.example "${NGINX_CONF_DIR}/wuyouclub-dual.conf"
  fi

  nginx -t
  systemctl enable nginx
  systemctl restart nginx
}

host_cert_exists() {
  [[ -f "/etc/letsencrypt/live/${MAIN_DOMAIN}/fullchain.pem" ]]
}

issue_host_certificate() {
  if host_cert_exists; then
    echo "已存在证书 /etc/letsencrypt/live/${MAIN_DOMAIN}/，跳过申请。"
    return
  fi

  echo "申请 Let's Encrypt（${MAIN_DOMAIN} + ${WIKI_DOMAIN}）..."
  local attempt
  for attempt in 1 2 3 4 5; do
    if certbot certonly --webroot -w "$CERT_WEBROOT" \
      --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email --non-interactive \
      --keep-until-expiring \
      -d "$MAIN_DOMAIN" -d "$WIKI_DOMAIN"; then
      return
    fi
    echo "certbot 失败，10 秒后重试 (${attempt}/5)..."
    sleep 10
  done
  echo "证书申请失败。请确认 80 由本机 Nginx 提供且 CDN/DNS 允许 HTTP-01 访问源站。" >&2
  exit 1
}

smoke_test() {
  echo "本机探活..."
  if ! ss -tlnp 2>/dev/null | grep -E ':443 ' | grep -q nginx; then
    echo "源站 443 未由 nginx 监听，CDN HTTPS 会 521。请检查：nginx -t、证书路径、systemctl status nginx" >&2
    ss -tlnp | grep -E ':80 |:443 ' || true
    exit 1
  fi
  curl -fsS -o /dev/null -H "Host: ${WIKI_DOMAIN}" "http://127.0.0.1/api/v1/health" || {
    echo "宿主机 Nginx 未把 wiki 的 /api 反代到 9081" >&2
    exit 1
  }
  local wiki_html
  wiki_html="$(curl -fsS -H "Host: ${WIKI_DOMAIN}" "http://127.0.0.1/" | head -c 4096)"
  if echo "$wiki_html" | grep -q '无忧俱乐部'; then
    echo "wiki Host 仍返回识单页，请检查 /etc/nginx/conf.d/wuyouclub-dual.conf 与 9081" >&2
    exit 1
  fi
  curl -fsSk -o /dev/null -H "Host: ${WIKI_DOMAIN}" "https://127.0.0.1/"
  curl -fsSk -o /dev/null -H "Host: ${MAIN_DOMAIN}" "https://127.0.0.1/"
  echo "完成。请在浏览器访问："
  echo "  https://${MAIN_DOMAIN}/  （识单）"
  echo "  https://${WIKI_DOMAIN}/   （wiki）"
  echo "若走腾讯云 CDN，请刷新两个域名缓存。"
}

# --- main ---

require_docker
systemctl enable --now docker 2>/dev/null || true
ensure_ocr_env
ensure_guide_env
configure_ocr_build_mirrors
ensure_ocr_super_admin_env
resolve_domains
apply_dual_compose_env
configure_firewall
compose_up_stacks
assert_loopback_upstreams
assert_public_ports_for_host_nginx

install_nginx_if_needed
install_certbot_if_needed

if host_cert_exists; then
  install_host_nginx_configs https
else
  install_host_nginx_configs http
  issue_host_certificate
  install_host_nginx_configs https
fi

smoke_test
