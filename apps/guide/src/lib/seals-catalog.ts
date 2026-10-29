import { readFileSync } from 'fs';
import { sealsCatalogMarkdownPath } from './seals-path';

export type SealCategory = 'attack' | 'defense' | 'special';

export type SealItem = {
  index: number;
  name: string;
  category: SealCategory;
  categoryLabel: string;
  iconPath: string;
  ability: string;
  negative: string;
  negativeIncomplete: boolean;
};

const CATEGORY_BY_HEADING: Record<string, SealCategory> = {
  攻击封印物: 'attack',
  防御封印物: 'defense',
  特化封印物: 'special',
};

const CATEGORY_LABEL: Record<SealCategory, string> = {
  attack: '攻击',
  defense: '防御',
  special: '特化',
};

function parseCatalogMarkdown(md: string): SealItem[] {
  const lines = md.split(/\r?\n/);
  const items: SealItem[] = [];
  let category: SealCategory = 'attack';
  let i = 0;

  while (i < lines.length) {
    const h2 = lines[i].match(/^## (.+?)（/);
    if (h2) {
      const key = h2[1].trim();
      if (CATEGORY_BY_HEADING[key]) {
        category = CATEGORY_BY_HEADING[key];
      }
      i += 1;
      continue;
    }

    const h3 = lines[i].match(/^### (\d+)\.\s*(.+)$/);
    if (!h3) {
      i += 1;
      continue;
    }

    const index = Number(h3[1]);
    const name = h3[2].trim();
    i += 1;

    let iconPath = '';
    while (i < lines.length && !lines[i].startsWith('### ') && !lines[i].startsWith('## ')) {
      const img = lines[i].match(/^!\[[^\]]*\]\((icons\/[^)]+)\)/);
      if (img) {
        iconPath = img[1];
      }
      if (lines[i].trim() === '**非凡能力**') {
        i += 1;
        break;
      }
      i += 1;
    }

    const abilityLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '**负面效果**') {
      if (lines[i].startsWith('### ') || lines[i].startsWith('## ')) {
        break;
      }
      abilityLines.push(lines[i]);
      i += 1;
    }

    if (i < lines.length && lines[i].trim() === '**负面效果**') {
      i += 1;
    }

    const negativeLines: string[] = [];
    while (i < lines.length && !lines[i].startsWith('### ') && !lines[i].startsWith('## ')) {
      negativeLines.push(lines[i]);
      i += 1;
    }

    const negative = negativeLines.join('\n').trim();
    const negativeIncomplete =
      name === '生命手杖' ||
      /待补|无法可靠辨认|被.*遮挡/.test(negative);

    items.push({
      index,
      name,
      category,
      categoryLabel: CATEGORY_LABEL[category],
      iconPath,
      ability: abilityLines.join('\n').trim(),
      negative,
      negativeIncomplete,
    });
  }

  return items.sort((a, b) => a.index - b.index);
}

let cached: SealItem[] | null = null;

export function loadSealCatalog(): SealItem[] {
  if (cached) return cached;
  const md = readFileSync(sealsCatalogMarkdownPath(), 'utf8');
  cached = parseCatalogMarkdown(md);
  return cached;
}

export function sealIconUrl(iconPath: string): string {
  const file = iconPath.replace(/^icons\//, '');
  return `/seal-assets/icons/${encodeURIComponent(file)}`;
}

export function getSealByName(name: string): SealItem | undefined {
  const decoded = decodeURIComponent(name);
  return loadSealCatalog().find((s) => s.name === decoded);
}

export function renderSealParagraphs(text: string): string[] {
  return text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
