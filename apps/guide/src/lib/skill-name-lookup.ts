import skillNames from '../../../guide-api/data/sources/skill_names.json';

/** 与 guide 导入使用的 `skill_names.json` 一致，用于分享码技能 ID → 中文名 */
export const SKILL_NAMES_BY_EXTERNAL_ID = new Map<string, string>(
  Object.entries(skillNames as Record<string, string>),
);

export function skillDisplayName(externalId: string): string | undefined {
  return SKILL_NAMES_BY_EXTERNAL_ID.get(externalId);
}
