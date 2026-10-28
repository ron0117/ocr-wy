#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "请使用 root 运行：sudo bash deploy/bootstrap-guide-centos.sh" >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

ENV_FILE=".env.guide.production"
COMPOSE_FILE="docker-compose.guide.yml"

write_docker_repo() {
  local mirror="$1"
  cat > /etc/yum.repos.d/docker-ce.repo <<EOF
[docker-ce-stable]
name=Docker CE Stable
baseurl=${mirror}/\$releasever/\$basearch/stable
enabled=1
gpgcheck=1
gpgkey=${mirror}/gpg
EOF
}

use_tencent_registry_mirror() {
  mkdir -p /etc/docker
  if [[ -f /etc/docker/daemon.json ]]; then
    echo "已存在 /etc/docker/daemon.json，跳过 Docker Hub 加速配置。"
    return
  fi
  cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
EOF
  echo "已配置腾讯云 Docker Hub 内网加速（仅腾讯云服务器可用）。"
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  echo "安装 Docker Engine 和 Compose 插件..."
  local pm
  if command -v dnf >/dev/null 2>&1; then
    pm=dnf
    dnf -y install dnf-plugins-core ca-certificates curl
  elif command -v yum >/dev/null 2>&1; then
    pm=yum
    yum -y install yum-utils ca-certificates curl
  else
    echo "未找到 dnf/yum；此脚本仅支持 CentOS/RHEL 系发行版。" >&2
    exit 1
  fi

  local mirrors=(
    "https://download.docker.com/linux/centos"
    "https://mirrors.tencentyun.com/docker-ce/linux/centos"
    "https://mirrors.cloud.tencent.com/docker-ce/linux/centos"
    "https://mirrors.aliyun.com/docker-ce/linux/centos"
    "https://mirrors.huaweicloud.com/docker-ce/linux/centos"
  )
  local mirror installed=0
  for mirror in "${mirrors[@]}"; do
    echo "尝试 Docker 安装源：${mirror}"
    if ! curl -fsSL --connect-timeout 20 --retry 2 -o /tmp/docker-ce.gpg "${mirror}/gpg"; then
      echo "无法连接 ${mirror}"
      continue
    fi
    write_docker_repo "$mirror"
    if "$pm" -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
      installed=1
      if [[ "$mirror" == *tencentyun.com* || "$mirror" == *cloud.tencent.com* ]]; then
        use_tencent_registry_mirror
      fi
      break
    fi
    echo "从 ${mirror} 安装失败，尝试下一个源..."
    "$pm" clean all || true
  done
  rm -f /tmp/docker-ce.gpg
  if [[ "$installed" -ne 1 ]]; then
    echo "Docker 安装失败：官方源和国内镜像都不可用。" >&2
    exit 1
  fi
}

random_hex() {
  od -An -N "$1" -tx1 /dev/urandom | tr -d ' \n'
}

env_val() {
  awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
}

create_guide_env() {
  if [[ -f "$ENV_FILE" ]]; then
    return
  fi

  umask 077
  sed \
    -e "s|GUIDE_POSTGRES_PASSWORD=change-me|GUIDE_POSTGRES_PASSWORD=$(random_hex 24)|" \
    deploy/.env.guide.production.example > "$ENV_FILE"
  echo "已生成 ${ENV_FILE}；请设置 GUIDE_CERTBOT_DOMAIN、GUIDE_WEB_ORIGIN 后重跑脚本。"
}

configure_build_mirrors() {
  if grep -q '^NPM_REGISTRY=' "$ENV_FILE" 2>/dev/null; then
    return
  fi
  local use_cn=0
  if [[ -f /etc/docker/daemon.json ]] && grep -q 'tencentyun\|cloud.tencent.com\|aliyun\|huaweicloud' /etc/docker/daemon.json; then
    use_cn=1
  fi
  if [[ "$use_cn" -eq 0 ]] && ! curl -fsSL --connect-timeout 5 --max-time 8 -r 0-1048575 -o /dev/null \
    http://deb.debian.org/debian/dists/bookworm/main/binary-amd64/Packages.gz; then
    use_cn=1
  fi
  if [[ "$use_cn" -eq 1 ]]; then
    printf '\nAPT_MIRROR=http://mirrors.cloud.tencent.com\nNPM_REGISTRY=https://registry.npmmirror.com\n' >> "$ENV_FILE"
    echo "已为 Guide 镜像构建启用国内软件源。"
  fi
}

ensure_certbot_env() {
  if ! grep -q '^GUIDE_CERTBOT_DOMAIN=' "$ENV_FILE"; then
    printf '\nGUIDE_CERTBOT_DOMAIN=wiki.wuyouclub.online\n' >> "$ENV_FILE"
  fi
  if ! grep -q '^CERTBOT_EMAIL=' "$ENV_FILE"; then
    printf 'CERTBOT_EMAIL=admin@example.com\n' >> "$ENV_FILE"
  fi
}

configure_firewall() {
  if ! command -v firewall-cmd >/dev/null 2>&1 || ! systemctl is-active --quiet firewalld; then
    return
  fi
  firewall-cmd --permanent --add-service=http
  firewall-cmd --permanent --add-service=https
  local http_port https_port
  http_port="$(env_val GUIDE_HTTP_PORT)"
  https_port="$(env_val GUIDE_HTTPS_PORT)"
  http_port="${http_port:-8080}"
  https_port="${https_port:-8443}"
  if [[ "$http_port" != "80" ]]; then
    firewall-cmd --permanent --add-port="${http_port}/tcp"
  fi
  if [[ "$https_port" != "443" ]]; then
    firewall-cmd --permanent --add-port="${https_port}/tcp"
  fi
  firewall-cmd --reload
}

issue_tls_certificate() {
  local domain email attempt
  domain="$(env_val GUIDE_CERTBOT_DOMAIN)"
  email="$(env_val CERTBOT_EMAIL)"
  if [[ -z "$domain" ]]; then
    echo "未设置 GUIDE_CERTBOT_DOMAIN，跳过 HTTPS 证书。"
    return
  fi
  if [[ -z "$email" ]]; then
    email="admin@example.com"
  fi

  echo "申请 Let's Encrypt 证书：${domain}"
  for attempt in 1 2 3 4 5; do
    if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps --entrypoint certbot certbot-guide \
      certonly --webroot -w /var/www/certbot \
      --email "$email" --agree-tos --no-eff-email --non-interactive \
      --keep-until-expiring \
      -d "$domain"; then
      if grep -q '^GUIDE_WEB_ORIGIN=' "$ENV_FILE"; then
        sed -i "s|^GUIDE_WEB_ORIGIN=.*|GUIDE_WEB_ORIGIN=https://${domain}|" "$ENV_FILE"
      else
        printf '\nGUIDE_WEB_ORIGIN=https://%s\n' "$domain" >> "$ENV_FILE"
      fi
      docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d
      docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" restart guide-proxy
      return
    fi
    if [[ "$attempt" -eq 5 ]]; then
      echo "证书申请失败，站点暂时继续使用 HTTP（注意：非 80 端口时 HTTP-01 可能无法通过）。" >&2
      return
    fi
    sleep 10
  done
}

install_docker
systemctl enable --now docker
create_guide_env
configure_build_mirrors
ensure_certbot_env
configure_firewall

echo "构建并启动 Guide 服务（首次构建可能需要数分钟）..."
export COMPOSE_PARALLEL_LIMIT=1
if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --remove-orphans; then
  echo "启动失败，guide-api 最近日志：" >&2
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail 150 guide-api >&2 || true
  exit 1
fi
issue_tls_certificate
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

origin="$(env_val GUIDE_WEB_ORIGIN)"
http_port="$(env_val GUIDE_HTTP_PORT)"
http_port="${http_port:-8080}"
echo "部署完成：${origin:-（见 GUIDE_WEB_ORIGIN）}"
echo "HTTP 入口（宿主机端口）：${http_port}"
echo "查看日志：docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE} logs -f"
echo "首次导入完成后可将 ${ENV_FILE} 中 SEED_GUIDE 改为 false 再重跑本脚本。"
