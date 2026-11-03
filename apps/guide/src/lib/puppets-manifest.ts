/** 图标约定：apps/guide/data/puppets/icons/{秘偶名}.png。缺文件不抛错。 */
export function puppetIconUrl(name: string): string {
  return `/puppet-assets/icons/${encodeURIComponent(name.trim())}.png`;
}
