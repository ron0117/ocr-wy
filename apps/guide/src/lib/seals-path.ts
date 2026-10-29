import { existsSync } from 'fs';
import path from 'path';

/** Guide 内封印物图鉴静态资源（原 docs/诡秘之主-封印物图鉴） */
export function sealsCatalogRoot(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'seals'),
    path.join(process.cwd(), 'apps', 'guide', 'data', 'seals'),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, '封印物图鉴.md'))) {
      return dir;
    }
  }
  return candidates[0];
}

export function sealsCatalogMarkdownPath(): string {
  return path.join(sealsCatalogRoot(), '封印物图鉴.md');
}
