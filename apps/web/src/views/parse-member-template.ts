import ExcelJS from 'exceljs';
import { normalizeSpreadsheetXml } from './normalize-xlsx';

export interface TemplateDraft {
  playerName: string;
  rank: number;
  level: number | null;
  path: string;
  score: number | null;
  fashion: number | null;
  weeklyActivity: number | null;
  joinedText: string;
}

const HEADER_FIELDS = {
  排名: 'rank',
  玩家名称: 'playerName',
  等级: 'level',
  途径: 'path',
  非凡评分: 'score',
  风尚度: 'fashion',
  周活跃: 'weeklyActivity',
  入会时间: 'joinedText',
} as const;

type Field = (typeof HEADER_FIELDS)[keyof typeof HEADER_FIELDS];

const FIELD_LABEL: Record<Field, string> = {
  rank: '排名',
  playerName: '玩家名称',
  level: '等级',
  path: '途径',
  score: '非凡评分',
  fashion: '风尚度',
  weeklyActivity: '周活跃',
  joinedText: '入会时间',
};

const INT_FIELDS = new Set<Field>(['rank', 'level', 'score', 'fashion', 'weeklyActivity']);
const INT32_MAX = 2_147_483_647;
const TEXT_MAX = 40;
const MAX_ROWS = 1000;

export async function parseMemberTemplate(file: File): Promise<TemplateDraft[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('请选择 xlsx 模版');
  if (file.size > 10 * 1024 * 1024) throw new Error('模版不能超过 10MB');
  const workbook = new ExcelJS.Workbook();
  try {
    const buffer = await normalizeSpreadsheetXml(await file.arrayBuffer());
    await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
  } catch {
    throw new Error('模版无法读取');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('模版里没有工作表');

  let headerRow = 0;
  const columns = new Map<number, Field>();
  sheet.eachRow((row, rowNumber) => {
    if (headerRow || rowNumber > 20) return;
    const cells = rowCells(row);
    if (!cells.some((cell) => cell.text === '玩家名称')) return;
    headerRow = rowNumber;
    const seen = new Set<Field>();
    for (const cell of cells) {
      const field = HEADER_FIELDS[cell.text as keyof typeof HEADER_FIELDS];
      if (!field || seen.has(field)) continue;
      seen.add(field);
      columns.set(cell.column, field);
    }
  });
  if (!headerRow) throw new Error('模版缺少「玩家名称」列');
  if (![...columns.values()].includes('rank')) throw new Error('模版缺少「排名」列');

  const drafts: TemplateDraft[] = [];
  const seen = new Set<string>();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const draft = readDraft(row, columns);
    if (!draft) return;
    if (drafts.length >= MAX_ROWS) throw new Error('一次最多导入 1000 人');
    const key = draft.playerName.toLowerCase();
    if (seen.has(key)) throw new Error(`第 ${rowNumber} 行玩家名称重复`);
    seen.add(key);
    drafts.push(draft);
  });
  if (drafts.length === 0) throw new Error('没有人员');
  return drafts;
}

function readDraft(row: ExcelJS.Row, columns: Map<number, Field>): TemplateDraft | null {
  const values = new Map<Field, number | string | null>();
  let filled = false;
  for (const [column, field] of columns) {
    const raw = row.getCell(column).value;
    if (INT_FIELDS.has(field)) {
      const parsed = cellInt(raw);
      if (parsed === 'bad') throw new Error(`第 ${row.number} 行${FIELD_LABEL[field]}必须是整数`);
      const checked = checkInt(field, parsed, row.number);
      if (checked !== null && !(field === 'rank' && checked === 0)) filled = true;
      values.set(field, checked);
      continue;
    }
    const text = cellText(raw);
    if (text) filled = true;
    if (text.length > TEXT_MAX) throw new Error(`第 ${row.number} 行${FIELD_LABEL[field]}过长`);
    values.set(field, text);
  }
  const playerName = String(values.get('playerName') ?? '').trim();
  if (!playerName && !filled) return null;
  if (!playerName) throw new Error(`第 ${row.number} 行请填写玩家名称`);
  if (playerName.length > TEXT_MAX) throw new Error(`第 ${row.number} 行玩家名称过长`);
  return {
    playerName,
    rank: numberOrZero(values.get('rank')),
    level: numberOrNull(values.get('level')),
    path: String(values.get('path') ?? ''),
    score: numberOrNull(values.get('score')),
    fashion: numberOrNull(values.get('fashion')),
    weeklyActivity: numberOrNull(values.get('weeklyActivity')),
    joinedText: String(values.get('joinedText') ?? ''),
  };
}

function checkInt(field: Field, value: number | null, rowNumber: number): number | null {
  if (value === null) return field === 'rank' ? 0 : null;
  if (value > INT32_MAX) throw new Error(`第 ${rowNumber} 行${FIELD_LABEL[field]}超出范围`);
  if (field === 'rank' && value < 0) throw new Error(`第 ${rowNumber} 行排名不能为负`);
  if (field === 'level' && value < 1) throw new Error(`第 ${rowNumber} 行等级必须大于 0`);
  if (field !== 'rank' && field !== 'level' && value < 0) throw new Error(`第 ${rowNumber} 行${FIELD_LABEL[field]}不能为负`);
  return value;
}

function numberOrZero(value: number | string | null | undefined): number {
  return typeof value === 'number' ? value : 0;
}

function numberOrNull(value: number | string | null | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function rowCells(row: ExcelJS.Row): Array<{ column: number; text: string }> {
  const cells: Array<{ column: number; text: string }> = [];
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = cellText(cell.value);
    if (!text) return;
    cells.push({ column: colNumber, text });
  });
  return cells;
}

function cellInt(value: ExcelJS.CellValue): number | null | 'bad' {
  const raw = unwrap(value);
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : 'bad';
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return null;
    return /^-?\d+$/.test(text) ? Number(text) : 'bad';
  }
  return 'bad';
}

function cellText(value: ExcelJS.CellValue): string {
  const raw = unwrap(value);
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number') return String(raw).trim();
  if (typeof raw === 'boolean') return '';
  if (raw instanceof Date) {
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${raw.getFullYear()}-${pad(raw.getMonth() + 1)}-${pad(raw.getDate())}`;
  }
  if (typeof raw === 'object') {
    if ('richText' in raw && Array.isArray(raw.richText)) return raw.richText.map((part) => part.text).join('').trim();
    if ('text' in raw && typeof raw.text === 'string') return raw.text.trim();
  }
  return '';
}

function unwrap(value: ExcelJS.CellValue): ExcelJS.CellValue {
  if (value && typeof value === 'object' && 'result' in value) return unwrap(value.result as ExcelJS.CellValue);
  return value;
}
