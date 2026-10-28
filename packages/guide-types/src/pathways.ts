/** 解包 profession id → 站点 slug */
export const PROFESSION_ID_TO_SLUG: Record<string, string> = {
  '1200001': 'sun',
  '1200002': 'dreamer',
  '1200003': 'fool',
  '1200004': 'arbitrator',
  '1200005': 'door',
  '1200006': 'giant',
  '1200007': 'hermit',
};

/**
 * 公测卡片「职业」名（序列 9 起始职业），与游戏内「XX途径」区分。
 * 例：空想家途径 → 展示「观众」。
 */
export const PATHWAY_PROFESSION_LABEL: Record<string, string> = {
  sun: '歌颂者',
  dreamer: '观众',
  fool: '占卜家',
  arbitrator: '仲裁人',
  door: '学徒',
  giant: '战士',
  hermit: '窥秘人',
};

/** 游戏内途径副标题，如「观众途径」 */
export const PATHWAY_ROUTE_LABEL: Record<string, string> = {
  sun: '歌颂者途径',
  dreamer: '观众途径',
  fool: '占卜家途径',
  arbitrator: '仲裁人途径',
  door: '学徒途径',
  giant: '战士途径',
  hermit: '窥秘人途径',
};

/** 卡牌上的神祇/高位称呼（与职业不同） */
export const PATHWAY_DEITY_LABEL: Record<string, string> = {
  sun: '太阳',
  dreamer: '空想家',
  fool: '愚者',
  arbitrator: '审判者',
  door: '门',
  giant: '黄昏巨人',
  hermit: '隐者',
};

export function pathwayProfessionLabel(
  slug: string,
  importedName?: string,
): string {
  return (
    PATHWAY_PROFESSION_LABEL[slug] ??
    importedName?.replace(/途径$/, '') ??
    slug
  );
}

export function pathwayRouteLabel(slug: string, importedName?: string): string {
  return PATHWAY_ROUTE_LABEL[slug] ?? importedName ?? `${slug}途径`;
}

export function skillSlugFromExternalId(id: number | string): string {
  return `s-${id}`;
}
