#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "请使用 root 运行：sudo bash deploy/bootstrap-centos.sh" >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
# shellcheck source=deploy-common.sh
source deploy/deploy-common.sh
fix_deploy_script_crlf

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

  # 镜像站上的 docker-ce.repo 仍指向 download.docker.com，这里直接写可用的 baseurl。
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

create_env() {
  if [[ -f .env.production ]]; then
    return
  fi

  local server_ip origin
  server_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  origin="http://${server_ip:-127.0.0.1}"
  umask 077
  sed \
    -e "s|POSTGRES_PASSWORD=change-me|POSTGRES_PASSWORD=$(random_hex 24)|" \
    -e "s|JWT_SECRET=change-me|JWT_SECRET=$(random_hex 48)|" \
    -e "s|WEB_ORIGIN=http://127.0.0.1|WEB_ORIGIN=${origin}|" \
    deploy/.env.production.example > .env.production
  echo "已生成 .env.production；如需域名、HTTPS 或 AI，请部署后编辑该文件再重跑脚本。"
}

configure_build_mirrors() {
  if grep -q '^APT_MIRROR=' .env.production; then
    return
  fi
  local use_cn=0
  if [[ -f /etc/docker/daemon.json ]] && grep -q 'tencentyun\|cloud.tencent.com\|aliyun\|huaweicloud' /etc/docker/daemon.json; then
    use_cn=1
  fi
  # 索引能连上但很慢时，8 秒内拉不完 1MB 也改用国内源，避免构建把 SSH 拖断。
  if [[ "$use_cn" -eq 0 ]] && ! curl -fsSL --connect-timeout 5 --max-time 8 -r 0-1048575 -o /dev/null \
    http://deb.debian.org/debian/dists/bookworm/main/binary-amd64/Packages.gz; then
    use_cn=1
  fi
  if [[ "$use_cn" -eq 1 ]]; then
    printf '\nAPT_MIRROR=http://mirrors.cloud.tencent.com\nPIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple\nNPM_REGISTRY=https://registry.npmmirror.com\n' >> .env.production
    echo "已为镜像构建启用国内软件源。"
  fi
}

ensure_super_admin_env() {
  if ! grep -q '^SUPER_ADMIN_EMAIL=' .env.production; then
    printf '\nSUPER_ADMIN_EMAIL=admin@example.com\n' >> .env.production
  fi
  if ! grep -q '^SUPER_ADMIN_PASSWORD=' .env.production; then
    printf 'SUPER_ADMIN_PASSWORD=Admin123456\n' >> .env.production
  fi
}

install_docker
systemctl enable --now docker
create_env
configure_build_mirrors
ensure_super_admin_env
maybe_exec_dual_host_bootstrap

ensure_certbot_env() {
  if ! grep -q '^CERTBOT_DOMAIN=' .env.production; then
    printf '\nCERTBOT_DOMAIN=wuyouclub.online\n' >> .env.production
  fi
  if ! grep -q '^CERTBOT_EMAIL=' .env.production; then
    printf 'CERTBOT_EMAIL=admin@example.com\n' >> .env.production
  fi
}

issue_tls_certificate() {
  local domain email attempt
  domain="$(awk -F= '$1 == "CERTBOT_DOMAIN" {print $2}' .env.production)"
  email="$(awk -F= '$1 == "CERTBOT_EMAIL" {print $2}' .env.production)"
  if [[ -z "$domain" ]]; then
    echo "未设置 CERTBOT_DOMAIN，跳过 HTTPS 证书。"
    return
  fi
  if [[ -z "$email" ]]; then
    email="admin@example.com"
  fi

  echo "申请 Let's Encrypt 证书：${domain}"
  for attempt in 1 2 3 4 5; do
    if docker compose --env-file .env.production -f docker-compose.prod.yml run --rm --no-deps --entrypoint certbot certbot \
      certonly --webroot -w /var/www/certbot \
      --email "$email" --agree-tos --no-eff-email --non-interactive \
      --keep-until-expiring \
      -d "$domain"; then
      if grep -q '^WEB_ORIGIN=' .env.production; then
        sed -i "s|^WEB_ORIGIN=.*|WEB_ORIGIN=https://${domain}|" .env.production
      else
        printf '\nWEB_ORIGIN=https://%s\n' "$domain" >> .env.production
      fi
      docker compose --env-file .env.production -f docker-compose.prod.yml up -d
      docker compose --env-file .env.production -f docker-compose.prod.yml restart web
      return
    fi
    if [[ "$attempt" -eq 5 ]]; then
      echo "证书申请失败，站点暂时继续使用 HTTP。" >&2
      return
    fi
    sleep 10
  done
}

ensure_certbot_env

if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-service=http
  firewall-cmd --permanent --add-service=https
  firewall-cmd --reload
fi

echo "构建并启动服务（首次构建 OCR 镜像可能需要数分钟）..."
export COMPOSE_PARALLEL_LIMIT=1
if ! docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build --remove-orphans; then
  echo "启动失败，API 最近日志：" >&2
  docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail 150 api >&2 || true
  exit 1
fi
issue_tls_certificate
docker compose --env-file .env.production -f docker-compose.prod.yml ps

origin="$(awk -F= '$1 == "WEB_ORIGIN" {sub(/^WEB_ORIGIN=/, ""); print}' .env.production)"
echo "部署完成：${origin}"
echo "查看日志：docker compose --env-file .env.production -f docker-compose.prod.yml logs -f"

