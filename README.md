# 识单

把商品图片整理成可核对、可下载的表格。流程是：上传图片 → 中文 OCR → 按模板或对话整理 → 人工修正 → 生成 Excel。

AI 只负责把 OCR 原文整理成结构化数据，不能补造价格或数量。原图、OCR JSON、整理结果和 Excel 分开保存。下载前会检查任务是否属于当前用户。

## 本地运行

需要 Node.js 20、pnpm，以及 Docker 里的 PostgreSQL。PaddleOCR 单独跑在 Python 服务中。

```powershell
docker compose up -d postgres
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm db:seed
pnpm dev:api
pnpm dev:web
```

打开 http://localhost:5173 。演示账号：

- 邮箱 `demo@example.com`
- 密码 `Demo123456`

未配置 `AI_API_KEY` 时，整理走本地规则：有表头时按列提取，单行文本只按“名称 单价 数量”解读，对不上原文的价格和数量会被清空。

## OCR 服务

```powershell
pnpm dev:ocr
```

服务使用 RapidOCR 的中文模型，首次识别会下载模型。服务监听本机 8000 端口，可选 `OCR_AUTH_TOKEN`。

## 存储

默认 `STORAGE_DRIVER=local`，文件写到 `data/storage`，路径仍是 `ocr/{userId}/{taskId}/...`。切换到 GCS 时设置：

```
STORAGE_DRIVER=gcs
GCS_BUCKET=your-private-ocr-bucket
```

运行环境使用最小权限的 Application Default Credentials。签名下载链接 5 分钟有效，并且只在确认资源属于当前用户后签发。

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

脚本会完成以下工作：

- 安装并启用 Docker Engine 与 Compose 插件；
- 自动生成 `.env.production`，其中包含随机数据库密码、JWT 密钥和 OCR 密钥；
- 构建镜像、执行 Prisma 迁移并启动全部服务；
- 在启用了 firewalld 时开放 HTTP 端口。

部署完成后访问脚本输出的地址。使用域名时，编辑 `.env.production` 中的
`WEB_ORIGIN`，然后再次运行同一脚本。云服务器还需要在厂商安全组中放行 TCP 80。

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
`docker compose down -v`，否则会删除这些数据。正式公网部署建议再配置 HTTPS
反向代理或云负载均衡，并把 `WEB_ORIGIN` 改为对应的 `https://` 地址。
