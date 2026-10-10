import {
  extractNumberTokens,
  normalizePrice,
  normalizeQuantity,
} from './numbers';

export const LOW_CONFIDENCE = 0.8;

export interface OcrLineInput {
  text: string;
  confidence: number;
  box?: number[][];
}

export interface DraftRow {
  productName: string;
  price: string | null;
  quantity: string | null;
  unit: string | null;
  total: string | null;
  sourceText: string;
  warnings: string[];
  confidence: number | null;
  rawText: string | null;
}

type Field = 'productName' | 'price' | 'quantity' | 'unit';

interface Cell {
  text: string;
  confidence: number;
  x: number;
  y: number;
  height: number;
  positioned: boolean;
}

const LINE_PATTERN =
  /^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s*([\u4e00-\u9fffA-Za-z]{1,8}))?$/;

function pushWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning) && warnings.length < 20) {
    warnings.push(warning.slice(0, 200));
  }
}

function headerKey(text: string): Field | null {
  const value = text.replace(/\s/g, '');
  if (!value || value.length > 12) return null;
  if (/^(商品名称|品名|货品名称|物料名称|商品名|名称|商品|货品)$/.test(value)) {
    return 'productName';
  }
  if (/^(单价|价格|售价)$/.test(value)) return 'price';
  if (/^(数量|件数)$/.test(value)) return 'quantity';
  if (value === '单位') return 'unit';
  return null;
}

function toCell(line: OcrLineInput, index: number): Cell | null {
  const text = line.text.trim();
  if (!text) return null;
  const positioned = Array.isArray(line.box) && line.box.length >= 4;
  if (!positioned) {
    return {
      text,
      confidence: line.confidence,
      x: index,
      y: index,
      height: 20,
      positioned: false,
    };
  }
  const xs = line.box!.map((point) => point[0]);
  const ys = line.box!.map((point) => point[1]);
  return {
    text,
    confidence: line.confidence,
    x: xs.reduce((sum, value) => sum + value, 0) / xs.length,
    y: ys.reduce((sum, value) => sum + value, 0) / ys.length,
    height: Math.max(8, Math.max(...ys) - Math.min(...ys)),
    positioned: true,
  };
}

export function groupRows(lines: OcrLineInput[]): Cell[][] {
  const cells = lines
    .map((line, index) => toCell(line, index))
    .filter((cell): cell is Cell => cell !== null);
  if (cells.length === 0) return [];
  if (cells.some((cell) => !cell.positioned)) {
    return cells.map((cell) => [cell]);
  }

  const ordered = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
  const heights = ordered.map((cell) => cell.height).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] ?? 20;
  const threshold = Math.max(12, median * 0.7);
  const rows: Cell[][] = [];

  for (const cell of ordered) {
    const last = rows[rows.length - 1];
    const anchor = last
      ? last.reduce((sum, item) => sum + item.y, 0) / last.length
      : 0;
    if (!last || Math.abs(cell.y - anchor) > threshold) {
      rows.push([cell]);
    } else {
      last.push(cell);
    }
  }

  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows;
}

function isHeaderLine(text: string): boolean {
  const keys = text
    .split(/\s+/)
    .map((part) => headerKey(part))
    .filter((key) => key !== null);
  return new Set(keys).size >= 2;
}

function findHeader(rows: Cell[][]): { index: number; columns: { key: Field; x: number }[] } | null {
  const limit = Math.min(rows.length, 3);
  for (let index = 0; index < limit; index += 1) {
    const columns = rows[index]
      .map((cell) => ({ key: headerKey(cell.text), x: cell.x }))
      .filter((item): item is { key: Field; x: number } => item.key !== null);
    const keys = new Set(columns.map((column) => column.key));
    if (keys.size >= 2 && keys.has('productName') && (keys.has('price') || keys.has('quantity'))) {
      return { index, columns };
    }
  }
  return null;
}

function nearestColumn(x: number, columns: { key: Field; x: number }[]): Field | null {
  const sorted = [...columns].sort((a, b) => a.x - b.x);
  let bestIndex = 0;
  let bestDistance = Math.abs(x - sorted[0].x);
  for (let index = 1; index < sorted.length; index += 1) {
    const distance = Math.abs(x - sorted[index].x);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  const leftGap = bestIndex > 0 ? sorted[bestIndex].x - sorted[bestIndex - 1].x : Number.POSITIVE_INFINITY;
  const rightGap =
    bestIndex < sorted.length - 1
      ? sorted[bestIndex + 1].x - sorted[bestIndex].x
      : Number.POSITIVE_INFINITY;
  const limit = Math.max(36, Math.min(leftGap, rightGap) / 2);
  if (bestDistance > limit) return null;
  return sorted[bestIndex].key;
}

function singleNumber(text: string): { value: string | null; ambiguous: boolean } {
  const tokens = extractNumberTokens(text);
  if (tokens.length === 0) return { value: null, ambiguous: false };
  if (tokens.length > 1) return { value: null, ambiguous: true };
  return { value: tokens[0], ambiguous: false };
}

function confidenceOf(cells: Cell[]): number | null {
  if (cells.length === 0) return null;
  return Math.min(...cells.map((cell) => cell.confidence));
}

function blankRow(partial: Omit<DraftRow, 'total' | 'warnings'> & { warnings?: string[] }): DraftRow {
  const warnings = partial.warnings ?? [];
  if (partial.confidence !== null && partial.confidence < LOW_CONFIDENCE) {
    pushWarning(warnings, '低置信度，请人工确认');
  }
  return {
    productName: partial.productName.slice(0, 300),
    price: partial.price,
    quantity: partial.quantity,
    unit: partial.unit ? partial.unit.slice(0, 30) : null,
    total: null,
    sourceText: partial.sourceText.slice(0, 2000),
    warnings,
    confidence: partial.confidence,
    rawText: partial.rawText?.slice(0, 2000) ?? null,
  };
}

function fromMappedRow(row: Cell[], columns: { key: Field; x: number }[]): DraftRow | null {
  const buckets: Record<Field, Cell[]> = {
    productName: [],
    price: [],
    quantity: [],
    unit: [],
  };
  for (const cell of row) {
    const key = nearestColumn(cell.x, columns);
    if (key) buckets[key].push(cell);
  }

  const productName = buckets.productName.map((cell) => cell.text).join('').trim();
  if (!productName || headerKey(productName)) return null;

  const warnings: string[] = [];
  const priceToken = singleNumber(buckets.price.map((cell) => cell.text).join(' '));
  const quantityToken = singleNumber(buckets.quantity.map((cell) => cell.text).join(' '));
  let price = priceToken.value === null ? null : normalizePrice(priceToken.value);
  let quantity = quantityToken.value === null ? null : normalizeQuantity(quantityToken.value);

  if (priceToken.ambiguous) {
    price = null;
    pushWarning(warnings, '价格列包含多个数字，未自动填入');
  } else if (priceToken.value !== null && price === null) {
    pushWarning(warnings, '价格超出允许范围');
  }
  if (quantityToken.ambiguous) {
    quantity = null;
    pushWarning(warnings, '数量列包含多个数字，未自动填入');
  } else if (quantityToken.value !== null && quantity === null) {
    pushWarning(warnings, '数量超出允许范围');
  }
  if (buckets.price.length === 0) pushWarning(warnings, '未识别到单价');
  if (buckets.quantity.length === 0) pushWarning(warnings, '未识别到数量');

  const used = [...buckets.productName, ...buckets.price, ...buckets.quantity, ...buckets.unit];
  return blankRow({
    productName,
    price,
    quantity,
    unit: buckets.unit.map((cell) => cell.text).join('').trim() || null,
    sourceText: row.map((cell) => cell.text).join(' '),
    warnings,
    confidence: confidenceOf(used.length ? used : row),
    rawText: row.map((cell) => cell.text).join(' '),
  });
}

function fromLooseRow(row: Cell[]): DraftRow | null {
  const text = row.map((cell) => cell.text).join(' ').trim();
  if (!text || isHeaderLine(text)) return null;
  if (row.length === 1) {
    const matched = text.match(LINE_PATTERN);
    if (matched && /[\u4e00-\u9fffA-Za-z]/.test(matched[1]) && !headerKey(matched[1].trim())) {
      const price = normalizePrice(matched[2]);
      const quantity = normalizeQuantity(matched[3]);
      const warnings = ['按单行“名称 单价 数量”顺序解读，请核对'];
      if (price === null) pushWarning(warnings, '价格超出允许范围');
      if (quantity === null) pushWarning(warnings, '数量超出允许范围');
      return blankRow({
        productName: matched[1].trim(),
        price,
        quantity,
        unit: matched[4]?.trim() || null,
        sourceText: text,
        warnings,
        confidence: confidenceOf(row),
        rawText: text,
      });
    }
  }

  return blankRow({
    productName: text.slice(0, 300),
    price: null,
    quantity: null,
    unit: null,
    sourceText: text,
    warnings: ['未识别到可靠表头，价格和数量未自动填入'],
    confidence: confidenceOf(row),
    rawText: text,
  });
}

export function extractTable(lines: OcrLineInput[]): DraftRow[] {
  const rows = groupRows(lines);
  if (rows.length === 0) return [];
  const header = rows.every((row) => row.every((cell) => cell.positioned))
    ? findHeader(rows)
    : null;

  const drafts: DraftRow[] = [];
  rows.forEach((row, index) => {
    if (header && index === header.index) return;
    const draft = header ? fromMappedRow(row, header.columns) : fromLooseRow(row);
    if (draft) drafts.push(draft);
  });
  return drafts;
}

export function tableToTsv(lines: OcrLineInput[]): string {
  return groupRows(lines)
    .map((row) => row.map((cell) => cell.text).join('\t'))
    .join('\n');
}
