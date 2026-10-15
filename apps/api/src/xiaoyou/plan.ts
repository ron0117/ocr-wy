import { isMemberField, planMemberLookup, type MemberField } from './member-lookup';

export interface VisibleClub {
  id: string;
  name: string;
  leader: string | null;
}

export type ActivityStatusFilter = 'PUBLISHED' | 'ENDED';
export type RosterSide = 'attended' | 'missed' | 'both';

export type PlannedTool =
  | { tool: 'list_clubs' }
  | { tool: 'answer_help' }
  | { tool: 'export_club_members_excel'; clubName?: string; clubNames?: string[]; allMatching?: boolean }
  | { tool: 'get_club_summary'; clubName?: string }
  | { tool: 'lookup_member'; playerName: string; clubName?: string; field: MemberField }
  | { tool: 'list_activities'; clubName?: string; status?: ActivityStatusFilter }
  | { tool: 'get_activity'; title?: string; clubName?: string }
  | { tool: 'activity_roster'; title?: string; clubName?: string; side: RosterSide }
  | { tool: 'member_activities'; playerName: string; clubName?: string };

export type ClubMatch =
  | { type: 'exact'; club: VisibleClub }
  | { type: 'confirm'; club: VisibleClub }
  | { type: 'choice'; clubs: VisibleClub[] }
  | { type: 'none' };

export interface PendingState {
  kind: 'choose' | 'confirm';
  clubIds: string[];
  intent: 'export' | 'summary' | 'lookup' | 'activity';
  playerName?: string;
  playerNames?: string[];
  field?: MemberField;
  activityIds?: string[];
  activityTool?: 'get_activity' | 'activity_roster';
  rosterSide?: RosterSide;
  follow?: 'member_activities';
}

export function planLocally(text: string): PlannedTool {
  const raw = text.trim();
  if (/绑定状态|企业微信/.test(raw)) return { tool: 'answer_help' };
  if (/哪些俱乐部|能查看哪些|可以看哪些|我能看哪些|有哪些俱乐部/.test(raw)) {
    return { tool: 'list_clubs' };
  }
  const activity = planActivity(raw);
  if (activity) return activity;
  if (/导出|下载/.test(raw)) {
    return { tool: 'export_club_members_excel', clubName: extractClubPhrase(raw) };
  }
  const lookup = planMemberLookup(raw);
  if (lookup) return { tool: 'lookup_member', ...lookup };
  if (/多少人|几个人|人数|什么时候更新|更新时间|基本信息|会长/.test(raw)) {
    return { tool: 'get_club_summary', clubName: extractClubPhrase(raw) };
  }
  return { tool: 'answer_help' };
}

export function isNewTopic(text: string): boolean {
  return /导出|下载|打包|excel|名单|多少人|几个人|人数|哪些俱乐部|什么时候更新|更新时间|基本信息|你能做|你会什么|帮助|所有|全部|查|找|等级|途径|非凡|风尚|周活跃|入会|绑定|活动|签到|迟到/i.test(text);
}

export function planPackAll(text: string): { keyword?: string } | null {
  const raw = text.trim();
  if (!/(导出|打包|下载|excel|名单)/iu.test(raw)) return null;
  if (!/(所有|全部|每家|每个)/u.test(raw)) return null;
  const before = raw.match(/([\u4e00-\u9fa5A-Za-z0-9]{1,12})(?:的)?(?:所有|全部)(?:的)?俱乐部/u);
  const after = raw.match(/(?:所有|全部|每家|每个)(?:的)?([\u4e00-\u9fa5A-Za-z0-9]{0,12})俱乐部/u);
  const keyword = cleanKeyword(before?.[1]) || cleanKeyword(after?.[1]);
  return keyword ? { keyword } : {};
}

export function packTargets(clubs: VisibleClub[], keyword?: string): VisibleClub[] {
  if (!keyword) return clubs;
  return clubs.filter((club) => club.name.includes(keyword));
}

export function nearbyClubs(clubs: VisibleClub[], query: string): VisibleClub[] {
  const name = query.trim();
  if (name.length < 2) return [];
  return clubs.filter((club) => {
    const clubName = club.name.trim();
    return clubName.includes(name) || name.includes(clubName) || sharedPrefix(clubName, name) >= 2;
  }).slice(0, 8);
}

export function matchClubs(clubs: VisibleClub[], rawName: string): ClubMatch {
  const name = rawName.trim();
  if (!name) return { type: 'none' };
  const exact = clubs.filter((club) => club.name.trim() === name);
  if (exact.length === 1) return { type: 'exact', club: exact[0] };
  if (exact.length > 1) return { type: 'choice', clubs: exact };
  const fuzzy = clubs.filter((club) => club.name.trim().includes(name));
  if (fuzzy.length === 1) return { type: 'confirm', club: fuzzy[0] };
  if (fuzzy.length > 1) return { type: 'choice', clubs: fuzzy };
  return { type: 'none' };
}

export function resolvePending(
  clubs: VisibleClub[],
  text: string,
  kind: PendingState['kind'],
): VisibleClub | 'reject' | null {
  const trimmed = text.trim().replace(/[。.!！]$/u, '');
  if (/^(?:不是|不对|取消|算了|不要)$/u.test(trimmed)) return 'reject';
  if (kind === 'confirm' && /^(?:是|好|对|确认|嗯|好的)$/u.test(trimmed)) return clubs[0] ?? null;
  const index = parseIndex(trimmed);
  if (index && clubs[index - 1]) return clubs[index - 1];
  const exact = clubs.filter((club) => club.name.trim() === trimmed);
  if (exact.length === 1) return exact[0];
  const hits = clubs.filter((club) => club.name.includes(trimmed) || trimmed.includes(club.name));
  if (hits.length === 1) return hits[0];
  return null;
}

export function resolveMemberPick(
  options: Array<{ clubName: string; playerName: string }>,
  text: string,
  kind: PendingState['kind'],
): number | 'reject' | null {
  const trimmed = text.trim().replace(/[。.!！]$/u, '');
  if (/^(?:不是|不对|取消|算了|不要)$/u.test(trimmed)) return 'reject';
  if (kind === 'confirm' && /^(?:是|好|对|确认|嗯|好的)$/u.test(trimmed)) return 0;
  const index = parseIndex(trimmed);
  if (index && options[index - 1]) return index - 1;
  const byPerson = options.flatMap((item, itemIndex) => (item.playerName === trimmed ? [itemIndex] : []));
  if (byPerson.length === 1) return byPerson[0];
  const byClub = options.flatMap((item, itemIndex) => (item.clubName === trimmed || item.clubName.includes(trimmed) ? [itemIndex] : []));
  if (byClub.length === 1) return byClub[0];
  const both = options.findIndex((item) => trimmed.includes(item.playerName) && trimmed.includes(item.clubName));
  return both >= 0 ? both : null;
}

export function formatClubList(clubs: VisibleClub[]): string {
  const labels = clubs.map((club) => {
    const duplicated = clubs.filter((item) => item.name === club.name).length > 1;
    const leader = club.leader?.trim();
    if (duplicated && leader) return `「${club.name}」（会长${leader}）`;
    if (duplicated) return `「${club.name}」（未填会长）`;
    return `「${club.name}」`;
  });
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]}和${labels[1]}`;
  return `${labels.slice(0, -1).join('、')}和${labels[labels.length - 1]}`;
}

export function planActivity(raw: string): PlannedTool | null {
  if (!/活动|签到|迟到/.test(raw) || /导出|下载/.test(raw)) return null;
  const status = /已结束|结束了/.test(raw) ? 'ENDED' : /未结束|进行中|已发布/.test(raw) ? 'PUBLISHED' : undefined;
  const side: RosterSide = /没参加|未参加|未签到|缺席|谁没/.test(raw)
    ? 'missed'
    : /谁参加|已签到|参加了谁|参加的人/.test(raw) && !/没参加|未参加/.test(raw)
      ? 'attended'
      : 'both';
  if (/谁参加|谁没|谁未签到|谁迟到|参加了多少|多少人参加|迟到了多少|迟到的人/.test(raw)) {
    return { tool: 'activity_roster', title: extractActivityTitle(raw), clubName: extractClubPhrase(raw), side: /迟到/.test(raw) && side === 'both' ? 'attended' : side };
  }
  if (/参加了哪些|参加过哪些|没参加哪些|未签到的活动|迟到了哪些|缺了哪些|的活跃度/.test(raw)) {
    const playerName = extractActivityPlayer(raw);
    if (!playerName) return { tool: 'answer_help' };
    return { tool: 'member_activities', playerName, clubName: extractClubPhrase(raw) };
  }
  if (/有哪些活动|活动列表|哪些活动|还有哪些活动/.test(raw)) {
    return { tool: 'list_activities', clubName: extractClubPhrase(raw), status };
  }
  if (/活动/.test(raw)) {
    return { tool: 'get_activity', title: extractActivityTitle(raw), clubName: extractClubPhrase(raw) };
  }
  return null;
}

function extractActivityTitle(raw: string): string | undefined {
  const quoted = raw.match(/「([^」]{1,40})」/u);
  if (quoted && !/俱乐部/.test(quoted[1])) return quoted[1].trim();
  const cleaned = raw
    .replace(/谁参加了|谁没参加|谁未签到|谁迟到了|参加了多少人|有哪些活动|活动列表/gu, '')
    .replace(/的?(?:开始时间|时间|出席|签到|迟到|人员|名单)/gu, '')
    .replace(/^(?:小忧[，,\s]*|请|帮我|给我|查一下|看看|问一下)+/u, '')
    .trim();
  if (!cleaned || cleaned.length > 40 || /俱乐部|活动$/.test(cleaned)) return undefined;
  return cleaned.replace(/活动$/u, '').trim() || undefined;
}

function extractActivityPlayer(raw: string): string | undefined {
  const quoted = raw.match(/「([^」]{1,40})」/u);
  if (quoted && !/俱乐部/.test(quoted[1])) return quoted[1].trim();
  const cleaned = raw
    .replace(/的?(?:参加了哪些活动|参加过哪些活动|没参加哪些活动|未签到的活动|迟到了哪些活动|缺了哪些活动|活跃度).*$/u, '')
    .replace(/^(?:小忧[，,\s]*|请|帮我|给我|查一下|看看|问一下)+/u, '')
    .replace(/俱乐部/gu, '')
    .trim();
  if (!cleaned || cleaned.length > 40) return undefined;
  return cleaned;
}

export function readPending(value: unknown): PendingState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as {
    kind?: unknown;
    clubIds?: unknown;
    intent?: unknown;
    playerName?: unknown;
    playerNames?: unknown;
    field?: unknown;
    activityIds?: unknown;
    activityTool?: unknown;
    rosterSide?: unknown;
    follow?: unknown;
  };
  if (row.kind !== 'choose' && row.kind !== 'confirm') return null;
  if (row.intent === 'activity') {
    if (!Array.isArray(row.activityIds) || row.activityIds.some((id) => typeof id !== 'string')) return null;
    if (row.activityTool !== 'get_activity' && row.activityTool !== 'activity_roster') return null;
    const rosterSide = row.rosterSide === 'attended' || row.rosterSide === 'missed' || row.rosterSide === 'both' ? row.rosterSide : 'both';
    return {
      kind: row.kind,
      intent: 'activity',
      clubIds: [],
      activityIds: row.activityIds,
      activityTool: row.activityTool,
      rosterSide,
    };
  }
  if (row.intent !== 'export' && row.intent !== 'summary' && row.intent !== 'lookup') return null;
  if (!Array.isArray(row.clubIds) || row.clubIds.some((id) => typeof id !== 'string')) return null;
  if (row.intent !== 'lookup') return { kind: row.kind, intent: row.intent, clubIds: row.clubIds };
  if (typeof row.playerName !== 'string' || !row.playerName.trim()) return null;
  if (typeof row.field !== 'string' || !isMemberField(row.field)) return null;
  const playerNames = Array.isArray(row.playerNames) ? row.playerNames.filter((name): name is string => typeof name === 'string') : undefined;
  if (playerNames && playerNames.length !== row.clubIds.length) return null;
  return {
    kind: row.kind,
    intent: 'lookup',
    clubIds: row.clubIds,
    playerName: row.playerName.trim(),
    playerNames,
    field: row.field,
    ...(row.follow === 'member_activities' ? { follow: 'member_activities' as const } : {}),
  };
}

function extractClubPhrase(text: string): string | undefined {
  const matched = text.match(/([\u4e00-\u9fa5A-Za-z0-9]{1,20}俱乐部)([\u4e00-\u9fa5A-Za-z0-9]{0,12})/);
  if (!matched) return undefined;
  const suffix = matched[2].replace(/(?:有|的|人|成|几|多|什么|何时|更新|基本|会长|数据|名单|表|excel).*$/i, '');
  const phrase = cleanPrefix(`${matched[1]}${suffix}`);
  return phrase.includes('俱乐部') ? phrase : undefined;
}

function cleanPrefix(phrase: string): string {
  return phrase.replace(/^(?:小忧|请|帮我|给我|一份|导出|下载|查询|查看|问一下|看看|的)+/u, '');
}

function sharedPrefix(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let count = 0;
  while (count < limit && left[count] === right[count]) count += 1;
  return count;
}

function cleanKeyword(value: string | undefined): string {
  const keyword = (value ?? '')
    .replace(/^(?:小忧|请|帮我|给我|帮|将|把|一份|的|我|需要|导出|下载|打包|查询|查看)+/u, '')
    .replace(/(?:俱乐部|人员|名单|的人|人)+$/u, '')
    .trim();
  if (!keyword || keyword === '俱乐部' || keyword === '人') return '';
  return keyword;
}

function parseIndex(text: string): number | null {
  const digit = text.match(/^(?:第)?(\d{1,2})(?:个)?$/u);
  if (digit) {
    const value = Number(digit[1]);
    return value > 0 ? value : null;
  }
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const word = text.match(/^(?:第)?([一二三四五六七八九])(?:个)?$/u);
  if (!word) return null;
  const value = numerals.indexOf(word[1]) + 1;
  return value > 0 ? value : null;
}
