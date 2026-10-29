# 自测方案 · Guide（游戏配装资料站）

依据 [需求梳理版](../detail/需求-guide-梳理版.md)、[技术设计](../design/技术设计-guide.md)、[开发计划](../plan/开发计划-guide.md)。本文只规定怎么测，不改代码。

自测以 **接口最小请求**（curl / HTTP 客户端）核对路由、入参、出参与导入 CLI 为主。页面布局、移动端观感、SEO 收录由使用人自行看，**不作为通过条件**。OCR 主站、企微、小忧不在范围内。

## 测试范围

| 纳入 | 不纳入 |
|---|---|
| `guide:import` / `guide:import --dry-run` | 浏览器完整点击流、Playwright E2E |
| `GET /api/v1/health`、`/meta/current-version` | 精确伤害/ DPS 模拟 |
| 途径、场景、技能、装备、loadout 只读 API | Boss/怪物 Phase 2 数据 |
| `POST/GET /api/v1/shares` | 助手 PNG 资源上 CDN |
| 独立 `DATABASE_URL`（guide 库） | OCR `api` 业务接口回归 |
| 生产/预发：`wiki.wuyouclub.online` 可达 + `/api/` 反代 | `guide.wuyouclub.online` COS 活动页（仅确认未误改 DNS 即可） |
| 梳理版 §8 验收 1～6 的可接口化部分 | 全量 7 途径均有装备（首版仅 **sun** 必测） |

## 环境与前置

| 项 | 要求 |
|---|---|
| Node | ≥20，pnpm 与 monorepo 一致 |
| 数据库 | PostgreSQL 空库或 guide 专用库；已执行 `pnpm guide:prisma:migrate` |
| 数据 | `docs/游戏资料/` 可读；`apps/guide-api/data/gear/sun.yaml` 至少 1 件；`manifest.yaml` 已配置 |
| API | `guide-api` 监听 **3001**（或文档约定端口），`globalPrefix`=`api/v1` |
| 前台 | 本地 Next 或 standalone；`GUIDE_API_URL` 指向 API |
| 环境变量 | `GUIDE_WEB_ORIGIN` 含自测 Origin（如 `http://localhost:3000`）；生产测时用 `https://wiki.wuyouclub.online` |

**记**：`BASE` = `http://127.0.0.1:3001/api/v1`（经 Nginx 时改为 `https://wiki.wuyouclub.online/api/v1`）。

导入前置（每次清库或 fresh migrate 后）：

```powershell
pnpm guide:import --dry-run
pnpm guide:import
```

## 用例

### 导入与数据门禁（验收 5、开发计划 G14/G35）

| ID | 对应 | 步骤 | 期望 |
|---|---|---|---|
| IM-01 | 验收 5 | `pnpm guide:import --dry-run` | 退出码 0；无 Zod/校验 error；stdout 含途径、技能、sun gear 计数 ≥1 |
| IM-02 | 验收 5 | `pnpm guide:import` | 退出码 0；库中 `GameVersion.isCurrent=true` 一条 |
| IM-03 | T6 | 查库或 `GET /meta/current-version` | `semver`/`label` 与 manifest 中 `client_build` 一致（或文档约定字段） |
| IM-04 | 门禁 | 临时清空 `sun.yaml` 后 `--dry-run` | **失败**或非 0（若已实现 sun 非空门禁）；恢复 YAML 后再通过 |
| IM-05 | — | 重复执行 `guide:import` | 幂等：无 duplicate key 崩溃；记录数稳定 |

### 健康与元信息（验收 6）

| ID | 对应 | 步骤 | 期望 |
|---|---|---|---|
| HT-01 | 验收 6 | `GET {BASE}/health` | 200，`{ "status": "ok" }` 或等价 |
| HT-02 | 验收 3 | `GET {BASE}/meta/current-version` | 200；含 `gameVersion`（或 semver）、`verifiedAt` 可解析日期 |
| HT-03 | — | OCR api `GET http://127.0.0.1:3000/api/v1/health`（OCR 在跑时） | 仍 200；guide 迁移 **未**改动 OCR 库 |

### 途径与场景（U1）

| ID | 对应 | 步骤 | 期望 |
|---|---|---|---|
| PW-01 | U1 | `GET {BASE}/pathways` | 200；数组长度 **7**；含 `slug`=`sun`、`name` 含「太阳」 |
| PW-02 | U1 | `GET {BASE}/pathways/sun` | 200；含关联场景 id 或嵌套 `scenarios` |
| PW-03 | — | `GET {BASE}/pathways/not-exist` | 404 |
| PW-04 | U1 | `GET {BASE}/scenarios` | 200；至少含 PVE/PVP 或计划约定 code |

### 技能（U5、U7 可选）

| ID | 对应 | 步骤 | 期望 |
|---|---|---|---|
| SK-01 | U5 | `GET {BASE}/skills?pathway=sun` | 200；列表非空；项含 `slug`、`name` |
| SK-02 | U7 | `GET {BASE}/skills/{某 sun 技能 slug}` | 200；单条与列表一致 |
| SK-03 | — | `GET {BASE}/skills?pathway=invalid` | 200 空数组或 400（与实现一致，文档写明即可） |

### 装备（U2–U4，sun）

| ID | 对应 | 步骤 | 期望 |
|---|---|---|---|
| GR-01 | U3 | `GET {BASE}/gear?pathway=sun` | 200；长度 ≥1；项含 `slot`、`baseStats` 或等价 |
| GR-02 | U7 | `GET {BASE}/gear/{sun 某 slug}` | 200；`name` 与 YAML 一致 |
| GR-03 | U4 | 取两件 gear slug，本地或 API 返回的 stats | `calcLoadoutStats`（guide-types）加总与手工算一致（spot check 1 组） |
| GR-04 | — | `GET {BASE}/gear?pathway=fool` | 200；首版可为 **空数组**（未录装） |

### 推荐配装（U2）

| ID | 对应 | 步骤 | 期望 |
|---|---|---|---|
| LD-01 | U2 | `GET {BASE}/loadouts?pathway=sun&scenario={PVE code}` | 200；至少 1 条（如 `sun-pve`） |
| LD-02 | U2 | `GET {BASE}/loadouts/{slug}` | 200；含 `gearSlots`、`skillBar` 或 `comboSteps`；含 `verifiedAt`/`sourceNote` 或版本 id |
| LD-03 | — | `GET {BASE}/loadouts/not-exist` | 404 |

### 分享（U6）

Body 示例：

```json
{
  "pathwaySlug": "sun",
  "scenarioCode": "PVE",
  "gearSlots": { "WEAPON": "sun-wpn-001" },
  "comboSteps": [
    { "skillSlug": "s-86011010", "label": "起手" }
  ],
  "title": "自测分享"
}
```

（`skillSlug` 换成库中真实 slug。）

| ID | 对应 | 步骤 | 期望 |
|---|---|---|---|
| SH-01 | U6 | `POST {BASE}/shares`，合法 body | 201；响应含 `id`（短码）及 `urlPath` 或 `/s/{id}` |
| SH-02 | U6 | `GET {BASE}/shares/{id}` | 200；body 与 POST 字段一致（gearSlots、comboSteps） |
| SH-03 | 验收 2 | 用 SH-01 的 id 请求前台 `GET /s/{id}`（Next，可选）或仅 SH-02 | 数据一致即可判 U6 接口通过 |
| SH-04 | — | `GET {BASE}/shares/badid99` | 404 |
| SH-05 | — | POST 超大 body（>32KB）或非法 pathway | 400/413 |

### 合规与部署（验收 1、4）

| ID | 对应 | 步骤 | 期望 |
|---|---|---|---|
| DP-01 | 验收 1 | `GET https://wiki.wuyouclub.online/`（部署后） | 200；HTML 非 OCR 识单页 |
| DP-02 | 验收 1 | `GET https://wuyouclub.online/`（OCR） | 仍为识单/OCR 站；未因 guide 部署 502 |
| DP-03 | 验收 4 | `GET https://wiki.wuyouclub.online/legal/disclaimer` | 200；正文含非官方/无隶属表述 |
| DP-04 | 验收 6 | `GET https://wiki.wuyouclub.online/api/v1/health` | 200（Nginx 反代正确） |
| DP-05 | CORS | 从浏览器 Origin `https://wiki.wuyouclub.online` 调 `POST {BASE}/shares`（或 curl `-H Origin:`） | 无 CORS 阻断（预检/响应头允许） |

### 核心路径串联（验收 2，接口级）

| ID | 对应 | 步骤 | 期望 |
|---|---|---|---|
| E2E-API-01 | U1→U6 | PW-01 → LD-02 → GR-01 → SH-01 → SH-02 | 全程 2xx；share 中 pathway=sun，gear slug 均存在于 GR-01 |

## 可选（不记入 MVP 通过）

| ID | 说明 |
|---|---|
| UI-01 | `/build?pathway=sun` 手点选装、改连招、点分享 |
| UI-02 | 另一浏览器打开 `/s/{id}` 目视一致 |
| UI-03 | `/gear/[slug]`、`/skills/[slug]` ISR 页 200 |
| PERF-01 | `/build` 改装备后 stats 更新 <200ms（DevTools 粗测） |

## 用例与需求追溯

| 需求 ID | 自测 ID |
|---|---|
| U1 | PW-01～04 |
| U2 | LD-01～02 |
| U3 | GR-01～02 |
| U4 | GR-03 |
| U5 | SK-01、SH body comboSteps |
| U6 | SH-01～03、E2E-API-01 |
| U7 | SK-02、GR-02（可选 UI-03） |
| 验收 1 | DP-01～02 |
| 验收 2 | SH-02～03、E2E-API-01 |
| 验收 3 | HT-02 |
| 验收 4 | DP-03 |
| 验收 5 | IM-01～02 |
| 验收 6 | HT-01、HT-03、DP-04 |

## 通过 / 失败标准

**MVP 通过**（与开发计划「完成定义」一致）：

1. **IM-01、IM-02、HT-01、HT-02、PW-01、GR-01、LD-01、SH-01、SH-02、E2E-API-01** 全部期望满足。  
2. 部署环境：**DP-01、DP-03、DP-04** 满足（未部署前可仅本地 BASE 测 1～9 节，标注「预发未测」）。  
3. **HT-03**：确认 OCR 库与 API 未被 guide 迁移污染。

**失败**：任必测 ID 不符合期望；`guide:import --dry-run` 非 0；guide 与 OCR 共用同一 `POSTGRES_DB` 且表互相可见。

## 回归要点（版本更新后）

- 游戏 patch 后：更新 YAML / 解包 JSON → IM-01～02 → PW/SK/GR/LD  spot check。  
- 仅改代码未改数据：HT、SH、PW-01  smoke。  
- 换 `client_build`：HT-02 与页脚版本条一致。

## 文档映射

| 文档 | 路径 |
|---|---|
| 原始需求 | [docs/requirements/guide.md](../requirements/guide.md) |
| 需求梳理版 | [docs/detail/需求-guide-梳理版.md](../detail/需求-guide-梳理版.md) |
| 技术设计 | [docs/design/技术设计-guide.md](../design/技术设计-guide.md) |
| 开发计划 | [docs/plan/开发计划-guide.md](../plan/开发计划-guide.md) |
| 本文 | docs/test/自测方案-guide.md |

流水线四步文档已齐；实现请另开任务，从开发计划 **G1** 起执行。
