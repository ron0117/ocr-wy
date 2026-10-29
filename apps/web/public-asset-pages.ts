/** 活动页 HTML 与需同步到 COS 的媒体（路径相对 apps/web/public）。 */
export const PUBLIC_ASSET_PAGES: Record<string, readonly string[]> = {
  '20261027/20261027.html': [
    'wechat-article-background-original.png',
    '众神之战.jpg',
    '无忧仙境活动.png',
    '视频.mp4',
  ],
};

export type PublicAssetEntry = {
  pageKey: string;
  fileName: string;
  /** COS 对象键，如 20261027/视频.mp4 */
  objectKey: string;
  /** 相对 apps/web/public */
  publicRelativePath: string;
};

export function listPublicAssetEntries(): PublicAssetEntry[] {
  const entries: PublicAssetEntry[] = [];
  for (const [pageKey, files] of Object.entries(PUBLIC_ASSET_PAGES)) {
    const dir = pageKey.includes('/') ? pageKey.slice(0, pageKey.lastIndexOf('/')) : '';
    for (const fileName of files) {
      const objectKey = dir ? `${dir}/${fileName}` : fileName;
      entries.push({
        pageKey,
        fileName,
        objectKey,
        publicRelativePath: objectKey,
      });
    }
  }
  return entries;
}

/** 与构建插件一致的公网访问 URL（公有读桶 / CDN 根域名）。 */
export function publicAssetUrl(cdnBase: string, objectKey: string): string {
  const base = cdnBase.replace(/\/$/, '');
  const slash = objectKey.lastIndexOf('/');
  if (slash === -1) {
    return `${base}/${encodeURIComponent(objectKey)}`;
  }
  const dir = objectKey.slice(0, slash);
  const name = objectKey.slice(slash + 1);
  return `${base}/${dir}/${encodeURIComponent(name)}`;
}

/** 未绑 CDN 时 COS 默认访问域名（桶公有读）。 */
export function defaultCosPublicBase(bucket: string, region: string): string {
  return `https://${bucket}.cos.${region}.myqcloud.com`;
}
