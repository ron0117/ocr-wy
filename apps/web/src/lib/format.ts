import type { TaskStatus } from '@ocr/shared-types';

export function statusTagType(status: TaskStatus): 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'COMPLETED' || status === 'OCR_COMPLETED') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'UPLOADED') return 'info';
  return 'warning';
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function previewTotal(price: string | null, quantity: string | null): string {
  if (!price || !quantity) return '';
  if (!/^\d+(?:\.\d+)?$/.test(price) || !/^\d+(?:\.\d+)?$/.test(quantity)) return '';
  const scaled = (value: string, scale: number) => {
    const [whole, fraction = ''] = value.split('.');
    return BigInt((whole + fraction.padEnd(scale, '0').slice(0, scale)).replace(/^0+(?=\d)/, '') || '0');
  };
  const product = scaled(price, 2) * scaled(quantity, 3);
  const rounded = (product + 500n) / 1000n;
  const text = rounded.toString().padStart(3, '0');
  return `${text.slice(0, -2)}.${text.slice(-2)}`;
}

const RESOURCE_LABEL: Record<string, string> = {
  SOURCE_IMAGE: '原图',
  OCR_JSON: 'OCR 原文',
  STRUCTURED_JSON: '整理结果',
  EXCEL: 'Excel',
};

export function resourceLabel(type: string): string {
  return RESOURCE_LABEL[type] ?? type;
}
