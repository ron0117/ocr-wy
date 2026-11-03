# 开发计划 · Wiki 分享与秘偶图鉴

依据 [需求梳理版](../detail/需求-wiki分享-梳理版.md)、[技术设计](../design/技术设计-wiki分享.md)。**本计划只拆任务**；改代码须另开实现任务。

## 里程碑

一人按顺序做，大约 **2～3 个工作日**。图鉴页和分享接口在资料落盘后可以并行。

| 里程碑 | 完成标准 | 建议工期 |
|---|---|---|
| **M1 资料与库表** | `apps/guide/data/puppets/` 有 Markdown 和 30 张图标；`SharedBuild.deployedPuppets` 可空列已迁移；DTO 已加字段 | 0.5 天 |
| **M2 分享接口** | `POST /shares` 接受 0～3 个合法名称并拒绝第 4 个、非法名；`GET /shares/:id` 对旧行返回 `[]` | 0.5 天 |
| **M3 秘偶图鉴** | `/puppets` 四档都可见（红色可为「暂无数据」）；详情字段与 md 一致；首页有入口；图标路由可打开已有 png | 1 天 |
| **M4 分享选择与展示** | 配装台默认不选、最多 3 个；`/codes/[id]` 展示已存秘偶并可进图鉴；不选的分享不出现秘偶区 | 0.5～1 天 |

**MVP 发布线**：M1 →（M2 与 M3 可并行）→ M4。M4 同时依赖接口契约和图鉴路由。

不单列部署里程碑。两处 Dockerfile `COPY` 分别挂在 M2、M3，避免上线后白名单或图标丢失。

## MVP 与用例对齐

| 用例 | 里程碑 | 任务 |
|---|---|---|
| P1 首页入口 | M3 | W16 |
| P2 四档列表 | M3 | W12 |
| P3 详情 | M3 | W13 |
| P4 保存时 0～3、无默认 | M2 + M4 | W5、W6、W18、W19 |
| P5 详情展示并可跳转 | M4 | W20、W21 |
| P7 旧分享 | M2 + M4 | W7、W21 |
| P6 列表展示秘偶 | 不做 | — |
| P8 解析游戏文案 | 不做 | — |

红色完整名单不在本计划。当前表没有红色行，W12 只保证红色分区和「暂无数据」。

## 任务拆分

### M1 资料与库表

- [ ] **W1** 把 `docs/诡秘之主-秘偶图鉴/诡秘之主-秘偶资料.md` 拷为 `apps/guide/data/puppets/秘偶图鉴.md`。把 `秘偶icons/*.png` 拷为 `icons/{秘偶名}.png`（30 张，文件名已是秘偶名）。docs 原稿留档，运行时不读 docs。
- [ ] **W2** `prisma/guide/schema.prisma` 的 `SharedBuild` 增加可空 `deployedPuppets Json?`。新增迁移，不回填。只改源 schema，不手改 `apps/guide-api/src/generated`。
- [ ] **W3** `packages/guide-types`：`ShareCreateBody.deployedPuppets?` 可选 `string[]`；`ShareDto.deployedPuppets` 必填 `string[]`。`ShareListItemDto` 不加字段。

### M2 分享接口

- [ ] **W4** `apps/guide-api/src/shares/puppet-names.ts`：按技术设计 §6.4 的三个路径找 `秘偶图鉴.md`，只抽总表「秘偶」列，进程内缓存。文件缺失时，非空 `deployedPuppets` 返回 400「秘偶名册不可用」；`[]` 仍可保存。
- [ ] **W5** `CreateShareDto`：`deployedPuppets` 可选；字符串数组；trim 后非空；单名最长 40；**去重前**长度 ≤ 3。
- [ ] **W6** `SharesService.create`：缺省当 `[]`；去重且保留先出现的顺序；名称必须在白名单；失败 400，文案区分超数量、空名、未知秘偶。有选择写入数组，没选写入 `[]`。不改 `shareText` 解析。
- [ ] **W7** `mapRow` / `getById`：`null` 或非字符串数组 → `deployedPuppets: []`。列表查询不读这个字段。
- [ ] **W8** `deploy/Dockerfile.guide-api` 的 build 阶段增加：`COPY apps/guide/data/puppets/秘偶图鉴.md apps/guide-api/data/puppets/秘偶图鉴.md`（runtime 已拷整个 `apps/guide-api/data`）。

### M3 秘偶图鉴

- [ ] **W9** `puppets-path.ts`：候选 `data/puppets`、`apps/guide/data/puppets`，以存在 `秘偶图鉴.md` 为准。
- [ ] **W10** `puppets-catalog.ts`：按表头文字认列，不按序号。品质归一（`橙色（新增）` → 橙色；无法识别的行丢弃）。解析进阶 `### 名称｜技能` 与 `## 使用说明`。
- [ ] **W11** `puppets-manifest.ts`：图标 URL 为 `/puppet-assets/icons/{encodeURIComponent(名称)}.png`；缺文件用占位，不抛错。
- [ ] **W12** `/puppets`：红、橙、金、紫都渲染；0 条时文案「暂无数据」。顶部放使用说明（含上阵 2 只，仅展示）。
- [ ] **W13** `/puppets/[name]`：`generateStaticParams` 用 catalog；未知名 `notFound()`。展示技能、1 阶、冷却、射程、半径、属性、定位、PVP/PVE、推荐；有进阶才渲染阶数。
- [ ] **W14** `puppet-assets/[...path]/route.ts`：限制在数据根内，png/jpg/webp，缓存 1 天。对照 `seal-assets`。
- [ ] **W15** `puppets.css`：四档边框/标签 class（`puppet-rarity--red|orange|gold|purple`）。不改封印物样式。
- [ ] **W16** 首页 `FEATURES` 增加「秘偶图鉴」→ `/puppets`，插在「敬请期待」之前。不加顶栏。
- [ ] **W17** `deploy/Dockerfile.guide` runtime 增加：`COPY --from=build /app/apps/guide/data/puppets ./apps/guide/data/puppets`。

### M4 分享选择与展示

- [ ] **W18** 配装台：导入成功后才显示选择器。状态默认 `[]`。分品质 Tab，搜索只过滤当前 Tab。已选 3 个时再点不加入，并提示已满。`clearImport` 清空已选。
- [ ] **W19** `POST /shares` 体始终带 `deployedPuppets`（可以是空数组），其余字段不变。成功仍跳转 `urlPath`。
- [ ] **W20** `puppets-display.tsx`：空数组不渲染。卡片链到 `/puppets/{encodeURIComponent(name)}`，缺图用占位。
- [ ] **W21** `ComboShareDetail` 使用 `share.deployedPuppets`。不从 `shareText` 取秘偶。空数组不出现该区块；封印物区保持原解析。

### 明确不做

- 连招码列表 DTO 或列表卡片上的秘偶数量、图标（P6）。
- `parseGameSharePaste`、游戏分享文案、MessagePack（P8）。
- 编造红色秘偶；2 只上阵硬校验；按 PVP/PVE 自动推荐；guide-api 在线改表。

## 依赖顺序

```text
W1 → W4、W9、W10
W2 → W6
W3 → W5、W6、W19、W21
W4 + W5 → W6
W6 → W8
W9 → W10 → W11 → W12、W13、W14
W10 → W18
W12 → W16
W11 + W14 → W17
W6 + W18 → W19
W11 → W20 → W21
W7 → W21
```

**单人顺序**：

```text
W1 → W2 → W3 → W9 → W10 → W11 → W12 → W13 → W14 → W15 → W16 → W17
  → W4 → W5 → W6 → W7 → W8
  → W18 → W19 → W20 → W21
```

先做图鉴，保存分享时选择器直接用已能打开的 catalog。接口放在图鉴之后，避免白名单还没有正文就联调。

## 人力与并行

一人时无并行，按上面的顺序。若两人：

| 人 | 任务 | 汇合点 |
|---|---|---|
| 甲 | W2～W8 | W6 的字段名、400 文案、空数组语义定稿后，乙做 W19、W21 |
| 乙 | W1、W9～W18、W20 | W10 的名称集合必须和资料表「秘偶」列一致，甲的白名单读同一文件 |

## 风险与缓冲

| 风险 | 缓冲 |
|---|---|
| 总表列名和设计不一致，解析错位 | W10 先用「秘偶」「品质」两列表头打通再填其余列，多留 2 小时 |
| 容器没拷 Markdown 或图标 | W8、W17 和功能同一批做完，不留到发布前再补 |
| 配装台选择器嵌进现有保存区，布局来回改 | M4 单独留 0.5 天，不和列表页抢时间 |
| 红色资料临时补进 md | 不改计划；加行加图即可，不单开任务 |

## 完成定义

1. 梳理版 §9 验收 1～5 有对应实现：入口、四档、至少一条详情与 md 一致、0～3 与非法名、详情跳转、旧分享无秘偶区。
2. 验收 6：`POST /shares`、`GET /shares/:id` 与技术设计 §6 一致。实现完成时用一次最小请求核对即可，不写自动化测试、不做页面走查。
3. `ShareListItemDto` 与 `parseGameSharePaste` 无 diff。

## 文档映射

| 文档 | 路径 | 状态 |
|---|---|---|
| 原始需求 | `docs/requirements/wiki分享.md` | 已存在 |
| 需求梳理版 | `docs/detail/需求-wiki分享-梳理版.md` | 已完成 |
| 技术设计 | `docs/design/技术设计-wiki分享.md` | 已完成 |
| 开发计划 | `docs/plan/开发计划-wiki分享.md` | 本文 |
| 自测方案 | `docs/test/自测方案-wiki分享.md` | 已完成 |
