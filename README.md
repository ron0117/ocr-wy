# 识单

把商品图片整理成可核对、可下载的表格。流程是：上传图片 → 中文 OCR → 按模板或对话整理 → 人工修正 → 生成 Excel。

AI 只负责把 OCR 原文整理成结构化数据，不能补造价格或数量。原图、OCR JSON、整理结果和 Excel 分开保存。下载前会检查任务是否属于当前用户。

## 本地运行

需要 Node.js 20、pnpm，以及 Docker 里的 PostgreSQL。

```powershell
docker compose up -d postgres
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm db:seed
pnpm dev:api
pnpm dev:web
```

打开 http://localhost:5777 。演示账号：

- 邮箱 `demo@example.com`
- 密码 `Demo123456`

未配置 `AI_API_KEY` 时，整理走本地规则：有表头时按列提取，单行文本只按“名称 单价 数量”解读，对不上原文的价格和数量会被清空。

## 存储

默认 `STORAGE_DRIVER=local`，文件写到 `data/storage`，路径仍是 `ocr/{userId}/{taskId}/...`。切换到 GCS 时设置：

```
STORAGE_DRIVER=gcs
GCS_BUCKET=your-private-ocr-bucket
```

运行环境使用最小权限的 Application Default Credentials。签名下载链接 5 分钟有效，并且只在确认资源属于当前用户后签发。

## 活动页静态媒体（COS / CDN）

`apps/web/public/` 下的 HTML（如 `20261027/20261027.html`）随前端镜像由 Nginx 提供；大图、视频可单独上传到腾讯云 COS，并用自定义域名或 CDN 加速（页面仍访问 `https://你的域名/20261027/20261027.html`）。

### `pnpm upload:public-cos`

根目录脚本 **`scripts/upload-public-cos.ts`**，用于把活动页媒体同步到 COS（桶需 **私有写、公有读**）。

**不会**上传整个 `public/` 目录，只上传 `apps/web/public-asset-pages.ts` 里 `PUBLIC_ASSET_PAGES` 列出的文件（当前为 `20261027/` 下 4 个图片/视频）。`*.html`、`WW_verify_*.txt` 等仍由主站 Nginx 提供，不上 COS。

| 命令 | 作用 |
|------|------|
| `pnpm upload:public-cos` | 上传到 COS，写入 manifest，并把 `PUBLIC_ASSET_PAGES` 对应 HTML 里的相对媒体路径改成 COS/CDN 绝对地址 |
| `pnpm upload:public-cos --write-env` | 同上，并更新根目录 `.env.production` 中的 `VITE_PUBLIC_ASSET_CDN`、`VITE_PUBLIC_ASSET_OMIT_LOCAL=true`（构建时从 `dist` 剔除已上 COS 的媒体，镜像里只留 HTML） |
| `pnpm upload:public-cos --dry-run` | 不实际上传、不改 HTML，只打印将使用的对象键与 URL |
| `pnpm build:web-with-cos` | `upload:public-cos --write-env` 后执行 web 生产构建 |

**环境变量**（写在项目根 `.env.production`，可参考 `deploy/.env.production.example`；带 `#` 的行不会被脚本读取）：

```
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=桶名-APPID
COS_REGION=ap-shanghai
COS_PUBLIC_BASE_URL=https://你的静态资源域名
COS_KEY_PREFIX=
```

未设置 `COS_PUBLIC_BASE_URL` 时，公网地址使用默认 COS 域名 `https://<bucket>.cos.<region>.myqcloud.com`。自定义域名须已在 COS/CDN 控制台配置 **HTTPS 证书**，否则浏览器会报「连接不安全」。

**本地验证（A 方案：HTML 在本机/主站，媒体走 COS）：**

```powershell
Copy-Item deploy\.env.production.example .env.production   # 首次：填入 COS_* 并去掉注释
pnpm upload:public-cos --write-env
pnpm --filter @ocr/web build
pnpm --filter @ocr/web preview
# 打开 http://127.0.0.1:4173/20261027/20261027.html，在 Network 中确认媒体来自 COS/CDN 域名
```

HTML 在上传成功后会直接写成 COS 地址；本地 `pnpm dev:web` 也会走 CDN 拉媒体（需网络）。若仍想用相对路径开发，先不要执行上传，或从 git 还原 `public/` 内 HTML。

**生产部署：** 推荐 `pnpm build:web-with-cos`（上传 + 改 HTML + 写 `.env.production` + 构建）。构建阶段在 `VITE_PUBLIC_ASSET_OMIT_LOCAL=true` 时会删除 `dist` 里已上 COS 的大文件，Nginx 镜像不再携带这些媒体。再运行 `deploy/bootstrap-centos.sh` / `upload-and-deploy.ps1`；`docker-compose.prod.yml` 会把 `.env.production` 里的 CDN/OMIT 变量传入 web 镜像构建。

新增活动页媒体时，在 `apps/web/public-asset-pages.ts` 增加文件名后重新执行 `pnpm upload:public-cos`（会同步 `.dockerignore` 与 `deploy/public-cos-excludes.txt`）。

## 尚未包含

任务量上来之后再加 Redis 和 BullMQ。当前识别、整理和导出都在请求内完成。

## CentOS 生产部署

生产环境使用 Docker Compose 运行 PostgreSQL、OCR、API 和 Nginx。全新的 CentOS
服务器不需要预装 Node.js、Python、PostgreSQL 或 Nginx，初始化脚本会安装 Docker。
建议使用 CentOS Stream 9（同样适用于 Rocky Linux/AlmaLinux 8 或 9），至少准备
2 核 CPU、4 GB 内存和 20 GB 磁盘。

先把整个项目上传或克隆到服务器，然后在项目根目录执行：

```bash
sudo bash deploy/bootstrap-centos.sh
```

也可以直接使用以下两种传输脚本。

从 Git 仓库克隆并部署（脚本需要先单独放到服务器）：

```bash
sudo bash install-from-git.sh https://github.com/你的账号/ocr-wy.git /opt/ocr-wy main
```

**GitHub Actions 自动构建 / SSH 部署**（CI 在云端编译，Deploy 合并 `main` 后跑 `bootstrap-*.sh`）：见 [`deploy/github-actions-部署说明.md`](deploy/github-actions-部署说明.md)。

如果仓库已经位于 `/opt/ocr-wy`，脚本只接受可以快进合并的更新，不会强制覆盖
服务器上的代码。私有仓库建议使用 SSH 仓库地址，并提前配置服务器的部署密钥。

从 Windows 开发机直接上传并部署，在项目根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File deploy/upload-and-deploy.ps1 `
  -Server 124.222.204.107 -User root -RemoteDir /opt/ocr-wy
```

使用 SSH 私钥时再加 `-IdentityFile C:\路径\id_ed25519`。上传脚本会排除
`.git`、`node_modules`、构建产物、本地环境变量和本地数据，不会把开发机密码上传；
服务器已有的 `.env.production` 会被保留。

另会读取 `deploy/public-cos-excludes.txt`（由 `pnpm upload:public-cos` 根据 `public-asset-pages.ts` 生成），**部署包与 Docker 构建上下文均不再包含已上 COS 的 public 媒体**。新增活动页媒体后请重新执行 `upload:public-cos` 并提交生成的 exclude 文件。

脚本会完成以下工作：

- 安装并启用 Docker Engine 与 Compose 插件；
- 自动生成 `.env.production`，其中包含随机数据库密码、JWT 密钥和 OCR 密钥；
- 构建镜像、执行 Prisma 迁移并启动全部服务；
- 在启用了 firewalld 时开放 HTTP 和 HTTPS 端口；
- 为 `wuyouclub.online` 申请 Let's Encrypt 证书，成功后把站点切到 443，并把 `WEB_ORIGIN` 改为 `https://wuyouclub.online`。

部署完成后访问脚本输出的地址。证书校验仍走 80 端口，云服务器安全组需要同时放行 TCP 80 和 TCP 443。

更新代码后仍运行同一命令，脚本会重新构建并滚动重建有变化的容器：

```bash
sudo bash deploy/bootstrap-centos.sh
```

常用运维命令：

```bash
# 查看状态
sudo docker compose --env-file .env.production -f docker-compose.prod.yml ps

# 查看日志
sudo docker compose --env-file .env.production -f docker-compose.prod.yml logs -f

# 停止服务（不会删除数据库和上传文件）
sudo docker compose --env-file .env.production -f docker-compose.prod.yml down
```

如果需要演示账号，可把 `.env.production` 的 `SEED_DATABASE` 临时改为 `true`，
执行一次部署后再改回 `false`。生产数据位于 Docker 命名卷
`ocr-platform_postgres_data` 和 `ocr-platform_app_storage`，不要使用
`docker compose down -v`，否则会删除这些数据。域名解析到这台服务器后，
重新运行部署脚本即可签出证书，站点通过 `https://wuyouclub.online` 访问。

## 途径配装助手（Guide / wiki）

与识单 **独立数据库、独立端口**，源码在 `apps/guide`（Next）与 `apps/guide-api`（Nest）。生产域名为 `https://wiki.wuyouclub.online`（见 `docs/plan/开发计划-guide.md`）。

本地（PostgreSQL 与 OCR 同实例，**另建库 `guide`**；若 OCR 用 `5433`，见 `apps/guide-api/.env.example`）：

```powershell
# 根目录 .env 增加 GUIDE_DATABASE_URL（见 .env.example；未配置时会尝试把 DATABASE_URL 的库名 ocr 换成 guide）

pnpm guide:prisma:migrate
pnpm guide:import
pnpm dev:guide-api   # http://127.0.0.1:3001/api/v1/health
pnpm dev:guide         # http://localhost:3002 （/api 反代到 3001）
```

游戏内录入的装备写在 `apps/guide-api/data/gear/*.yaml`；途径/技能解包 JSON 在 `apps/guide-api/data/sources/`（可从 `docs/游戏资料/` 同步更新，**部署包不含 `docs/`**）；封印物 Markdown 与图标在 `apps/guide/data/seals/`。改数据后重新 `pnpm guide:import`。分享码技能名反查会在 `pnpm dev:guide` / `pnpm build` 前自动把 `skill_names.json` 同步到 `apps/guide/data/`（源文件在 `apps/guide-api/data/sources/`）。

### 生产部署（wiki 独立 compose）

从 Windows 开发机一键上传并部署（与识单 `upload-and-deploy.ps1` 用法相同；可选 `-IdentityFile` 指定私钥）：

```powershell
powershell -ExecutionPolicy Bypass -File deploy/upload-and-deploy-guide.ps1 `
  -Server 124.222.204.107 -User root -RemoteDir /opt/ocr-wy
```

脚本会排除 `.git`、`node_modules`、本地 `.env*`；服务器上已有的 `.env.guide.production` 与 `.env.production`（识单）均会保留。远程在构建成功后自动执行 **`deploy/bootstrap-dual-host-centos.sh`**（识单 + wiki + 宿主机 Nginx 分流）。

已在 Linux 服务器上有代码时（项目根目录，需 root 或 sudo）：

```bash
cp deploy/.env.guide.production.example .env.guide.production
# 编辑密码、GUIDE_WEB_ORIGIN、端口与 GUIDE_CERTBOT_DOMAIN=wiki.wuyouclub.online

sudo bash deploy/bootstrap-guide-centos.sh
```

若 Docker 已就绪、只需重建容器，可只执行：

```bash
docker compose --env-file .env.guide.production -f docker-compose.guide.yml up -d --build
```

默认 **8080/8443** 映射，避免与识单 `docker-compose.prod.yml` 的 80/443 冲突。DNS 将 `wiki.wuyouclub.online` 指到服务器后，按需改端口或在前置 Nginx 按子域转发。首次 `SEED_GUIDE=true` 会在 migrate 后自动导入数据。

**同机只有一个对外 Nginx（推荐）**：若 wiki 与主站共用 CDN 回源 443，源站必须按 `Host` 分流，否则 wiki 会显示识单页。一键脚本：

```bash
sudo bash deploy/bootstrap-dual-host-centos.sh
```

详见 [`deploy/同机双站-宿主机Nginx.md`](deploy/同机双站-宿主机Nginx.md)。
