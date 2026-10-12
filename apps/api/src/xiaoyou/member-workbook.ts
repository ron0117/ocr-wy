import * as XLSX from 'xlsx';
import { asExcelText } from '../common/numbers';

export interface MemberExportRow {
  rank: number;
  playerName: string;
  clubName: string;
  level: number | null;
  path: string | null;
  score: number | null;
  fashion: number | null;
  weeklyActivity: number | null;
  joinedText: string | null;
  dataUpdatedAt: Date;
  bound: boolean;
}

const HEADERS = [
  '排名',
  '玩家名称',
  '俱乐部名称',
  '等级',
  '途径',
  '非凡评分',
  '风尚度',
  '周活跃',
  '入会时间',
  '数据更新时间',
  '企业微信角色绑定状态',
];

export function buildMemberWorkbook(rows: MemberExportRow[]): Buffer {
  const grouped = new Set(rows.map((row) => row.clubName)).size > 1;
  const ordered = [...rows].sort((left, right) => {
    if (grouped) {
      const byClub = left.clubName.localeCompare(right.clubName, 'zh');
      if (byClub) return byClub;
    }
    const leftEmpty = left.rank === 0 ? 1 : 0;
    const rightEmpty = right.rank === 0 ? 1 : 0;
    if (leftEmpty !== rightEmpty) return leftEmpty - rightEmpty;
    if (left.rank !== right.rank) return left.rank - right.rank;
    return left.playerName.localeCompare(right.playerName, 'zh');
  });
  const body = ordered.map((row) => [
    row.rank === 0 ? '' : row.rank,
    asExcelText(row.playerName),
    asExcelText(row.clubName),
    row.level ?? '',
    asExcelText(row.path ?? ''),
    row.score ?? '',
    row.fashion ?? '',
    row.weeklyActivity ?? '',
    asExcelText(row.joinedText ?? ''),
    asExcelText(formatShanghai(row.dataUpdatedAt, 'minute')),
    row.bound ? '已绑定' : '未绑定',
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...body]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, '人员名单');
  return Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
}

export function memberFileName(clubName: string, date: Date): string {
  const cleaned = clubName.replace(/[\\/:*?"<>|]/g, '').trim() || '俱乐部';
  return `${cleaned}-人员名单-${formatShanghai(date, 'file')}.xlsx`;
}

export function formatShanghai(date: Date, pattern: 'file' | 'minute'): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  if (pattern === 'file') {
    return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
  }
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
