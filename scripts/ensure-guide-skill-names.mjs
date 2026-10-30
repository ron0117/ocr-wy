import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const src = join(root, 'apps/guide-api/data/sources/skill_names.json');
const dest = join(root, 'apps/guide/data/skill_names.json');

if (!existsSync(src)) {
  if (existsSync(dest)) {
    console.log('[ensure-guide-skill-names] 源文件缺失，已存在目标文件，跳过同步');
    process.exit(0);
  }
  console.error(`[ensure-guide-skill-names] 缺少源文件: ${src}`);
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log('[ensure-guide-skill-names] 已同步 apps/guide/data/skill_names.json');
