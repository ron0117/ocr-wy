import Decimal from 'decimal.js';
import type { DraftRow } from '../common/extract-table';
import { multiplyMoney } from '../common/numbers';
import type { ChatOperation, ChatPlan } from './schemas/product.schema';

const FIELD_LABEL = {
  price: '价格',
  quantity: '数量',
  productName: '商品名称',
} as const;

function pushWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning) && warnings.length < 20) warnings.push(warning);
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, 'zh');
}

function compareDecimal(left: string | null, right: string | null, direction: 'asc' | 'desc'): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const base = new Decimal(left).cmp(new Decimal(right));
  return direction === 'asc' ? base : -base;
}

export function applyOperations(rows: DraftRow[], operations: ChatOperation[]): DraftRow[] {
  let current = rows.map((row) => ({ ...row, warnings: [...row.warnings] }));
  for (const operation of operations) {
    if (operation.type === 'extract_from_ocr') continue;
    if (operation.type === 'sort') {
      current = [...current].sort((left, right) => {
        if (operation.field === 'productName') {
          const base = compareText(left.productName, right.productName);
          return operation.direction === 'asc' ? base : -base;
        }
        return compareDecimal(left[operation.field], right[operation.field], operation.direction);
      });
    }
    if (operation.type === 'calculate') {
      current = current.map((row) => ({
        ...row,
        total: multiplyMoney(row.price, row.quantity),
      }));
    }
    if (operation.type === 'flag_missing') {
      const label = FIELD_LABEL[operation.field];
      current = current.map((row) => {
        const missing =
          operation.field === 'productName'
            ? row.productName.trim().length === 0
            : row[operation.field] === null;
        if (!missing) return row;
        const warnings = [...row.warnings];
        pushWarning(warnings, `${label}缺失，待确认`);
        return { ...row, warnings };
      });
    }
  }
  return current;
}

export function planLocally(message: string): ChatPlan {
  const operations: ChatOperation[] = [];
  const notes: string[] = [];

  if (/提取|整理|识别|生成表格|做成表/.test(message)) {
    operations.push({ type: 'extract_from_ocr' });
    notes.push('已根据 OCR 原文做保守提取');
  }
  if (/总价|合计金额|单价乘|乘以数量/.test(message)) {
    operations.push({
      type: 'calculate',
      field: 'total',
      expression: 'price * quantity',
    });
    notes.push('已计算总价');
  }
  if (/从低到高|价格升序|单价升序|便宜/.test(message)) {
    operations.push({ type: 'sort', field: 'price', direction: 'asc' });
    notes.push('已按价格从低到高排序');
  } else if (/从高到低|价格降序|单价降序|贵的/.test(message)) {
    operations.push({ type: 'sort', field: 'price', direction: 'desc' });
    notes.push('已按价格从高到低排序');
  }
  if (/按名称|名称排序/.test(message)) {
    operations.push({ type: 'sort', field: 'productName', direction: 'asc' });
    notes.push('已按商品名称排序');
  }
  if (/数量缺失|没有数量|数量为空/.test(message)) {
    operations.push({ type: 'flag_missing', field: 'quantity' });
    notes.push('已标记数量缺失的商品');
  }
  if (/价格缺失|没有价格|价格为空|单价为空/.test(message)) {
    operations.push({ type: 'flag_missing', field: 'price' });
    notes.push('已标记价格缺失的商品');
  }

  if (operations.length === 0) {
    return {
      message:
        '当前未配置外部模型，只能执行这些整理：提取表格、按价格或名称排序、计算总价、标记缺失的价格或数量。',
      operations: [],
    };
  }

  return {
    message: `${notes.join('，')}。空值和低置信度需要人工确认。`,
    operations,
  };
}
