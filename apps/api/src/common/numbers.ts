import Decimal from 'decimal.js';

const PRICE_MAX = new Decimal('1000000000');
const QTY_MAX = new Decimal('1000000000');

export function decimalEq(left: string, right: string): boolean {
  try {
    return new Decimal(left).eq(new Decimal(right));
  } catch {
    return false;
  }
}

export function extractNumberTokens(text: string): string[] {
  return text.replace(/[，,]/g, '').match(/\d+(?:\.\d+)?/g) ?? [];
}

export function numberAppearsInText(text: string, value: string | null): boolean {
  if (value === null) return true;
  return extractNumberTokens(text).some((token) => decimalEq(token, value));
}

export function normalizePrice(value: string): string | null {
  try {
    const price = new Decimal(value);
    if (!price.isFinite() || price.lt(0) || price.gt(PRICE_MAX)) return null;
    return price.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  } catch {
    return null;
  }
}

export function normalizeQuantity(value: string): string | null {
  try {
    const quantity = new Decimal(value);
    if (!quantity.isFinite() || quantity.lt(0) || quantity.gt(QTY_MAX)) return null;
    const fixed = quantity.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toFixed(3);
    return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  } catch {
    return null;
  }
}

export function multiplyMoney(price: string | null, quantity: string | null): string | null {
  if (price === null || quantity === null) return null;
  try {
    return new Decimal(price)
      .mul(new Decimal(quantity))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toFixed(2);
  } catch {
    return null;
  }
}

export function asExcelText(value: string): string {
  if (value.length === 0) return '';
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}
