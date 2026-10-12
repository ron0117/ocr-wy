export type MemberField =
  | 'rank'
  | 'level'
  | 'path'
  | 'score'
  | 'fashion'
  | 'weeklyActivity'
  | 'joined'
  | 'updated'
  | 'binding'
  | 'all';

export interface MemberSnapshot {
  playerName: string;
  clubName: string;
  rank: number;
  level: number | null;
  path: string | null;
  score: number | null;
  fashion: number | null;
  weeklyActivity: number | null;
  joinedText: string | null;
  updatedText: string;
  bound: boolean;
}

const ALL_FIELDS: Exclude<MemberField, 'all'>[] = [
  'rank',
  'level',
  'path',
  'score',
  'fashion',
  'weeklyActivity',
  'joined',
  'updated',
  'binding',
];

const FIELD_TAIL = [
  '详细信息', '具体信息', '完整信息', '详细资料', '具体资料', '完整资料', '详细情况', '具体情况',
  '全部信息', '所有信息', '全部资料', '所有资料', '全部情况', '所有情况',
  '非凡评分', '风尚度', '周活跃', '入会时间', '数据更新时间', '更新时间', '绑定状态',
  '排名', '等级', '途径', '评分', '入会', '绑定', '信息', '资料', '情况',
].join('|');

const FIELD_PATTERNS: Array<[RegExp, MemberField]> = [
  [/详细信息|具体信息|完整信息|详细资料|具体资料|完整资料|详细情况|具体情况|全部信息|所有信息|全部资料|所有资料|全部情况|所有情况/, 'all'],
  [/非凡评分/, 'score'],
  [/风尚度/, 'fashion'],
  [/周活跃/, 'weeklyActivity'],
  [/入会时间|入会/, 'joined'],
  [/数据更新时间|更新时间/, 'updated'],
  [/绑定状态|企业微信/, 'binding'],
  [/排名/, 'rank'],
  [/等级/, 'level'],
  [/途径/, 'path'],
  [/评分/, 'score'],
  [/信息|资料|情况/, 'all'],
];

const FIELD_WORDS = new Set<MemberField>([...ALL_FIELDS, 'all']);

export function isMemberField(value: string): value is MemberField {
  return FIELD_WORDS.has(value as MemberField);
}

export function normalizeField(value: string | undefined): MemberField {
  const text = value?.trim() ?? '';
  if (isMemberField(text)) return text;
  return detectField(text) ?? 'all';
}

export function detectField(text: string): MemberField | null {
  for (const [pattern, field] of FIELD_PATTERNS) {
    if (pattern.test(text)) return field;
  }
  return null;
}

export function planMemberLookup(text: string): { playerName: string; clubName?: string; field: MemberField } | null {
  const raw = text.trim();
  if (/(导出|下载|打包|excel|哪些俱乐部)/i.test(raw)) return null;
  const aboutPerson = /「[^」]{1,40}」|(?:查|找|看看|看一下|问一下)|的(?:排名|等级|途径|非凡评分|评分|风尚度|周活跃|入会|绑定|信息|资料|情况|数据更新时间|更新时间)/.test(raw);
  if (!aboutPerson) return null;
  if (/多少人|几个人|人数|会长|基本信息/.test(raw)) return null;
  if (/什么时候更新/.test(raw) && !/的(?:数据)?更新时间/.test(raw)) return null;
  const field = detectField(raw);
  const picked = extractPlayer(raw);
  if (!picked) return null;
  return { playerName: picked.playerName, clubName: picked.clubName, field: field ?? 'all' };
}

export function describeMember(member: MemberSnapshot, field: MemberField): { detail: string; must: string[] } {
  const fields = field === 'all' ? ALL_FIELDS : [field];
  const parts = fields.map((item) => clause(member, item));
  return { detail: parts.join('，'), must: parts };
}

export function formatMemberList(rows: Array<{ clubName: string; playerName: string }>): string {
  const labels = rows.map((row) => `「${row.clubName}」的「${row.playerName}」`);
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]}和${labels[1]}`;
  return `${labels.slice(0, -1).join('、')}和${labels[labels.length - 1]}`;
}

function clause(member: MemberSnapshot, field: Exclude<MemberField, 'all'>): string {
  if (field === 'rank') return member.rank === 0 ? '排名是空' : `排名是 ${member.rank}`;
  if (field === 'level') return member.level == null ? '等级还没填' : `等级是 ${member.level}`;
  if (field === 'path') return member.path?.trim() ? `途径是${member.path.trim()}` : '途径还没填';
  if (field === 'score') return member.score == null ? '非凡评分还没填' : `非凡评分是 ${member.score}`;
  if (field === 'fashion') return member.fashion == null ? '风尚度还没填' : `风尚度是 ${member.fashion}`;
  if (field === 'weeklyActivity') return member.weeklyActivity == null ? '周活跃还没填' : `周活跃是 ${member.weeklyActivity}`;
  if (field === 'joined') return member.joinedText?.trim() ? `入会时间是${member.joinedText.trim()}` : '入会时间还没填';
  if (field === 'updated') return `数据更新时间是 ${member.updatedText}`;
  return `企业微信角色绑定状态是${member.bound ? '已绑定' : '未绑定'}`;
}

function extractPlayer(raw: string): { playerName: string; clubName?: string } | null {
  let body = raw.replace(new RegExp(`的?(?:${FIELD_TAIL}).*$`, 'u'), '').trim();
  body = body.replace(/^(?:小忧[，,\s]*|请|帮我|给我|麻烦|查一下|查下|查找|查询|找一下|找下|看看|看一下|问一下)+/u, '').trim();
  const owned = body.match(/^(.*?)的([^的]+)$/u);
  if (owned) {
    const right = owned[2].trim();
    if (/^(?:详细|具体|完整|全部|所有)$/u.test(right)) {
      const playerName = cleanPlayer(owned[1]);
      if (!playerName) return null;
      return { playerName };
    }
    const playerName = cleanPlayer(right);
    const clubName = cleanClub(owned[1]);
    if (!playerName) return null;
    return { playerName, clubName };
  }
  const clubLead = body.match(/^(.*俱乐部)(.+)$/u);
  if (clubLead) {
    const playerName = cleanPlayer(clubLead[2]);
    const clubName = cleanClub(clubLead[1]);
    if (playerName) return { playerName, clubName };
  }
  const playerName = cleanPlayer(body);
  if (!playerName) return null;
  return { playerName };
}

function cleanPlayer(value: string): string {
  const name = value.replace(/[？?。！!，,\s]+$/u, '').replace(/^(?:的|在)+/u, '').trim();
  if (!name || name.length > 40) return '';
  if (/^(?:人|人员|名单|俱乐部|这个人|那位)$/u.test(name)) return '';
  return name;
}

function cleanClub(value: string): string | undefined {
  const name = value.replace(/^(?:在)+/u, '').replace(/(?:里|中)$/u, '').trim();
  if (!name || name.length > 40) return undefined;
  return name;
}
