# GitHub Actions：自动构建与部署

仓库已包含：

| 工作流 | 文件 | 触发 |
|--------|------|------|
| **CI** | `.github/workflows/ci.yml` | `push` / `pull_request` 到 `main` |
| **Deploy** | `.github/workflows/deploy.yml` | `push` 到 `main`，或 Actions 页 **Run workflow** 手动选 `ocr` / `guide` / `both` |

CI 在 GitHub 云端执行：`pnpm install` → 构建识单 + Guide → `pnpm check`（不连生产库、不部署）。

Deploy 通过 **SSH** 登录你的 CentOS 服务器，在固定目录 **快进合并** 代码后执行现有 `bootstrap-*.sh`（与本地 `upload-and-deploy.ps1` 等价，但代码来自 Git）。

---

## 一、把代码推到 GitHub

在开发机项目根目录（已有 git 时跳过 `init`）：

```powershell
cd D:\demo\ocr

git remote -v
# 若无 origin：
git remote add origin https://github.com/<你的账号>/<仓库名>.git

git add .
git commit -m "chore: add GitHub Actions CI/CD"
git push -u origin main
```

私有仓库同样适用；服务器拉代码需 **Deploy Key** 或 **机器用户 PAT**（见下文）。

---

## 二、服务器一次性准备

SSH 登录生产机（示例 IP 按你实际修改）：

```bash
ssh root@124.222.204.107
```

### 1. 安装 Git（若未装）

```bash
dnf install -y git ca-certificates || yum install -y git ca-certificates
```

### 2. 生成仅用于拉代码的 SSH 密钥（在服务器上）

```bash
ssh-keygen -t ed25519 -N "" -f /root/.ssh/github_deploy -C "ocr-prod-deploy"
cat /root/.ssh/github_deploy.pub
```

把输出的 **公钥** 加到 GitHub：

- 仓库 → **Settings** → **Deploy keys** → **Add deploy key**
- Title：`prod-server`，Key：粘贴公钥，勾选 **Allow read access**（只读即可）

### 3. 配置 Git 使用这把密钥

```bash
cat >> /root/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile /root/.ssh/github_deploy
  IdentitiesOnly yes
EOF
chmod 600 /root/.ssh/config /root/.ssh/github_deploy
ssh -T git@github.com
```

### 4. Clone 到部署目录（保留现有 .env 时勿清空目录）

**全新目录：**

```bash
git clone --branch main git@github.com:<你的账号>/<仓库名>.git /opt/ocr-wy
cd /opt/ocr-wy
cp deploy/.env.production.example .env.production
cp deploy/.env.guide.production.example .env.guide.production
# 编辑两个 env，填入密码、域名、COS 等（勿提交到 Git）
```

**已有 `/opt/ocr-wy` 且只有 tar 部署、没有 .git：**

```bash
mv /opt/ocr-wy /opt/ocr-wy.bak.$(date +%Y%m%d)
git clone --branch main git@github.com:<你的账号>/<仓库名>.git /opt/ocr-wy
cp /opt/ocr-wy.bak.*/.env.production /opt/ocr-wy/ 2>/dev/null || true
cp /opt/ocr-wy.bak.*/.env.guide.production /opt/ocr-wy/ 2>/dev/null || true
```

### 5. 首次手动部署（确认脚本可跑通）

```bash
cd /opt/ocr-wy
# 识单 + wiki 同机（推荐，含宿主机 Nginx 分流）
bash deploy/bootstrap-dual-host-centos.sh
# 仅识单、容器自带 80/443 TLS：bash deploy/bootstrap-centos.sh
```

说明见 [`同机双站-宿主机Nginx.md`](./同机双站-宿主机Nginx.md)。服务器 `.env.production` 中 `DEPLOY_DUAL_HOST=true` 时，单独跑 `bootstrap-centos.sh` / `bootstrap-guide-centos.sh` 也会自动转双站脚本。

---

## 三、GitHub 仓库 Secrets

仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**：

| Secret | 必填 | 示例 / 说明 |
|--------|------|-------------|
| `DEPLOY_HOST` | 是 | `124.222.204.107` |
| `DEPLOY_USER` | 是 | `root` |
| `DEPLOY_SSH_KEY` | 是 | **GitHub Actions 用来 SSH 登录服务器** 的私钥（见下） |
| `DEPLOY_PATH` | 否 | 默认脚本用 `/opt/ocr-wy`；若不同则设为实际路径 |
| `DEPLOY_BRANCH` | 否 | 默认 `main` |
| `DEPLOY_SSH_PORT` | 否 | 默认 `22` |

### Actions 用 SSH 私钥（与服务器 Deploy Key 不是同一把）

在**你的电脑**生成专给 CI 用的密钥，**公钥**写入服务器 `authorized_keys`：

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\github_actions_deploy -N '""'
Get-Content $env:USERPROFILE\.ssh\github_actions_deploy.pub
```

在服务器：

```bash
mkdir -p /root/.ssh
chmod 700 /root/.ssh
# 把上面公钥整行追加：
echo 'ssh-ed25519 AAAA... github-actions' >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

在 GitHub Secret `DEPLOY_SSH_KEY` 中粘贴 **私钥** 全文（`github_actions_deploy` 文件内容，含 `BEGIN/END` 行）。

本地自测 SSH（与 Actions 相同身份）：

```powershell
ssh -i $env:USERPROFILE\.ssh\github_actions_deploy root@124.222.204.107 "cd /opt/ocr-wy && git status -sb"
```

---

## 四、启用与日常命令

### 1. 推送后自动 CI

```powershell
git push origin main
```

打开 GitHub → **Actions** → **CI**，查看构建是否绿色。

### 2. 自动部署（push main）

`main` 每次 push 会触发 **Deploy**（默认 `both`：执行 `bootstrap-dual-host-centos.sh` 一次完成双站 + 宿主机 Nginx）。若只想先 CI、暂不自动上线，可暂时在 `.github/workflows/deploy.yml` 里删掉 `push:` 段，仅保留 `workflow_dispatch`。

### 3. 手动只部署某一栈

GitHub → **Actions** → **Deploy** → **Run workflow** → 选择 `ocr` / `guide` / `both`。

### 4. 服务器上查看结果

```bash
cd /opt/ocr-wy
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.guide.production -f docker-compose.guide.yml ps
```

---

## 五、可选：关闭 push 自动部署

编辑 `.github/workflows/deploy.yml`，删除或注释：

```yaml
  push:
    branches: [main]
```

仅保留 `workflow_dispatch`，则只在 Actions 手动点部署。

---

## 六、与 Windows 上传脚本的关系

| 方式 | 适用 |
|------|------|
| `deploy/upload-and-deploy.ps1` | 本地打包 tar，不依赖服务器 Git |
| GitHub Actions Deploy | 服务器已是 git clone，CI/CD 统一从 GitHub 拉代码 |

`.env.production` / `.env.guide.production` **永远不要进 Git**；只留在服务器，Actions 不会覆盖（bootstrap 会读现有 env）。
