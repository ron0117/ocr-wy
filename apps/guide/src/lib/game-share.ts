import {
  enrichImportedSkills,
  type GameShareImportView,
} from '@ocr/guide-types';
import type { SkillDto } from '@ocr/guide-types';

export function enrichImportWithSkills(
  parsed: Omit<GameShareImportView, 'importedAt'>,
  skills: SkillDto[],
  importedAt: string,
): GameShareImportView {
  const nameByExternalId = new Map(skills.map((s) => [s.externalId, s.name]));
  return enrichImportedSkills({ ...parsed, importedAt }, nameByExternalId);
}
