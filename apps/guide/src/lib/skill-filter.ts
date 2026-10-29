import type { SkillDto } from '@ocr/guide-types';

export function isLikelyPassive(skill: SkillDto): boolean {
  if (skill.skillType === 'PASSIVE') return true;
  return skill.name.includes('被动');
}

export function filterSkills(
  skills: SkillDto[],
  query: string,
  hidePassive: boolean,
): SkillDto[] {
  const q = query.trim().toLowerCase();
  return skills.filter((s) => {
    if (hidePassive && isLikelyPassive(s)) return false;
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      s.externalId.includes(q)
    );
  });
}
