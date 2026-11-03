import { existsSync } from 'fs';
import path from 'path';

const MARKDOWN = '秘偶图鉴.md';

/** Guide 内秘偶图鉴静态资源（原稿在 docs/诡秘之主-秘偶图鉴，运行时不读 docs） */
export function puppetsCatalogRoot(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'puppets'),
    path.join(process.cwd(), 'apps', 'guide', 'data', 'puppets'),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, MARKDOWN))) {
      return dir;
    }
  }
  return candidates[0];
}

export function puppetsCatalogMarkdownPath(): string {
  return path.join(puppetsCatalogRoot(), MARKDOWN);
}
