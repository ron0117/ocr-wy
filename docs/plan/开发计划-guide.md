# 开发计划 · Guide（游戏配装资料站）

依据 [需求梳理版](../detail/需求-guide-梳理版.md)、[技术设计](../design/技术设计-guide.md)。**本计划只拆任务**；脚手架与编码须用户另开实现任务。

## 里程碑

一人 **业余节奏** 约 **4～6 周**；若连续全职可压到 **2～3 周**。内容与开发可交错（见 §内容任务）。

| 里程碑 | 完成标准 | 建议工期 |
|---|---|---|
| **M0 工程骨架** | `apps/guide`、`apps/guide-api`、`packages/guide-types` 可本地跑；根脚本 `dev:guide*` | 2～3 天 |
| **M1 数据层** | `prisma/guide` 迁移成功；`guide:import --dry-run` 通过 | 2～3 天 |
| **M2 导入与种子** | 从 `docs/游戏资料` 导入 7 途径+技能；**太阳途径** YAML 装备+1 套 loadout 入库 | 2～4 天（含游戏内录装） |
| **M3 guide-api** | 技术设计 §7 读接口 + POST/GET shares + health；CORS 正确 | 3～4 天 |
| **M4 前台核心路径** | U1–U6 在 `/build`、`/s/[id]` 可走通；免责声明与版本条 | 4～6 天 |
| **M5 单独部署** | `wiki.wuyouclub.online` HTTPS；OCR compose 不受影响 | 1～2 天 |
| **M6 Should（可延后）** | U7 装备/技能 ISR 页；其余 6 途径补 gear YAML | 持续迭代 |

**MVP 发布线**：M0 → M1 → M2 → M3 → M4 → M5（**M6 不阻塞首版**）。

## MVP 与用例对齐

| 用例 | 里程碑 | 备注 |
|---|---|---|
| U1–U6 | M2–M4 | 验收见梳理版 §8 |
| U7 | M6 | 可先只做已录入 gear/skill |
| U8–U9 | Out | — |

**首录途径（默认）**：**太阳途径**（解包 id `1200001`，slug 建议 `sun`）。`/build` 默认 `?pathway=sun`。其余途径先导入技能，装备后续按 YAML 增量。

## 任务拆分

### M0 工程骨架

- [ ] **G1** 新建 `packages/guide-types`：`PathwayDto`、`SkillDto`、`GearDto`、`ShareCreateBody`、`calcLoadoutStats`、`StatRules` 类型。
- [ ] **G2** 新建 `prisma/guide/schema.prisma`（技术设计 §4 实体）；`guide:prisma:generate` / `guide:prisma:migrate` 脚本写入根 `package.json`。
- [ ] **G3** 新建 `apps/guide-api`：Nest 骨架、`PrismaModule` 指向 guide client、`GET /api/v1/health`；端口 **3001**（与 OCR api 3000 区分）。
- [ ] **G4** 新建 `apps/guide`：Next 15 App Router、`standalone`、Tailwind 或现有偏好；环境变量 `GUIDE_API_URL`。
- [ ] **G5** 根 `package.json`：`dev:guide-api`、`dev:guide`、`build:guide`；`pnpm-workspace` 已含 `apps/*` 无需改。

### M1 数据层与 manifest

- [ ] **G6** 创建 `apps/guide-api/data/manifest.yaml`；`gameVersion` 读 `docs/游戏资料/_release_identity.json` 的 `client_build`。
- [ ] **G7** 定义途径 slug 映射（importer 常量）：`1200001→sun`，`1200002→dreamer`，`1200003→fool`，`1200004→arbitrator`，`1200005→door`，`1200006→giant`，`1200007→hermit`。
- [ ] **G8** `scripts/guide-import.ts`：Zod 校验；子命令 `--dry-run`；写 `ImportRun`（可选首版简化日志即可）。

### M2 导入与内容（开发 + 维护者）

- [ ] **G9** Importer：**`skill_metadata.json` + `skill_names.json`**（路径可配置，默认 `../../docs/游戏资料/` 或复制到 `data/sources/`）。
- [ ] **G10** Importer：**`map_catalog_20260918.csv`** → `PlayScenario` 去重（至少 `PVE`、`PVP` 等）；失败时可 fallback `data/scenarios.yaml` 手工 3 条。
- [ ] **G11** Importer：**`gear/*.yaml`**、**`loadouts/*.yaml`**、**`rules/stats-v1.json`**。
- [ ] **G12** **内容**：游戏内录入 **`data/gear/sun.yaml`**（5～15 件，覆盖主要槽位）。
- [ ] **G13** **内容**：**`data/loadouts/sun-pve.yaml`**（一套 PVE 推荐：`gearSlots` + `skillBar` + `comboSteps`）。
- [ ] **G14** 本地：`guide:prisma:migrate` + `pnpm guide:import`；DB 内可见 7 途径、技能、sun 装备与 loadout。

### M3 guide-api 业务接口

- [ ] **G15** `MetaModule`：`GET /meta/current-version`。
- [ ] **G16** `PathwaysModule`：`GET /pathways`、`GET /pathways/:slug`（含场景 id）。
- [ ] **G17** `SkillsModule`：`GET /skills`、`GET /skills/:slug`（Query `pathway`）。
- [ ] **G18** `GearModule`：`GET /gear`、`GET /gear/:slug`（Query `pathway`, `slot`）。
- [ ] **G19** `LoadoutsModule`：`GET /loadouts`、`GET /loadouts/:slug`。
- [ ] **G20** `SharesModule`：`POST /shares`、`GET /shares/:id`（nanoid 短 id）；Body 校验与大小限制。
- [ ] **G21** CORS：`GUIDE_WEB_ORIGIN=https://wiki.wuyouclub.online`（本地含 `http://localhost:3000`）。
- [ ] **G22**（可选）`POST /internal/import` + `GUIDE_IMPORT_TOKEN` — 可放到 M5 后。

### M4 Next 前台（核心路径）

- [ ] **G23** 布局：`VersionBar`（调 meta API）、`DisclaimerFooter`、T1 站名「途径配装助手」。
- [ ] **G24** `/` 首页：非官方说明、进入 `/pathways` 或 `/build`。
- [ ] **G25** `/pathways`、`/pathways/[slug]`：途径列表与入口（U1）。
- [ ] **G26** **`/build`**：途径/场景选择；加载推荐 loadout（U2）；装备槽编辑器（U3）；`calcLoadoutStats`（U4）；连招列表拖拽/排序（U5）；「生成分享」调 POST shares（U6）。
- [ ] **G27** **`/s/[id]`**：SSR 拉 share，展示只读 build + 复制链接。
- [ ] **G28** `/legal/disclaimer`、`/legal/takedown`（投诉邮箱 env：`GUIDE_CONTACT_EMAIL`）。
- [ ] **G29**（Should）`/gear/[slug]`、`/skills/[slug]` ISR — 可与 M6 合并。

### M5 部署（与 OCR 分离）

- [ ] **G30** `deploy/docker-compose.guide.yml`：`postgres-guide`、`guide-api`、`guide-web`（+ 可选 nginx 容器或宿主机 nginx）。
- [ ] **G31** `deploy/Dockerfile.guide-api`、`deploy/Dockerfile.guide`（多 stage，含 prisma generate + migrate deploy）。
- [ ] **G32** `deploy/nginx.guide.https.conf`：`wiki.wuyouclub.online` → web:3000，`/api/` → api:3001。
- [ ] **G33** `deploy/.env.guide.production.example`：`DATABASE_URL`、`GUIDE_WEB_ORIGIN`、`JWT` 不需要（无登录）。
- [ ] **G34** DNS + Certbot：**`wiki.wuyouclub.online`** 证书；确认 **`guide.wuyouclub.online`** 仍仅 COS，不动 OCR 主 compose。
- [ ] **G35** 生产：镜像构建 → migrate deploy → **容器内或 CI 执行 `guide:import`**（门禁：sun gear 非空）。

### M6 迭代（Post-MVP）

- [ ] **G36** 其余 6 途径 `gear/*.yaml` + loadout（每途径至少 1 套）。
- [ ] **G37** Boss/怪物数据 Phase 2 导入与页面。
- [ ] **G38** `POST /shares` 限流、COS Wiki 图（前缀 `/wiki/`）。

## 依赖顺序

```text
G1 → G3、G4
G2 → G3 → G6 → G8
G8 → G9 → G10 → G11
G12、G13 与 G9～G11 可并行（内容不阻塞 importer 开发，但 M2 完成需 G12～G14）
G11 + G14 → G15～G20
G15～G20 + G1 → G23～G28
G3、G4 稳定 → G30～G35
G29、G36～G38 任意后置
```

**推荐实施顺序（单人）**：

```text
G1→G2→G3→G4→G6→G7→G8→G9→G10→G11
  →（并行）G12→G13→G14
  →G15→G16→G17→G18→G19→G20→G21
  →G23→G24→G25→G26→G27→G28
  →G30→G31→G32→G33→G34→G35
```

## 内容与开发并行建议

| 周 | 开发侧重 | 内容侧重 |
|---|---|---|
| 1 | M0 + M1 + importer 技能 | 熟悉面板字段；起草 `sun.yaml` 模板 |
| 2 | M3 API + M4 `/build` 骨架 | 完成 **sun** 5～15 件 + **sun-pve** loadout |
| 3 | M4 分享页 + 联调 U1–U6 | 核对 `verifiedAt`、游戏 patch 是否变 |
| 4 | M5 部署 + dry-run 门禁 | 可选：第二途径装备 |

## 人力与并行

仅 **一人** 时无并行；若日后加贡献者：

| 角色 | 可独立任务 |
|---|---|
| 开发 | G1–G11、G15–G35 |
| 内容维护 | G12–G13、G36（YAML PR + import） |

汇合点：YAML schema 以技术设计 §5.5 为准；importer 变更需同步文档。

## 风险与缓冲

| 风险 | 计划缓冲 |
|---|---|
| 录装比预期慢 | M4 可先上线「仅 sun 有装备」；其余途径连招仍可用 |
| CSV 场景清洗费时 | G10 fallback 手工 `scenarios.yaml`，±0.5 天 |
| Next + Nest 双栈不熟 | M0 多留 1 天；复用 OCR 的 Nest 模式 |
| 证书/DNS | M5 单独 1 天缓冲 |

## 完成定义（MVP Done）

1. 梳理版 §8 验收 1～6 满足。  
2. `pnpm guide:import --dry-run` 在 CI 或发布脚本中执行且无 error。  
3. 生产 URL：`https://wiki.wuyouclub.online/build?pathway=sun` 可完成分享并在 `/s/{id}` 还原。  

## 文档映射

| 文档 | 路径 |
|---|---|
| 原始需求 | [docs/requirements/guide.md](../requirements/guide.md) |
| 需求梳理版 | [docs/detail/需求-guide-梳理版.md](../detail/需求-guide-梳理版.md) |
| 技术设计 | [docs/design/技术设计-guide.md](../design/技术设计-guide.md) |
| 本文 | docs/plan/开发计划-guide.md |
| 自测方案 | [docs/test/自测方案-guide.md](../test/自测方案-guide.md) |
