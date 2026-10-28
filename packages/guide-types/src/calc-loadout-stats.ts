import type {
  CalcLoadoutResult,
  GearDto,
  StatMap,
  StatRules,
} from './dto.js';

function addStats(target: StatMap, source: StatMap) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== 'number' || Number.isNaN(value)) continue;
    target[key] = (target[key] ?? 0) + value;
  }
}

export function calcLoadoutStats(
  gearSlots: Record<string, string>,
  gearBySlug: Map<string, GearDto>,
  rules: StatRules = {},
): CalcLoadoutResult {
  const stats: StatMap = {};
  const warnings: string[] = [];
  const rateKeys = new Set(rules.rateKeys ?? ['critRate', 'critDamage']);
  const rateCap = rules.rateCap ?? 1;

  for (const [slot, slug] of Object.entries(gearSlots)) {
    if (!slug) continue;
    const gear = gearBySlug.get(slug);
    if (!gear) {
      warnings.push(`槽位 ${slot} 的装备 ${slug} 不存在`);
      continue;
    }
    if (gear.slot !== slot && gear.slot !== 'ACCESSORY') {
      warnings.push(`${gear.name} 通常不放在 ${slot} 槽`);
    }
    addStats(stats, gear.baseStats ?? {});
    for (const affix of gear.affixes ?? []) {
      addStats(stats, affix.stats ?? {});
    }
  }

  for (const key of rateKeys) {
    if (typeof stats[key] === 'number' && stats[key] > rateCap) {
      warnings.push(`${key} 超过规则上限 ${rateCap}，展示值已截断`);
      stats[key] = rateCap;
    }
  }

  return { stats, warnings };
}
