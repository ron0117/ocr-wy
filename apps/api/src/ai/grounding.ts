import type { DraftRow } from '../common/extract-table';
import {
  normalizePrice,
  normalizeQuantity,
  numberAppearsInText,
} from '../common/numbers';

function pushWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning) && warnings.length < 20) {
    warnings.push(warning.slice(0, 200));
  }
}

function compact(value: string): string {
  return value.replace(/\s+/g, '');
}

function sourceAligns(source: string, ocrText: string): boolean {
  const compactOcr = compact(ocrText);
  const parts = source.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) return false;
  return parts.every((part) => compactOcr.includes(compact(part)));
}

export function groundDraft(draft: DraftRow, ocrText: string): DraftRow {
  const warnings = [...draft.warnings];
  const source = (draft.sourceText ?? '').slice(0, 2000);
  const aligned = sourceAligns(source, ocrText);
  let price = draft.price;
  let quantity = draft.quantity;

  if (!aligned) {
    if (price !== null || quantity !== null) {
      pushWarning(warnings, '原文依据无法与 OCR 对齐，数值已清空');
    }
    price = null;
    quantity = null;
  } else {
    if (price !== null && !numberAppearsInText(source, price)) {
      price = null;
      pushWarning(warnings, '价格未在原文依据中找到，已清空');
    }
    if (quantity !== null && !numberAppearsInText(source, quantity)) {
      quantity = null;
      pushWarning(warnings, '数量未在原文依据中找到，已清空');
    }
  }

  if (price !== null) {
    const normalized = normalizePrice(price);
    if (normalized === null) {
      price = null;
      pushWarning(warnings, '价格超出允许范围');
    } else {
      price = normalized;
    }
  }
  if (quantity !== null) {
    const normalized = normalizeQuantity(quantity);
    if (normalized === null) {
      quantity = null;
      pushWarning(warnings, '数量超出允许范围');
    } else {
      quantity = normalized;
    }
  }

  const name = draft.productName.trim();
  if (!name) pushWarning(warnings, '商品名称不能为空');
  if (name && !compact(ocrText).includes(compact(name))) {
    pushWarning(warnings, '商品名称无法在 OCR 原文中定位，请人工确认');
  }

  return {
    ...draft,
    productName: name.slice(0, 300),
    price,
    quantity,
    unit: draft.unit?.trim().slice(0, 30) || null,
    total: null,
    sourceText: source,
    warnings,
    rawText: draft.rawText,
  };
}
