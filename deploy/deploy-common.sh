# shellcheck shell=bash
# 部署脚本共用函数（source 于 bootstrap-*.sh）

deploy_env_val() {
  local file="$1" key="$2"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$file" 2>/dev/null || true
}

dual_host_enabled() {
  local v
  if [[ -f .env.production ]]; then
    v="$(deploy_env_val .env.production DEPLOY_DUAL_HOST)"
    [[ "$v" == "true" ]] && return 0
  fi
  if [[ -f .env.guide.production ]]; then
    v="$(deploy_env_val .env.guide.production DEPLOY_DUAL_HOST)"
    [[ "$v" == "true" ]] && return 0
  fi
  return 1
}

maybe_exec_dual_host_bootstrap() {
  if ! dual_host_enabled; then
    return 0
  fi
  echo "DEPLOY_DUAL_HOST=true，转交 deploy/bootstrap-dual-host-centos.sh ..."
  exec bash deploy/bootstrap-dual-host-centos.sh
}

configure_ocr_build_mirrors() {
  if [[ ! -f .env.production ]] || grep -q '^APT_MIRROR=' .env.production; then
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
    printf '\nAPT_MIRROR=http://mirrors.cloud.tencent.com\nPIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple\nNPM_REGISTRY=https://registry.npmmirror.com\n' >> .env.production
    echo "已为镜像构建启用国内软件源。"
  fi
}

ensure_ocr_super_admin_env() {
  if [[ ! -f .env.production ]]; then
    return
  fi
  if ! grep -q '^SUPER_ADMIN_EMAIL=' .env.production; then
    printf '\nSUPER_ADMIN_EMAIL=admin@example.com\n' >> .env.production
  fi
  if ! grep -q '^SUPER_ADMIN_PASSWORD=' .env.production; then
    printf 'SUPER_ADMIN_PASSWORD=Admin123456\n' >> .env.production
  fi
}

fix_deploy_script_crlf() {
  sed -i 's/\r$//' deploy/bootstrap-dual-host-centos.sh deploy/deploy-common.sh 2>/dev/null || true
}
