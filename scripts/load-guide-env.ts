import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path: string, override: boolean) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** 加载 guide 库连接串；优先级：.env.example < .env < apps/guide-api/.env */
export function loadGuideEnv(): void {
  const root = resolve(import.meta.dirname, '..');
  loadEnvFile(resolve(root, '.env.example'), false);
  loadEnvFile(resolve(root, '.env'), false);
  loadEnvFile(resolve(root, 'apps/guide-api/.env'), true);

  if (!process.env.GUIDE_DATABASE_URL && process.env.DATABASE_URL) {
    process.env.GUIDE_DATABASE_URL = process.env.DATABASE_URL.replace(
      /\/ocr(\?|$)/,
      '/guide$1',
    );
  }
}

export function requireGuideDatabaseUrl(): string {
  loadGuideEnv();
  const url = process.env.GUIDE_DATABASE_URL;
  if (!url) {
    throw new Error(
      '缺少 GUIDE_DATABASE_URL。请在根 .env 或 apps/guide-api/.env 配置，例如 postgresql://ocr:ocr@localhost:5433/guide?schema=public',
    );
  }
  return url;
}
