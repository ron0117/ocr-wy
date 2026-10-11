#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
用法：
  sudo bash install-from-git.sh <仓库地址> [安装目录] [分支]

示例：
  sudo bash install-from-git.sh https://github.com/example/ocr-wy.git /opt/ocr-wy main
  sudo bash install-from-git.sh git@github.com:example/ocr-wy.git /opt/ocr-wy main
EOF
}

if [[ ${EUID} -ne 0 ]]; then
  echo "请使用 root 运行此脚本。" >&2
  usage
  exit 1
fi

REPOSITORY_URL="${1:-}"
INSTALL_DIR="${2:-/opt/ocr-wy}"
BRANCH="${3:-main}"

if [[ -z "$REPOSITORY_URL" ]]; then
  usage
  exit 1
fi

if [[ ! "$INSTALL_DIR" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  echo "安装目录必须是只包含字母、数字、点、下划线、横线和斜线的绝对路径。" >&2
  exit 1
fi
if [[ ! "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || [[ "$BRANCH" == -* ]]; then
  echo "分支名称格式不安全：$BRANCH" >&2
  exit 1
fi

install_git() {
  if command -v git >/dev/null 2>&1; then
    return
  fi
  if command -v dnf >/dev/null 2>&1; then
    dnf -y install git ca-certificates
  elif command -v yum >/dev/null 2>&1; then
    yum -y install git ca-certificates
  else
    echo "未找到 dnf/yum，无法自动安装 Git。" >&2
    exit 1
  fi
}

install_git

if [[ -d "$INSTALL_DIR/.git" ]]; then
  echo "检测到已有仓库，执行安全的快进更新..."
  git -C "$INSTALL_DIR" fetch origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout "$BRANCH"
  git -C "$INSTALL_DIR" merge --ff-only "origin/$BRANCH"
elif [[ -e "$INSTALL_DIR" ]] && [[ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]]; then
  echo "安装目录已存在且非空，为避免覆盖文件已停止：$INSTALL_DIR" >&2
  exit 1
else
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --branch "$BRANCH" --single-branch -- "$REPOSITORY_URL" "$INSTALL_DIR"
fi

exec bash "$INSTALL_DIR/deploy/bootstrap-centos.sh"
