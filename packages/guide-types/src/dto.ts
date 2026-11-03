export type StatMap = Record<string, number>;

export interface GearAffixDto {
  label: string;
  stats: StatMap;
}

export interface GearDto {
  slug: string;
  name: string;
  slot: string;
  rarity: string;
  baseStats: StatMap;
  affixes: GearAffixDto[];
  pathwaySlugs?: string[];
  sourceNote?: string | null;
  verifiedAt?: string | null;
}

export interface SkillDto {
  slug: string;
  name: string;
  externalId: string;
  skillType: string;
  pathwaySlug?: string | null;
}

export interface PathwayDto {
  slug: string;
  /** 解包/库内名称，如「空想家途径」 */
  name: string;
  /** 面向玩家的职业名，如「观众」 */
  professionLabel: string;
  /** 游戏内途径名，如「观众途径」 */
  routeLabel: string;
  /** 神祇/高位称呼，如「空想家」 */
  deityLabel?: string;
  description?: string | null;
  externalId: string;
}

export interface PlayScenarioDto {
  code: string;
  name: string;
}

export interface ComboStepDto {
  skillSlug: string;
  label?: string;
}

export interface LoadoutDto {
  slug: string;
  title: string;
  pathwaySlug: string;
  scenarioCode?: string | null;
  gearSlots: Record<string, string>;
  skillBar?: string[];
  comboSteps: ComboStepDto[];
  sourceNote?: string | null;
  verifiedAt?: string | null;
}

export interface CurrentVersionDto {
  semver: string;
  label?: string | null;
  verifiedAt?: string | null;
}

export interface ShareCreateBody {
  pathwaySlug: string;
  scenarioCode?: string;
  /** 游戏内复制的整段分享文案 */
  shareText: string;
  /** 方案名称（必填，保存后与作者组合为列表标题） */
  title: string;
  /** 上阵秘偶名称，0～3 个。省略视为空 */
  deployedPuppets?: string[];
  /** 站内配置的封印物名称，0～3 件。省略表示沿用文案里的封印物 */
  deployedSeals?: string[];
}

export interface ShareCreatedDto {
  id: string;
  urlPath: string;
}

export interface ShareDto {
  id: string;
  pathwaySlug: string;
  pathwayProfessionLabel: string;
  scenarioCode?: string;
  scenarioName?: string;
  shareText: string;
  title?: string;
  authorName?: string;
  comboStepCount: number;
  viewCount: number;
  /** 上阵秘偶名称。旧分享无此列时为空数组 */
  deployedPuppets: string[];
  /** 站内配置的封印物。null 表示旧分享，详情回退到文案里的「封印物：」 */
  deployedSeals: string[] | null;
  createdAt: string;
}

export interface ShareListItemDto {
  id: string;
  title?: string;
  authorName?: string;
  pathwaySlug: string;
  pathwayProfessionLabel: string;
  scenarioCode?: string;
  scenarioName?: string;
  comboStepCount: number;
  viewCount: number;
  createdAt: string;
}

export interface ShareListPageDto {
  items: ShareListItemDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CalcLoadoutResult {
  stats: StatMap;
  warnings: string[];
}

export interface StatRules {
  /** 百分比属性键，加算后不超过 cap */
  rateKeys?: string[];
  rateCap?: number;
}

export interface GuideArticleCreateBody {
  title: string;
  authorName: string;
  summary?: string;
  bodyHtml: string;
  coverUrl?: string;
  pathwaySlug?: string;
}

export interface GuideArticleCreatedDto {
  id: string;
  slug: string;
  urlPath: string;
}

export interface GuideArticleListItemDto {
  id: string;
  slug: string;
  title: string;
  authorName: string;
  summary?: string;
  coverUrl?: string;
  pathwaySlug?: string;
  viewCount: number;
  createdAt: string;
}

export interface GuideArticleDto extends GuideArticleListItemDto {
  bodyHtml: string;
  updatedAt: string;
}

export interface WikiImageUploadDto {
  url: string;
  objectKey: string;
}
