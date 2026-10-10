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
