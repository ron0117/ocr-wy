# 自测方案 · Wiki 分享与秘偶图鉴

依据 [需求梳理版](../detail/需求-wiki分享-梳理版.md)、[技术设计](../design/技术设计-wiki分享.md)、[开发计划](../plan/开发计划-wiki分享.md)。本文只规定怎么测，不改代码。

通过条件是 **最小 HTTP 请求**：分享用 guide-api，图鉴用前台路由返回的 HTML / 图片。配装台点击、Tab 搜索手感、配色由使用人自己看，**不作为通过条件**。不写、不跑自动化测试或浏览器走查。

## 测试范围

| 纳入 | 不纳入 |
|---|---|
| `POST /api/v1/shares`、`GET /api/v1/shares/:id` | 配装台点击流、Playwright |
| `GET /api/v1/shares` 列表项不含秘偶字段 | 连招码列表上展示秘偶（P6，本版不做） |
| 前台 `GET /`、`/puppets`、`/puppets/{name}`、`/puppet-assets/icons/...` | 从粘贴文案解析秘偶（P8） |
| 迁移后旧分享 `deployedPuppets` 为 `null` 时详情仍 200 | 编造或补录红色秘偶名单 |
| Dockerfile 中两处 `COPY` 是否写上（对照文件） | 封印物图鉴改版、OCR 主站 |

## 环境与前置

| 项 | 要求 |
|---|---|
| 数据 | 已完成 W1：`apps/guide/data/puppets/秘偶图鉴.md` 与 `icons/` 下 30 张 png |
| 库 | guide 库已执行包含 `deployedPuppets` 的迁移 |
| API | `GUIDE_API_PORT` 默认 **3001**，前缀 `/api/v1` |
| 前台 | guide 的 Next 已启动，能读到 `data/puppets` |
| 分享文案 | 从一条**已经能保存成功**的分享取出 `shareText`、`pathwaySlug`。不要手写假分享码 |

记：

- `BASE` = `http://127.0.0.1:3001/api/v1`
- `WEB` = 前台 origin（本地一般为 `http://127.0.0.1:3000`）
- `$PATH` = 上面那条分享的 `pathwaySlug`
- `$TEXT` = 它的 `shareText`
- 合法名用资料表里的：**星之虫·守秘**、**先祖铠甲**、**西尔维娅**、**小丑**

请求体在原有字段上只多 `deployedPuppets`。下面用 JSON 表示 body，标题可自定，场景可省略。

```json
{
  "pathwaySlug": "<$PATH>",
  "shareText": "<$TEXT>",
  "title": "秘偶自测",
  "deployedPuppets": []
}
```

## 用例

### 图鉴路由（验收 1、2，P1–P3）

| ID | 对应 | 步骤 | 期望 |
|---|---|---|---|
| PG-01 | 验收 1 / P1 | `GET {WEB}/` | 200；正文含「秘偶图鉴」且链接到 `/puppets` |
| PG-02 | 验收 1 / P2 | `GET {WEB}/puppets` | 200；同时含「红色」「橙色」「金色」「紫色」 |
| PG-03 | T1 | 同上 | 红色分区含「暂无数据」。本轮**不要求**红色条目；一旦 md 补了红色行，此条改为必须出现该名称 |
| PG-04 | 验收 2 / P3 | `GET {WEB}/puppets/星之虫·守秘`（路径按 URL 编码） | 200；含名称、技能「记录·放逐」、冷却「20」、属性「破甲」、备注里的「首选」 |
| PG-05 | P3 进阶 | `GET {WEB}/puppets/西尔维娅` | 200；含「黄金树灵」和「2阶」 |
| PG-06 | 验收 2 图标 | `GET {WEB}/puppet-assets/icons/星之虫·守秘.png` | 200；`Content-Type` 为 `image/png` |
| PG-07 | — | `GET {WEB}/puppets/不存在的秘偶` | 404 |
| PG-08 | — | `GET {WEB}/puppet-assets/../秘偶图鉴.md` 或越出数据根的路径 | 404，不返回 Markdown 正文 |

### 保存分享（验收 3、6，P4）

每条都 `POST {BASE}/shares`，成功后再 `GET {BASE}/shares/{id}` 核对。

| ID | 对应 | `deployedPuppets` | 期望 |
|---|---|---|---|
| SH-01 | 验收 3、5 | 字段省略 | 201 或项目现有的成功码；GET 的 `deployedPuppets` 为 `[]`；`shareText` 与提交一致 |
| SH-02 | 验收 3 | `[]` | 同 SH-01 |
| SH-03 | 验收 3、4 | `["星之虫·守秘"]` | 成功；GET 数组恰好是这一个名称 |
| SH-04 | 验收 3 | `["西尔维娅","星之虫·守秘","小丑"]` | 成功；GET **顺序与提交一致** |
| SH-05 | 去重 | `["先祖铠甲","先祖铠甲"]` | 成功；GET 为 `["先祖铠甲"]`（长度 2，未超过 3） |
| SH-06 | 验收 3 | 四个合法名：守秘、先祖铠甲、西尔维娅、小丑 | **400**；不产生新 id |
| SH-07 | 验收 3 | `["不是秘偶"]` | **400**；文案能看出是未知秘偶 |
| SH-08 | — | `[""]` 或 `["   "]` | **400** |
| SH-09 | — | `["  星之虫·守秘  "]` | 成功；GET 为 trim 后的「星之虫·守秘」 |
| SH-10 | — | 单个名称超过 40 字 | **400** |

白名单文件缺失（W4）不作为必测：本地开发文件在仓库里。只在故意移走 Markdown 时抽查——非空数组 400 且文案含「秘偶名册不可用」，空数组仍可保存。测完把文件放回。

### 旧分享与列表（验收 5、P6、P7）

| ID | 对应 | 步骤 | 期望 |
|---|---|---|---|
| SH-11 | 验收 5 / P7 | 取一条**迁移前**已存在的分享 id，`GET {BASE}/shares/{id}` | 200；`deployedPuppets` 为 `[]`；`shareText`、`title` 与迁移前一致。库里没有旧行则本条标「无旧数据，跳过」，不算失败 |
| SH-12 | P6 本版不做 | `GET {BASE}/shares?page=1&pageSize=20` | 200；`items[]` 里**没有** `deployedPuppets` 键 |
| SH-13 | 回归 | `GET {BASE}/shares/不存在` | 404，与改前一致 |

### 发布文件（不打镜像也可以先对照）

| ID | 对应 | 步骤 | 期望 |
|---|---|---|---|
| DK-01 | W8 | 看 `deploy/Dockerfile.guide-api` | build 阶段把 `秘偶图鉴.md` 拷进 `apps/guide-api/data/puppets/` |
| DK-02 | W17 | 看 `deploy/Dockerfile.guide` | runtime 拷贝 `apps/guide/data/puppets` |

## 与验收 / 用例对照

| 验收或用例 | 用例 |
|---|---|
| 验收 1 | PG-01、PG-02、PG-03 |
| 验收 2 | PG-04、PG-05、PG-06 |
| 验收 3 | SH-01～SH-04、SH-06、SH-07 |
| 验收 4 | SH-03、SH-04 的 GET 名称与顺序；页面点击跳转由使用人看，不计入通过 |
| 验收 5 | SH-01、SH-11 |
| 验收 6 | SH-01～SH-10 |
| P5 详情链到图鉴 | 使用人打开 `/codes/{id}` 自行确认；本方案只保证 GET 里的名称 |
| P6 | SH-12（确认列表没带字段） |
| P8 | 不测。抽一条仍含「封印物：」的旧 `shareText`，确认 `POST` 不会改写这段文案（SH-01 已覆盖 `shareText` 原样返回） |

## 通过 / 失败标准

**通过**须同时满足：

1. PG-01～PG-08、SH-01～SH-10、SH-12、SH-13、DK-01、DK-02 的期望全部符合。
2. SH-11 通过，或注明无旧数据并跳过。
3. 红色分区在资料补全之前，以 PG-03 的「暂无数据」为准，不因没有红色秘偶判失败。

**失败**：任一必测 ID 不符合期望；空数组或省略字段导致保存失败；列表响应出现 `deployedPuppets`；非法名或 4 个名称仍返回成功。

## 回归要点

- 只改了分享接口：重跑 SH-01、SH-06、SH-07、SH-12。
- 只改了图鉴 Markdown 或图标：重跑 PG-02、PG-04、PG-06；新名称要能被 SH-03 那种请求接受。
- 封印物：`GET {WEB}/seals` 仍 200。不要求再走配装台。
- 游戏分享码解析函数不应出现在本次 diff 里。若 diff 碰到 `parseGameSharePaste`，本方案视为范围被破坏，先停测。

## 文档映射

| 文档 | 路径 | 状态 |
|---|---|---|
| 原始需求 | `docs/requirements/wiki分享.md` | 已存在 |
| 需求梳理版 | `docs/detail/需求-wiki分享-梳理版.md` | 已完成 |
| 技术设计 | `docs/design/技术设计-wiki分享.md` | 已完成 |
| 开发计划 | `docs/plan/开发计划-wiki分享.md` | 已完成 |
| 自测方案 | `docs/test/自测方案-wiki分享.md` | 本文 |

流水线四步文档已齐。实现请另开任务，从开发计划 **W1** 起做。
