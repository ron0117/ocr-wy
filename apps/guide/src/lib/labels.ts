export const GEAR_SLOT_ORDER = [
  'WEAPON',
  'OFFHAND',
  'HEAD',
  'CHEST',
  'HANDS',
  'LEGS',
  'FEET',
  'ACCESSORY',
  'SEAL',
] as const;

export const GEAR_SLOT_LABELS: Record<string, string> = {
  WEAPON: '武器',
  OFFHAND: '副手',
  HEAD: '头部',
  CHEST: '胸甲',
  HANDS: '手套',
  LEGS: '腿甲',
  FEET: '鞋子',
  ACCESSORY: '饰品',
  SEAL: '封印物',
};

export const STAT_LABELS: Record<string, string> = {
  attack: '攻击',
  critRate: '暴击率',
  critDamage: '暴击伤害',
  defense: '防御',
  hp: '生命',
};

const RATE_KEYS = new Set(['critRate', 'critDamage']);

export function formatStatValue(key: string, value: number): string {
  if (RATE_KEYS.has(key)) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

export function statLabel(key: string): string {
  return STAT_LABELS[key] ?? key;
}
