import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';
import { PUBLIC_ASSET_PAGES, publicAssetUrl } from './public-asset-pages';

export { PUBLIC_ASSET_PAGES } from './public-asset-pages';

export type PublicAssetCdnOptions = {
  /** 如 https://static.example.com，无尾部斜杠 */
  cdnBase: string;
  /** 与 COS 对象键前缀一致（可选） */
  keyPrefix: string;
  /** 构建产物中从 public 拷贝出的媒体文件是否删除（仅保留 HTML） */
  omitLocalAssets: boolean;
  outDir: string;
};

function withKeyPrefix(prefix: string, objectKey: string): string {
  const p = prefix.replace(/^\/+|\/+$/g, '');
  return p ? `${p}/${objectKey}` : objectKey;
}

export function rewritePublicPageAssets(
  html: string,
  cdnBase: string,
  pageKey: string,
  fileNames: readonly string[],
  keyPrefix = '',
): string {
  let out = html;
  const dir = path.posix.dirname(pageKey);
  for (const name of fileNames) {
    const objectKey = dir === '.' ? name : `${dir}/${name}`;
    const url = publicAssetUrl(cdnBase, withKeyPrefix(keyPrefix, objectKey));
    out = out.split(`./${name}`).join(url);
    out = out.split(`"${name}"`).join(`"${url}"`);
    out = out.split(`"${name}#`).join(`"${url}#`);
  }
  return out;
}

export function publicAssetCdnPlugin(options: PublicAssetCdnOptions): Plugin {
  const { cdnBase, keyPrefix, omitLocalAssets, outDir } = options;

  return {
    name: 'public-asset-cdn',
    apply: 'build',
    async closeBundle() {
      if (!cdnBase && !omitLocalAssets) return;

      for (const [pageKey, files] of Object.entries(PUBLIC_ASSET_PAGES)) {
        const htmlPath = path.join(outDir, pageKey);
        let html: string;
        try {
          html = await readFile(htmlPath, 'utf8');
        } catch {
          continue;
        }
        if (cdnBase) {
          const next = rewritePublicPageAssets(html, cdnBase, pageKey, files, keyPrefix);
          await writeFile(htmlPath, next, 'utf8');
        }

        if (omitLocalAssets) {
          const dir = path.join(outDir, path.posix.dirname(pageKey));
          for (const name of files) {
            await rm(path.join(dir, name), { force: true });
          }
        }
      }
    },
  };
}
