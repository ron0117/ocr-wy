import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { puppetsCatalogMarkdownPath, puppetsCatalogRoot } from './puppets-path';
import { puppetIconUrl } from './puppets-manifest';

export type PuppetRarity = 'red' | 'orange' | 'gold' | 'purple';

export type PuppetRank = {
  rank: number;
  text: string;
};

export type PuppetItem = {
  name: string;
  rarity: PuppetRarity;
  rarityLabel: string;
  skillName: string;
  skillRank1: string;
  cooldown: string;
  castRange: string;
  radius: string;
  attr1: string;
  attr2: string;
  role: string;
  mode: string;
  note: string;
  iconUrl: string | null;
  ranks: PuppetRank[];
};

export type PuppetCatalog = {
  items: PuppetItem[];
  usageNotes: string[];
};

const RARITY_LABEL: Record<PuppetRarity, string> = {
  red: '红色',
  orange: '橙色',
  gold: '金色',
  purple: '紫色',
};

function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return [];
  const parts = trimmed.split('|').map((cell) => cell.trim());
  if (parts[0] === '') parts.shift();
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
}

function isSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function normalizeRarity(raw: string): PuppetRarity | null {
  const text = raw.trim();
  if (text.startsWith('红色')) return 'red';
  if (text.startsWith('橙色')) return 'orange';
  if (text.startsWith('金色')) return 'gold';
  if (text.startsWith('紫色')) return 'purple';
  return null;
}

function cell(cells: string[], index: number): string {
  if (index < 0) return '';
  return cells[index] ?? '';
}

function parseUsageNotes(lines: string[]): string[] {
  const start = lines.findIndex((line) => line.trim() === '## 使用说明');
  if (start < 0) return [];
  const notes: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('## ')) break;
    const text = line.trim().replace(/^- /, '');
    if (text) notes.push(text);
  }
  return notes;
}

function parseRanks(lines: string[]): Map<string, PuppetRank[]> {
  const map = new Map<string, PuppetRank[]>();
  let inSection = false;
  let current: string | null = null;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      inSection = line.trim() === '## 新增秘偶进阶效果';
      current = null;
      continue;
    }
    if (!inSection) continue;
    const heading = line.match(/^###\s+(.+?)｜/);
    if (heading) {
      current = heading[1].trim();
      if (!map.has(current)) map.set(current, []);
      continue;
    }
    const rank = line.match(/^- \*\*(\d+)阶：\*\*\s*(.*)$/);
    if (rank && current) {
      map.get(current)?.push({
        rank: Number(rank[1]),
        text: rank[2].trim(),
      });
    }
  }
  return map;
}

function iconUrlFor(name: string): string | null {
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  const file = path.join(puppetsCatalogRoot(), 'icons', `${name}.png`);
  if (!existsSync(file)) return null;
  return puppetIconUrl(name);
}

function parseCatalog(md: string): PuppetCatalog {
  const lines = md.split(/\r?\n/);
  let header: string[] | null = null;
  const items: PuppetItem[] = [];
  const ranks = parseRanks(lines);

  for (const line of lines) {
    if (!line.trim().startsWith('|')) {
      if (header) break;
      continue;
    }
    const cells = splitRow(line);
    if (isSeparator(cells)) continue;
    if (!header) {
      if (cells.includes('品质') && cells.includes('秘偶')) header = cells;
      continue;
    }
    const rarity = normalizeRarity(cell(cells, header.indexOf('品质')));
    const name = cell(cells, header.indexOf('秘偶'));
    if (!rarity || !name) continue;
    items.push({
      name,
      rarity,
      rarityLabel: RARITY_LABEL[rarity],
      skillName: cell(cells, header.indexOf('技能名称')),
      skillRank1: cell(cells, header.indexOf('技能1阶')),
      cooldown: cell(cells, header.indexOf('冷却（秒）')),
      castRange: cell(cells, header.indexOf('释放射程（米）')),
      radius: cell(cells, header.indexOf('作用半径（米）')),
      attr1: cell(cells, header.indexOf('属性1')),
      attr2: cell(cells, header.indexOf('属性2')),
      role: cell(cells, header.indexOf('定位')),
      mode: cell(cells, header.indexOf('PVP/PVE')),
      note: cell(cells, header.indexOf('推荐与备注')).replace(/\*\*/g, ''),
      iconUrl: iconUrlFor(name),
      ranks: ranks.get(name) ?? [],
    });
  }

  return { items, usageNotes: parseUsageNotes(lines) };
}

let cached: PuppetCatalog | null = null;
let cachedMtimeMs = 0;

export function loadPuppetCatalog(): PuppetCatalog {
  const file = puppetsCatalogMarkdownPath();
  if (!existsSync(file)) {
    cached = { items: [], usageNotes: [] };
    cachedMtimeMs = 0;
    return cached;
  }
  const mtimeMs = statSync(file).mtimeMs;
  if (cached && cachedMtimeMs === mtimeMs) return cached;
  cached = parseCatalog(readFileSync(file, 'utf8'));
  cachedMtimeMs = mtimeMs;
  return cached;
}

export function getPuppetByName(name: string): PuppetItem | undefined {
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    decoded = name;
  }
  return loadPuppetCatalog().items.find((item) => item.name === decoded);
}

export function displayPuppetValue(value: string): string {
  const text = value.trim();
  if (!text || text === '—' || text === '-') return '—';
  return text;
}
