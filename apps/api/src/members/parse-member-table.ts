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
  right: number;
  cx: number;
  cy: number;
  bottom: number;
}

interface Anchor {
  field: Field;
  x: number;
  right: number;
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
    right,
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

function compactText(text: string): string {
  return text.replace(/\s+/g, '');
}

function canGrowHeader(text: string): boolean {
  return FIELDS.some((item) => item.label.startsWith(text));
}

function isGroupHeader(text: string): boolean {
  const compact = compactText(text);
  if (!compact.includes('分组')) return false;
  return !FIELDS.some((item) => compact.includes(item.label));
}

export function omitGroupColumn(lines: OcrLine[]): OcrLine[] {
  const cells = lines.flatMap((line) => {
    const cell = toCell(line);
    return cell ? [cell] : [];
  });
  const header = clusterRows(cells).find((row) => row.some((cell) => cell.text.includes('玩家名称')));
  if (!header) return lines;
  const sorted = [...header].sort((a, b) => a.x - b.x);
  const group = sorted.find((cell) => isGroupHeader(cell.text));
  if (!group) return lines;
  const index = sorted.indexOf(group);
  const previous = sorted[index - 1];
  const next = sorted[index + 1];
  const left = previous ? (previous.right + group.x) / 2 : group.x;
  const right = next ? (group.right + next.x) / 2 : group.right;
  return lines.filter((line) => {
    const cell = toCell(line);
    if (!cell) return true;
    return cell.cx < left || cell.cx > right;
  });
}

function resolveHeader(text: string): Field | null {
  const exact = FIELDS.find((item) => text.includes(item.label));
  if (exact) return exact.field;
  if (text.includes('风尚')) return 'fashion';
  if (text.includes('入会')) return 'joinedText';
  return null;
}

function headerAnchors(header: Cell[]): Anchor[] {
  const anchors: Anchor[] = [];
  const used = new Set<Cell>();
  for (let i = 0; i < header.length; i++) {
    if (used.has(header[i])) continue;
    const group = [header[i]];
    let text = compactText(header[i].text);
    for (let j = i + 1; j < header.length; j++) {
      const gap = header[j].x - header[j - 1].right;
      if (gap > Math.max(header[j].h, header[j - 1].h, 8)) break;
      const grown = text + compactText(header[j].text);
      if (!canGrowHeader(grown)) break;
      group.push(header[j]);
      text = grown;
    }
    const field = resolveHeader(text);
    if (!field || anchors.some((anchor) => anchor.field === field)) continue;
    const x = Math.min(...group.map((cell) => cell.x));
    const right = Math.max(...group.map((cell) => cell.right));
    anchors.push({ field, x, right, cx: (x + right) / 2 });
    group.forEach((cell) => used.add(cell));
  }
  return anchors;
}

function fieldOf(anchors: Anchor[], cell: Cell): Field {
  const sorted = [...anchors].sort((a, b) => a.x - b.x);
  for (let i = 0; i < sorted.length - 1; i++) {
    const boundary = (sorted[i].right + sorted[i + 1].x) / 2;
    if (cell.cx < boundary) return sorted[i].field;
  }
  return sorted[sorted.length - 1].field;
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

function joinedOf(cells: Cell[]): string | null {
  const combined = textOf(cells).replace(/\s+/g, '');
  const matched = combined.match(/\d+天/);
  if (matched) return matched[0];
  return optionalText(cells);
}

export function omitClippedTopLines(lines: OcrLine[]): OcrLine[] {
  const cells = lines.flatMap((line) => {
    const cell = toCell(line);
    return cell ? [cell] : [];
  });
  const clustered = clusterRows(cells);
  const header = clustered.find((row) => row.some((cell) => cell.text.includes('玩家名称')));
  if (!header) return lines;
  const headerCy = rowCenter(header);
  const dropped = leadingClippedRows(clustered.filter((row) => rowCenter(row) > headerCy));
  if (dropped.length === 0) return lines;
  const bottom = Math.max(...dropped.flat().map((cell) => cell.bottom));
  return lines.filter((line) => {
    const cell = toCell(line);
    if (!cell || cell.cy <= headerCy) return true;
    return cell.y + 1 >= bottom;
  });
}

function leadingClippedRows(dataRows: Cell[][]): Cell[][] {
  if (dataRows.length < 3) return [];
  const typicalSpan = median(dataRows.map(rowSpan));
  const centers = dataRows.map(rowCenter);
  const pitches = centers.slice(1).flatMap((center, index) => {
    const pitch = center - centers[index];
    return pitch > typicalSpan * 0.45 ? [pitch] : [];
  });
  const typicalPitch = median(pitches);
  if (typicalSpan <= 0 || typicalPitch <= 0) return [];
  const short = (row: Cell[]) => rowSpan(row) < typicalSpan * 0.72;
  if (!short(dataRows[0])) return [];
  const dropped = [dataRows[0]];
  const gap = centers[1] - centers[0];
  if (short(dataRows[1]) || gap < typicalPitch * 0.62) dropped.push(dataRows[1]);
  return dropped;
}

function rowSpan(row: Cell[]): number {
  return Math.max(...row.map((cell) => cell.bottom)) - Math.min(...row.map((cell) => cell.y));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function parseMemberTable(lines: OcrLine[]): ParsedMember[] {
  const cells = omitClippedTopLines(omitGroupColumn(lines)).flatMap((line) => {
    const cell = toCell(line);
    return cell ? [cell] : [];
  });
  const rows = clusterRows(cells);
  const header = rows.find((row) => row.some((cell) => cell.text.includes('玩家名称')));
  if (!header) return [];

  const anchors = headerAnchors(header);
  const nameAnchor = anchors.find((anchor) => anchor.field === 'playerName');
  if (!nameAnchor) return [];

  const headerCy = rowCenter(header);
  const members: ParsedMember[] = [];
  for (const row of rows) {
    if (rowCenter(row) <= headerCy) continue;

    const grouped = new Map<Field, Cell[]>();
    for (const cell of row) {
      if (cell.cx < nameAnchor.x) continue;
      const anchor = { field: fieldOf(anchors, cell) };
      const list = grouped.get(anchor.field) ?? [];
      list.push(cell);
      grouped.set(anchor.field, list);
    }

    const playerName = textOf(grouped.get('playerName') ?? []);
    if (!playerName || playerName.includes('玩家名称')) continue;

    const member = {
      playerName,
      rank: members.length + 1,
      level: integerOf(grouped.get('level') ?? [], anchorCx(anchors, 'level')),
      path: optionalText(grouped.get('path') ?? []),
      score: integerOf(grouped.get('score') ?? [], anchorCx(anchors, 'score')),
      fashion: integerOf(grouped.get('fashion') ?? [], anchorCx(anchors, 'fashion')),
      weeklyActivity: integerOf(grouped.get('weeklyActivity') ?? [], anchorCx(anchors, 'weeklyActivity')),
      joinedText: joinedOf(grouped.get('joinedText') ?? []),
    };
    const hasDetail = (['level', 'path', 'score', 'fashion', 'weeklyActivity', 'joinedText'] as const).some(
      (field) => (grouped.get(field) ?? []).length > 0,
    );
    if (!hasDetail) continue;
    members.push(member);
  }
  return members;
}
