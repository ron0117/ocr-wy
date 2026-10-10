export interface OcrLine {
  text: string;
  confidence?: number;
  box: number[][];
}

export interface ParsedMember {
  playerName: string;
  rank: number;
  level: number | null;
  path: string | null;
  score: number | null;
  fashion: number | null;
  weeklyActivity: number | null;
  joinedText: string | null;
}

const FIELDS = [
  { field: 'playerName', label: '玩家名称' },
  { field: 'level', label: '等级' },
  { field: 'path', label: '途径' },
  { field: 'score', label: '非凡评分' },
  { field: 'fashion', label: '风尚度' },
  { field: 'weeklyActivity', label: '周活跃' },
  { field: 'joinedText', label: '入会时间' },
] as const;

type Field = (typeof FIELDS)[number]['field'];

interface Cell {
  text: string;
  x: number;
  y: number;
  h: number;
  cx: number;
  cy: number;
  bottom: number;
}

interface Anchor {
  field: Field;
  x: number;
  cx: number;
}

function toCell(line: OcrLine): Cell | null {
  const xs = line.box.map((point) => point?.[0]).filter((value): value is number => typeof value === 'number');
  const ys = line.box.map((point) => point?.[1]).filter((value): value is number => typeof value === 'number');
  if (xs.length === 0 || ys.length === 0) return null;
  const text = line.text.trim();
  if (!text) return null;
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return {
    text,
    x,
    y,
    h: Math.max(bottom - y, 1),
    cx: (x + right) / 2,
    cy: (y + bottom) / 2,
    bottom,
  };
}

function clusterRows(cells: Cell[]): Cell[][] {
  const sorted = [...cells].sort((a, b) => a.cy - b.cy || a.x - b.x);
  const rows: Cell[][] = [];
  for (const cell of sorted) {
    const row = rows.find((candidate) => overlaps(candidate, cell));
    if (row) row.push(cell);
    else rows.push([cell]);
  }
  return rows.map((row) => row.sort((a, b) => a.x - b.x));
}

function overlaps(row: Cell[], cell: Cell): boolean {
  const top = Math.min(...row.map((item) => item.y));
  const bottom = Math.max(...row.map((item) => item.bottom));
  const overlap = Math.min(bottom, cell.bottom) - Math.max(top, cell.y);
  const rowHeight = Math.max(bottom - top, 1);
  return overlap > Math.min(rowHeight, cell.h) * 0.4;
}

function rowCenter(row: Cell[]): number {
  return row.reduce((sum, cell) => sum + cell.cy, 0) / row.length;
}

function matchField(text: string): Field | null {
  const hit = FIELDS.find((item) => text.includes(item.label));
  return hit?.field ?? null;
}

const INT32_MAX = 2_147_483_647;

function parseInteger(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isSafeInteger(value) || value > INT32_MAX) return null;
  return value;
}

function integerOf(cells: Cell[], anchorCx: number): number | null {
  const parsed = cells.flatMap((cell) => {
    const value = parseInteger(cell.text);
    return value === null ? [] : [{ cell, value }];
  });
  if (parsed.length === 0) return null;
  return parsed.reduce((best, item) =>
    Math.abs(item.cell.cx - anchorCx) < Math.abs(best.cell.cx - anchorCx) ? item : best,
  ).value;
}

function textOf(cells: Cell[]): string {
  return cells
    .sort((a, b) => a.x - b.x)
    .map((cell) => cell.text)
    .join('')
    .trim();
}

function anchorCx(anchors: Anchor[], field: Field): number {
  return anchors.find((anchor) => anchor.field === field)?.cx ?? 0;
}

function optionalText(cells: Cell[]): string | null {
  const text = textOf(cells);
  return text.length > 0 ? text : null;
}

export function parseMemberTable(lines: OcrLine[]): ParsedMember[] {
  const cells = lines.flatMap((line) => {
    const cell = toCell(line);
    return cell ? [cell] : [];
  });
  const rows = clusterRows(cells);
  const header = rows.find((row) => row.some((cell) => cell.text.includes('玩家名称')));
  if (!header) return [];

  const anchors: Anchor[] = [];
  for (const cell of header) {
    const field = matchField(cell.text);
    if (!field || anchors.some((anchor) => anchor.field === field)) continue;
    anchors.push({ field, x: cell.x, cx: cell.cx });
  }
  const nameAnchor = anchors.find((anchor) => anchor.field === 'playerName');
  if (!nameAnchor) return [];

  const headerCy = rowCenter(header);
  const members: ParsedMember[] = [];
  for (const row of rows) {
    if (rowCenter(row) <= headerCy) continue;
    const rankCell = row
      .filter((cell) => cell.cx < nameAnchor.x && parseInteger(cell.text) !== null)
      .sort((a, b) => b.cx - a.cx)[0];
    const rank = rankCell ? parseInteger(rankCell.text) : null;
    if (rank === null) continue;

    const grouped = new Map<Field, Cell[]>();
    for (const cell of row) {
      if (cell === rankCell || cell.cx < nameAnchor.x) continue;
      const anchor = anchors.reduce((best, item) =>
        Math.abs(item.cx - cell.cx) < Math.abs(best.cx - cell.cx) ? item : best,
      );
      const list = grouped.get(anchor.field) ?? [];
      list.push(cell);
      grouped.set(anchor.field, list);
    }

    const playerName = textOf(grouped.get('playerName') ?? []);
    if (!playerName || playerName.includes('玩家名称')) continue;

    members.push({
      playerName,
      rank,
      level: integerOf(grouped.get('level') ?? [], anchorCx(anchors, 'level')),
      path: optionalText(grouped.get('path') ?? []),
      score: integerOf(grouped.get('score') ?? [], anchorCx(anchors, 'score')),
      fashion: integerOf(grouped.get('fashion') ?? [], anchorCx(anchors, 'fashion')),
      weeklyActivity: integerOf(grouped.get('weeklyActivity') ?? [], anchorCx(anchors, 'weeklyActivity')),
      joinedText: optionalText(grouped.get('joinedText') ?? []),
    });
  }
  return members;
}
