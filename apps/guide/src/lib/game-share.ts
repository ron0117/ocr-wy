import {
  enrichImportedSkills,
  type GameShareImportView,
} from '@ocr/guide-types';
import type { SkillDto } from '@ocr/guide-types';
import { SKILL_NAMES_BY_EXTERNAL_ID } from '@/lib/skill-name-lookup';

export function enrichImportWithSkills(
  parsed: Omit<GameShareImportView, 'importedAt'>,
  skills: SkillDto[],
  importedAt: string,
): GameShareImportView {
  const nameByExternalId = new Map<string, string>(SKILL_NAMES_BY_EXTERNAL_ID);
  for (const s of skills) {
    nameByExternalId.set(s.externalId, s.name);
  }
  return enrichImportedSkills({ ...parsed, importedAt }, nameByExternalId);
}

/** 详情页等无途径技能列表时，仅用 skill_names 表补全 */
export function enrichImportWithSkillNamesOnly(
  parsed: Omit<GameShareImportView, 'importedAt'>,
  importedAt: string,
): GameShareImportView {
  return enrichImportedSkills(
    { ...parsed, importedAt },
    new Map(SKILL_NAMES_BY_EXTERNAL_ID),
  );
}
