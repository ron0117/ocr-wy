import { BadRequestException } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const FILE = '封印物图鉴.md';

type SealCategory = 'attack' | 'defense' | 'special';

const CATEGORY_BY_HEADING: Record<string, SealCategory> = {
  攻击封印物: 'attack',
  防御封印物: 'defense',
  特化封印物: 'special',
};

const CATEGORY_ORDER: Record<SealCategory, number> = {
  attack: 0,
  defense: 1,
  special: 2,
};

const CATEGORY_LABEL: Record<SealCategory, string> = {
  attack: '攻击',
  defense: '防御',
  special: '特化',
};

let cached: Map<string, SealCategory> | 'missing' | null = null;

function markdownPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'apps', 'guide', 'data', 'seals', FILE),
    path.join(process.cwd(), '..', 'guide', 'data', 'seals', FILE),
    path.join(process.cwd(), 'data', 'seals', FILE),
  ];
  for (const file of candidates) {
    if (existsSync(file)) return file;
  }
  return null;
}

/** 抽取 `### 序号. 名称`，并记下所属攻击/防御/特化。文件不存在时返回 null。 */
export function loadSealAllowlist(): Map<string, SealCategory> | null {
  if (cached === 'missing') return null;
  if (cached) return cached;
  const file = markdownPath();
  if (!file) {
    cached = 'missing';
    return null;
  }
  const names = new Map<string, SealCategory>();
  let category: SealCategory = 'attack';
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const heading = line.match(/^## (.+?)（/);
    if (heading) {
      const next = CATEGORY_BY_HEADING[heading[1]!.trim()];
      if (next) category = next;
      continue;
    }
    const match = line.match(/^### \d+\.\s*(.+)$/);
    const name = match?.[1]?.trim();
    if (name) names.set(name, category);
  }
  cached = names;
  return names;
}

export function normalizeDeployedSeals(input: string[] | undefined): string[] {
  const raw = input ?? [];
  if (raw.length > 3) {
    throw new BadRequestException('封印物最多 3 件');
  }
  const trimmed = raw.map((name) => (typeof name === 'string' ? name.trim() : ''));
  if (trimmed.some((name) => !name)) {
    throw new BadRequestException('封印物名称不能为空');
  }
  if (trimmed.some((name) => name.length > 40)) {
    throw new BadRequestException('封印物名称最长 40 字');
  }
  const deduped: string[] = [];
  for (const name of trimmed) {
    if (!deduped.includes(name)) deduped.push(name);
  }
  if (deduped.length === 0) return [];
  const allow = loadSealAllowlist();
  if (!allow) {
    throw new BadRequestException('封印物名册不可用');
  }
  const seen = new Set<SealCategory>();
  for (const name of deduped) {
    const category = allow.get(name);
    if (!category) {
      throw new BadRequestException(`未知封印物：${name}`);
    }
    if (seen.has(category)) {
      throw new BadRequestException(`${CATEGORY_LABEL[category]}封印物最多 1 件`);
    }
    seen.add(category);
  }
  return [...deduped].sort(
    (a, b) => CATEGORY_ORDER[allow.get(a)!] - CATEGORY_ORDER[allow.get(b)!],
  );
}
