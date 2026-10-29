/** 图鉴 18 件封印物名称 → icons 文件名（与 apps/guide/data/seals 一致） */
export const SEAL_ICON_FILE_BY_NAME: Readonly<Record<string, string>> = {
  丧钟: '攻击-丧钟.png',
  幸运草: '攻击-幸运草.png',
  黄昏面具: '攻击-黄昏面具.png',
  蠕动的饥饿: '攻击-蠕动的饥饿.png',
  飓风之斧: '攻击-飓风之斧.png',
  公证书: '攻击-公证书.png',
  正义钱包: '防御-正义钱包.png',
  生物毒素瓶: '防御-生物毒素瓶.png',
  荣耀之证: '防御-荣耀之证.png',
  安静发丝: '防御-安静发丝.png',
  月亮纸人: '防御-月亮纸人.png',
  绿华: '防御-绿华.png',
  生命手杖: '特化-生命手杖.png',
  深红月冕: '特化-深红月冕.png',
  许愿神灯: '特化-许愿神灯.png',
  厄运布偶: '特化-厄运布偶.png',
  无瞳的将军: '特化-无瞳的将军.png',
  大地的恩赐: '特化-大地的恩赐.png',
};

export function sealIconFileForName(name: string): string | undefined {
  const key = name.trim();
  return SEAL_ICON_FILE_BY_NAME[key];
}

export function sealIconSrcFromFile(iconFile: string): string {
  return `/seal-assets/icons/${encodeURIComponent(iconFile)}`;
}

export function sealIconSrcForName(name: string): string | undefined {
  const file = sealIconFileForName(name);
  return file ? sealIconSrcFromFile(file) : undefined;
}
