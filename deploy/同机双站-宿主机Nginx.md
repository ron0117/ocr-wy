# 同机双站：一个宿主机 Nginx 代理识单 + wiki

## 一键部署（推荐）

服务器已装 Docker、Git、Nginx 时，在项目根目录：

```bash
sudo bash deploy/bootstrap-dual-host-centos.sh
```

脚本会：写入 `OCR_PUBLISH_HTTP` / `GUIDE_PUBLISH_HTTP` 回环端口、启动两套 compose、配置宿主机 Nginx、申请含主域 + wiki 的证书并启用 HTTPS。需 `.env.production` 与 `.env.guide.production`（无则从 example 生成）。

## 现象

访问 `https://wiki.wuyouclub.online/` 出现识单（「无忧俱乐部」）页面，或浏览器最终停在 `wuyouclub.online`。

常见原因：

1. **CDN 源站相同**：`wiki` 与 `wuyouclub.online` 都走腾讯云 CDN，回源到同一 IP:443，而源站只有识单容器 Nginx，`server_name` 不含 `wiki`，请求会落到 **default_server**，返回识单静态页（HTTP 仍是 200，不是 301）。
2. **443 端口冲突**：识单 `docker-compose.prod.yml` 已占用 80/443，Guide 默认只能 8080/8443；若 CDN 只回源 443，wiki 永远进不了 Guide。
3. **8443 未放行**：Guide 在 8443 但安全组/CDN 未开放时，无法走「wiki 单独回源 8443」方案。

## 推荐架构（一台机、一个对外 Nginx）

```
客户端 → CDN(可选) → 源站公网:443 宿主机 Nginx
                      ├─ server_name wuyouclub.online  → 127.0.0.1:9080 (OCR 容器)
                      └─ server_name wiki.wuyouclub.online → 127.0.0.1:9081 (Guide 容器)
```

容器内各自仍带 Nginx，但 **只监听回环 HTTP**，不再占用公网 443。

## 操作步骤

### 1. 安装并启用宿主机 Nginx

CentOS/RHEL 示例：

```bash
dnf install -y nginx
systemctl enable --now nginx
```

### 2. 释放公网 443（改由宿主机监听）

在项目根目录：

```bash
# 识单：去掉容器对 80/443 的绑定，改为 127.0.0.1:9080
docker compose --env-file .env.production \
  -f docker-compose.prod.yml -f docker-compose.host-proxy.ocr.yml up -d --build

# wiki：去掉 8080/8443 公网映射，改为 127.0.0.1:9081
docker compose --env-file .env.guide.production \
  -f docker-compose.guide.yml -f docker-compose.host-proxy.guide.yml up -d --build
```

确认本机：

```bash
curl -sI -H 'Host: wuyouclub.online' http://127.0.0.1:9080/ | head -1
curl -sI -H 'Host: wiki.wuyouclub.online' http://127.0.0.1:9081/ | head -1
```

第二条应看到 Next 页面（标题「无忧玩家工具」），而不是识单。

释放端口自检（**必须**无公网 `docker-proxy` 占 80/443）：

```bash
docker compose --env-file .env.production \
  -f docker-compose.prod.yml -f docker-compose.host-proxy.ocr.yml \
  config | sed -n '/^  web:/,/^  [a-z]/p' | grep ports -A5

sudo ss -tlnp | grep -E ':80 |:443 '
```

若 `config` 里仍有 `"80:80"` / `"443:443"`，说明 compose 把 `ports` 叠在一起了；`docker-compose.host-proxy.*.yml` 已用 `!reset` 覆盖（需 Compose 2.24+）。旧版可临时在服务器只保留 `127.0.0.1:9080:80` 一行后 `up -d --force-recreate web`。

### 3. 部署宿主机站点配置

```bash
cp deploy/nginx.00-performance.conf /etc/nginx/conf.d/00-performance.conf
cp deploy/nginx.host.dual.conf.example /etc/nginx/conf.d/wuyouclub-dual.conf
nginx -t && systemctl reload nginx
```

`00-performance.conf` 启用 **gzip**（含 `gzip_proxied` 压缩反代响应）、`sendfile`、upstream **keepalive** 与 `Connection ""` 配合，减少 TLS 下传输体积与连接开销。若 CDN 已开启压缩，可保留源站 gzip（体积不大）或只保留一层，避免重复压缩已 gzip 的资源。

证书（HTTP-01，需 80 由宿主机 Nginx 提供 `/.well-known`）：

```bash
mkdir -p /var/www/certbot
certbot certonly --webroot -w /var/www/certbot \
  -d wuyouclub.online -d wiki.wuyouclub.online
# 或分两个证书，并改 conf 里 ssl_certificate 路径
nginx -t && systemctl reload nginx
```

### 4. 腾讯云 CDN（若 wiki / 主站仍走 CDN）

对 **两个加速域名** 分别配置（不要共用「同一套源站只指向识单」）：

| 加速域名 | 回源地址 | 回源 Host |
|----------|----------|-----------|
| `wuyouclub.online` | 源站公网 IP，端口 **443** | 默认（加速域名） |
| `wiki.wuyouclub.online` | 同上 **443** | 默认（加速域名） |

源站必须是 **按 Host 分流的宿主机 Nginx**（上一节）。改完后在 CDN 控制台 **刷新** wiki 域名缓存。

**EdgeOne 回源 HTTP 80 时**：源站 **不能** 对 wiki/主域在 80 上统一 `return 301 https`（否则边缘 HTTPS + 源站 301 会死循环，Next `/_next/static` 全失败）。使用 `nginx.host.dual.conf.example` 中「80 分域名反代」版本。

若暂时不用 CDN 调试：把 `wiki` 的 DNS 改为 **A 记录直连源站 IP**，验证通过后再接 CDN。

### 5. 备选：wiki 单独回源 8443

不改宿主机 Nginx、仍让 Guide 容器自带 TLS 时：

- Guide 保持 `GUIDE_HTTPS_PORT=8443` 映射公网；
- CDN 上 **仅 wiki** 加速域名回源 `IP:8443`；
- 安全组放行 TCP 8443。

识单仍占 443。此方案与「只有一个对外 Nginx」目标不一致，但改动最小。

## 环境变量（写在各自 prod `.env`）

| 文件 | 关键项 |
|------|--------|
| `.env.production` | `DEPLOY_DUAL_HOST=true`、`OCR_PUBLISH_HTTP=127.0.0.1:9080:80`、`OCR_CONTAINER_CERTBOT_DOMAIN=none`、`CERTBOT_DOMAIN` / `WEB_ORIGIN`；Wiki 后台还需 `GUIDE_API_URL=http://guide-api:3001`、`GUIDE_ADMIN_TOKEN`（与 guide 侧一致） |
| `.env.guide.production` | `GUIDE_PUBLISH_HTTP=127.0.0.1:9081:80`、`GUIDE_CONTAINER_CERTBOT_DOMAIN=none`、`GUIDE_CERTBOT_DOMAIN` / `GUIDE_WEB_ORIGIN`；`GUIDE_ADMIN_TOKEN` 与识单 `.env.production` 相同 |

识单 `api` 与 `guide-api` 通过 Docker 网络 `ocr_guide_internal` 互通（`bootstrap-dual-host-centos.sh` 会自动 `docker network create`）。勿用 `host.docker.internal:3001`（guide-api 未映射宿主机 3001）。

模板见 `deploy/.env.production.example` 与 `deploy/.env.guide.production.example`。`bootstrap-dual-host-centos.sh` **不会覆盖**你已写好的键，只补缺失默认值。
