/**
 * 将 public 活动页媒体上传到腾讯云 COS（私有写 + 公有读），并输出公网 URL / VITE_PUBLIC_ASSET_CDN。
 *
 * 环境变量：
 *   COS_SECRET_ID / COS_SECRET_KEY  — API 密钥（仅需写权限）
 *   COS_BUCKET                        — 桶名（含 APPID）
 *   COS_REGION                        — 如 ap-guangzhou
 *   COS_PUBLIC_BASE_URL               — 可选，CDN 或自定义域名；不设则用默认 COS 域名
 *   COS_KEY_PREFIX                    — 可选，对象键前缀（无首尾 /）
 *
 * 参数：
 *   --write-env          更新 .env.production（CDN + OMIT_LOCAL）
 *   --dry-run            不上传、不改 HTML，只打印对象键与 URL
 *   --no-rewrite-html    上传但不改写 apps/web/public 内 HTML
 *   --rewrite-html-only  按 deploy/public-cos-manifest.json 仅改写 HTML（无需 COS 密钥）
 */
import COS from 'cos-nodejs-sdk-v5';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_ASSET_PAGES,
  defaultCosPublicBase,
  listPublicAssetEntries,
  publicAssetUrl,
} from '../apps/web/public-asset-pages';
import { syncPublicCosExcludes } from './sync-public-cos-excludes';
import { rewritePublicPageAssets } from '../apps/web/vite-public-asset-cdn';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(repoRoot, 'apps/web/public');

function loadEnvFile(relativePath: string) {
  const full = path.join(repoRoot, relativePath);
  return readFile(full, 'utf8')
    .then((text) => {
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        if (process.env[key] !== undefined) continue;
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    })
    .catch(() => undefined);
}

function contentTypeFor(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

function objectKeyWithPrefix(prefix: string | undefined, key: string): string {
  const p = prefix?.replace(/^\/+|\/+$/g, '');
  return p ? `${p}/${key}` : key;
}

async function rewritePublicHtmlSources(cdnBase: string, keyPrefix: string | undefined) {
  for (const [pageKey, files] of Object.entries(PUBLIC_ASSET_PAGES)) {
    const htmlPath = path.join(publicRoot, pageKey);
    let html: string;
    try {
      html = await readFile(htmlPath, 'utf8');
    } catch {
      console.warn(`跳过 HTML（不存在）: ${pageKey}`);
      continue;
    }
    const next = rewritePublicPageAssets(html, cdnBase, pageKey, files, keyPrefix);
    if (next !== html) {
      await writeFile(htmlPath, next, 'utf8');
      console.log(`已改写 HTML: apps/web/public/${pageKey}`);
    } else {
      console.log(`HTML 无需改动: ${pageKey}`);
    }
  }
}

async function main() {
  await loadEnvFile('.env.production');
  await loadEnvFile('.env');

  const writeEnv = process.argv.includes('--write-env');
  const dryRun = process.argv.includes('--dry-run');
  const rewriteHtmlOnly = process.argv.includes('--rewrite-html-only');
  const rewriteHtml =
    !process.argv.includes('--no-rewrite-html') &&
    (rewriteHtmlOnly || !dryRun);

  const keyPrefix = process.env.COS_KEY_PREFIX?.trim();

  if (rewriteHtmlOnly) {
    const reportPath = path.join(repoRoot, 'deploy/public-cos-manifest.json');
    const report = JSON.parse(await readFile(reportPath, 'utf8')) as {
      publicBase?: string;
      vitePublicAssetCdn?: string;
    };
    const cdnBase =
      report.publicBase?.trim() ||
      report.vitePublicAssetCdn?.trim() ||
      process.env.COS_PUBLIC_BASE_URL?.trim() ||
      process.env.VITE_PUBLIC_ASSET_CDN?.trim();
    if (!cdnBase) {
      throw new Error(
        '缺少 CDN 根域名：请先执行 upload:public-cos 或配置 COS_PUBLIC_BASE_URL / VITE_PUBLIC_ASSET_CDN',
      );
    }
    await rewritePublicHtmlSources(cdnBase, keyPrefix);
    if (writeEnv) {
      await updateProductionEnv(cdnBase, keyPrefix);
    }
    await syncPublicCosExcludes();
    return;
  }

  const secretId = requireEnv('COS_SECRET_ID');
  const secretKey = requireEnv('COS_SECRET_KEY');
  const bucket = requireEnv('COS_BUCKET');
  const region = requireEnv('COS_REGION');
  const cdnBase =
    process.env.COS_PUBLIC_BASE_URL?.trim() ||
    process.env.VITE_PUBLIC_ASSET_CDN?.trim() ||
    defaultCosPublicBase(bucket, region);

  const cos = new COS({ SecretId: secretId, SecretKey: secretKey });
  const entries = listPublicAssetEntries();
  const manifest: Array<{
    objectKey: string;
    localPath: string;
    sizeBytes: number;
    sha256: string;
    publicUrl: string;
    uploaded: boolean;
  }> = [];

  for (const entry of entries) {
    const localPath = path.join(publicRoot, entry.publicRelativePath);
    await stat(localPath);
    const objectKey = objectKeyWithPrefix(keyPrefix, entry.objectKey);
    const buffer = await readFile(localPath);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const sizeBytes = buffer.length;
    const publicUrl = publicAssetUrl(cdnBase, objectKey);

    if (!dryRun) {
      await new Promise<void>((resolve, reject) => {
        cos.putObject(
          {
            Bucket: bucket,
            Region: region,
            Key: objectKey,
            Body: buffer,
            ContentType: contentTypeFor(entry.fileName),
            CacheControl: 'public, max-age=31536000, immutable',
          },
          (err) => (err ? reject(err) : resolve()),
        );
      });
    }

    manifest.push({
      objectKey,
      localPath: path.relative(repoRoot, localPath),
      sizeBytes,
      sha256,
      publicUrl,
      uploaded: !dryRun,
    });
    console.log(`${dryRun ? '[dry-run] ' : ''}↑ ${objectKey} → ${publicUrl}`);
  }

  const report = {
    bucket,
    region,
    publicBase: cdnBase,
    vitePublicAssetCdn: cdnBase,
    objects: manifest,
  };

  const reportPath = path.join(repoRoot, 'deploy/public-cos-manifest.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`\n已写入 ${path.relative(repoRoot, reportPath)}`);
  console.log(`VITE_PUBLIC_ASSET_CDN=${cdnBase}`);

  if (rewriteHtml) {
    await rewritePublicHtmlSources(cdnBase, keyPrefix);
  }

  if (writeEnv) {
    await updateProductionEnv(cdnBase, keyPrefix);
  }

  await syncPublicCosExcludes();
}

async function updateProductionEnv(cdnBase: string, keyPrefix: string | undefined) {
  const envPath = path.join(repoRoot, '.env.production');
  let existing = '';
  try {
    existing = await readFile(envPath, 'utf8');
  } catch {
    /* 新建 */
  }
  const lines = existing.split(/\r?\n/).filter((line) => {
    const t = line.trim();
    return (
      t &&
      !t.startsWith('VITE_PUBLIC_ASSET_CDN=') &&
      !t.startsWith('VITE_PUBLIC_ASSET_OMIT_LOCAL=') &&
      !t.startsWith('VITE_PUBLIC_ASSET_KEY_PREFIX=')
    );
  });
  lines.push(`VITE_PUBLIC_ASSET_CDN=${cdnBase}`);
  if (keyPrefix) {
    lines.push(`VITE_PUBLIC_ASSET_KEY_PREFIX=${keyPrefix}`);
    lines.push(`COS_KEY_PREFIX=${keyPrefix}`);
  }
  lines.push('VITE_PUBLIC_ASSET_OMIT_LOCAL=true');
  await writeFile(envPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`已更新 ${path.relative(repoRoot, envPath)}（CDN + OMIT_LOCAL）`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
