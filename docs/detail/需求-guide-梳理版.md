# 需求梳理 · Guide（游戏配装资料站）

| 文档 | 路径 |
|---|---|
| 原始需求 | [docs/requirements/guide.md](../requirements/guide.md) |
| 本文 | docs/detail/需求-guide-梳理版.md |
| 技术设计 | [docs/design/技术设计-guide.md](../design/技术设计-guide.md) |
| 开发计划 | [docs/plan/开发计划-guide.md](../plan/开发计划-guide.md) |
| 自测方案 | [docs/test/自测方案-guide.md](../test/自测方案-guide.md) |

## 1. 产品定位

**一句话**：面向《诡秘之主》正版 MMO 玩家的**实用型配装与连招工具站**，Wiki 为辅助；非官方、无版权方背书。

**已确认约束**（来自需求文档与用户决策）：

| 项 | 结论 |
|---|---|
| 目标游戏 | 刚公测的多端 MMO（配装、连招、PVE/PVP） |
| 项目性质 | 个人兴趣，非首期商业化 |
| 团队 | 一人全栈 + 自行维护数据 |
| 终端 | 仅网页 |
| 与 OCR 平台 | 同 monorepo，**不同产品、不同库、单独部署** |

**品牌与域名**：

- 配装站：**`https://wiki.wuyouclub.online`**。OCR 主站：`wuyouclub.online`。活动页 COS 仍用 **`guide.wuyouclub.online`**（与 deploy 示例一致，不与 wiki 混用）。
- **避开「诡秘之主」作为主品牌**（站点名、Logo、Title 不以 IP 名为主视觉）。
- 全站显著位置：非官方网站、与版权方无隶属关系；用户投稿与侵权投诉入口（首版可简化为静态页 + 邮箱）。

## 2. 用户与核心用例（MVP · 核心路径）

首版不追求完整 Wiki；**途径/技能可借助 `docs/游戏资料` 一次导入 7 途径**，以验证「连招 + 分享」闭环；**配装/属性**因无全量装备解包数据，首版用 **少量手工 YAML** 演示 U2–U4。

| ID | 用例 | 优先级 | 验收要点 |
|---|---|---|---|
| U1 | 选择途径/玩法场景 | Must | **7 途径可来自解包导入**；场景来自 `map_catalog` 清洗或手工枚举 |
| U2 | 查看推荐配装 | Must | 只读展示推荐方案（Git 数据）；标注适用版本与核验时间 |
| U3 | 调整已有装备 | Must | 从 **YAML 装备池**（游戏内录入）勾选/替换；首版不做全游戏装备 |
| U4 | 属性汇总 | Must | 规则加总（非战斗模拟）；数值来自 YAML 中的 `baseStats` / `affixes` |
| U5 | 连招顺序编辑 | Must | 技能步骤可增删排序；与配装页可联动或同页 |
| U6 | 保存/分享配置 | Must | 生成可分享的 URL 或短码；他人打开可还原配置 |
| U7 | 装备/技能百科页 | Should | 独立 URL，利于后续 SEO；首版可少量条目 |
| U8 | 攻略文章 | Could | 10～20 篇为文档 MVP 建议；**核心路径阶段可后置** |
| U9 | 后台 CMS | Won't（首版） | 用 **Git 数据 + 导入脚本** 代替 |

**端到端主路径**：

```text
选途径 → 选玩法 → 看推荐配装 → 改装备 → 看属性与连招建议 → 分享链接
```

## 3. 功能拆解

### 3.1 前台（`apps/guide`，Next.js）

- 路由与页面：首页（定位说明）、途径/场景入口、配装工作台、分享页、装备/技能详情（少量）、合规页（免责声明、联系/投诉）。
- 配装逻辑：客户端或服务端计算属性汇总（规则来自导入的数据版本）。
- 分享：编码配装 + 连招状态到 URL 或 ID；分享页 SSR/SSG 可读。
- SEO：装备/技能/分享页宜 SSG 或 ISR（技术设计细化）。

### 3.2 后端（`apps/guide-api`，NestJS）

- 独立 Prisma schema 与数据库（**不与 OCR `prisma/schema.prisma` 混库**）。
- 读 API：版本、途径、技能、装备、推荐方案、分享配置持久化（若分享需服务端存盘）。
- 写 API：首版可仅 **导入脚本 + 可选管理员 Token** 写入，无完整 CMS UI。
- 健康检查、CORS 指向 guide 前端 origin。

### 3.3 数据与导入（仓库内）

- 结构化数据目录（建议）：`apps/guide-api/data/` 或 `packages/guide-data/`（YAML/JSON + Markdown 攻略）。
- 导入脚本：校验 schema、绑定 `gameVersion`、upsert 到 DB；CI 或本地一条命令。
- 每条实体携带：适用版本、来源说明、最后核验日期、可选过期标记。

### 3.4 部署（与 OCR 分离）

- 独立 compose / 独立环境文件：Postgres（guide 库）、guide-api、guide-web（Next  standalone 或 Node）。
- 域名：**`wiki.wuyouclub.online`**（Nginx 反代 Next + guide-api）。
- 对象存储：Wiki 图可复用 COS 模式（私有写公有读 CDN），与 OCR 桶可同可异。

## 4. 非功能需求

| 类别 | 要求 |
|---|---|
| 性能 | 配装页交互 < 200ms 级本地计算；首屏可接受 SSR |
| 安全 | 管理/import 接口鉴权；无用户账号首版可不做注册 |
| 合规 | 非官方声明；少复制官方长文案与立绘；截图节制 |
| 可维护 | 游戏版本更新时改 Git 数据 + 跑导入，比改代码优先 |
| 可用性 | 移动端可读（配装页可简化布局） |

## 5. 范围 In / Out

**In（核心路径 MVP）**

- Monorepo：`apps/guide` + `apps/guide-api`（+ 可选 `packages/guide-types`）
- 解包导入 **7 途径 + 技能**；**装备由维护者在游戏内核对后写入 YAML**（见 T6；解包无全量装备表）
- 装备池、技能、推荐配装、属性汇总、连招编辑器、分享
- Git 数据 + 导入脚本
- 单独部署、独立 PostgreSQL

**Out（首版不做）**

- OCR/校友系统耦合、共用业务表
- 小说/动画全量百科、论坛、私信、游戏账号绑定
- 精确伤害模拟、AI 自动生成攻略
- 完整 CMS、多角色内容工作流
- 小程序/App

## 6. MoSCoW 汇总

| Must | Should | Could | Won't |
|---|---|---|---|
| U1–U6 | U7 少量百科 URL | U8 攻略 Markdown 渲染 | 完整 CMS |
| 版本化数据模型 | COS 静态图 | 全文搜索 | 与 OCR 同 compose 强绑定 |
| 免责声明 | 导入 dry-run | Meilisearch | 主品牌使用「诡秘之主」 |

## 7. 待澄清（实现前建议确认）

| # | 问题 | 默认（若不答） |
|---|---|---|
| T1 | 站点对外中文名/副标题（不含 IP 主品牌） | 如「途径配装助手」+ 副标题说明非官方 |
| T2 | 分享方案：**纯 URL 编码**（无 DB）还是 **短 ID 存库** | 短 ID 存库，便于长度与统计 |
| T3 | 访问形态 | **已确认：`wiki.wuyouclub.online` 根站** |
| T4 | 首版途径范围 | **默认 7 途径全导入**；`/build` 演示可仍默认 landing 某一途径 |
| T5 | 导入触发：仅本地 CLI vs 部署后 SSH/CI | 本地 CLI + 生产一次性 migrate/seed |
| T6 | 装备数据来源 | **已确认：游戏内实测录入 → `gear/*.yaml`（Git）**，解包 JSON 不用于装备 |

## 8. 验收标准（核心路径）

1. 独立域名（或约定子域）可访问 guide 前台，OCR 主站不受影响。
2. 用户走完 U1→U6，分享链接在另一浏览器可还原配装与连招。
3. 页面展示当前 **gameVersion** 与 **最后核验日期**。
4. 免责声明与 non-official 文案可见。
5. `pnpm`（或文档约定命令）可从 Git 数据完成导入且无校验错误（含解包技能 + **至少 1 个途径的 YAML 装备**）。
6. guide-api 健康检查通过；使用独立 `DATABASE_URL`。

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| 一人维护跟不上版本 | 技能/地图可 re-import；装备手工面小；过期标记 + `client_build` 对齐 |
| **装备数据缺失** | 首版小表 + 分享以**连招为主**；后续 DLL/抓包单独立项 |
| **第三方助手数据源** | `sourceNote` 写明出处；不沿用助手 Logo/图标包上公网 |
| 版权投诉 | 声明 + 少图少原文；投诉邮箱；随时下架入口 |
| 双栈维护成本 | 复用 Nest/Prisma 经验；Next 仅 guide 使用；类型共享 package |
| 空数据上线 | `guide:import` 至少导入技能；无技能数据不部署生产 |

## 9.1 数据资产可行性（`docs/游戏资料`）

| 资产 | 结论 |
|---|---|
| 途径 + 技能名称/归属 | **可行（高）** — `skill_metadata.json` + `skill_names.json` |
| 玩法/副本标签 | **可行（中高）** — `map_catalog_20260918.csv` |
| 怪物/Boss | **可行（中，后置）** — `monster_metadata.json`、`boss_*` |
| 全量装备与词条 | **首版：游戏内录入 YAML**（T6）；全量仍靠持续人工，不做 DLL 抓包 |
| 技能/Boss 图标 | **不建议首版依赖** — metadata 仅为 UE 路径；助手 PNG 未入库且有版权风险 |

数据版本建议：导入 manifest 引用 `_release_identity.json` 的 `client_build` 作为 `gameVersion` 别名。

## 10. 文档映射

- 技术设计已完成，见 [技术设计-guide.md](../design/技术设计-guide.md)。
- 开发计划已完成，见 [开发计划-guide.md](../plan/开发计划-guide.md)。
- 自测方案已完成，见 [自测方案-guide.md](../test/自测方案-guide.md)。
- **文档流水线已闭合**；实现请另开任务，从开发计划 **G1** 起脚手架与编码。
