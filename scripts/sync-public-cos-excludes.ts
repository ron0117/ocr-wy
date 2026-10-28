/**
 * 根据 public-asset-pages.ts 生成：
 * - deploy/public-cos-excludes.txt（供 upload-and-deploy.ps1 tar --exclude）
 * - .dockerignore 中 public-cos-excludes 段落
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPublicAssetEntries } from '../apps/web/public-asset-pages';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARKER_START = '# BEGIN public-cos-excludes (pnpm upload:public-cos)';
const MARKER_END = '# END public-cos-excludes';

export function publicCosExcludePaths(): string[] {
  return listPublicAssetEntries().map((entry) =>
    path.posix.join('apps/web/public', entry.publicRelativePath.replace(/\\/g, '/')),
  );
}

export async function syncPublicCosExcludes(): Promise<string[]> {
  const paths = publicCosExcludePaths();
  const tarExcludePath = path.join(repoRoot, 'deploy/public-cos-excludes.txt');
  const tarBody = [
    '# 由 scripts/sync-public-cos-excludes.ts 生成，勿手改',
    '# 登记变更：apps/web/public-asset-pages.ts → pnpm upload:public-cos',
    ...paths,
    '',
  ].join('\n');
  await writeFile(tarExcludePath, tarBody, 'utf8');

  const dockerBlock = [MARKER_START, ...paths, MARKER_END].join('\n');
  const dockerignorePath = path.join(repoRoot, '.dockerignore');
  let dockerignore = '';
  try {
    dockerignore = await readFile(dockerignorePath, 'utf8');
  } catch {
    dockerignore = '';
  }

  const startIdx = dockerignore.indexOf(MARKER_START);
  const endIdx = dockerignore.indexOf(MARKER_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    dockerignore =
      dockerignore.slice(0, startIdx) +
      `${dockerBlock}\n` +
      dockerignore.slice(endIdx + MARKER_END.length).replace(/^\n+/, '\n');
  } else {
    const trimmed = dockerignore.replace(/\s+$/, '');
    dockerignore = trimmed ? `${trimmed}\n\n${dockerBlock}\n` : `${dockerBlock}\n`;
  }
  await writeFile(dockerignorePath, dockerignore, 'utf8');

  return paths;
}

async function main() {
  const paths = await syncPublicCosExcludes();
  console.log(`已同步 ${paths.length} 条 COS 媒体排除规则`);
  for (const p of paths) {
    console.log(`  ${p}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
