import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { asExcelText, multiplyMoney } from '../common/numbers';

export interface ExcelProduct {
  productName: string;
  price: string | null;
  quantity: string | null;
  unit: string | null;
  warnings: string[];
}

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function moneyCell(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildSheet(rows: (string | number | null)[][], widths: number[]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    for (const column of [1, 4]) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && cell.t === 'n') cell.z = '0.00';
    }
    const quantity = sheet[XLSX.utils.encode_cell({ r: row, c: 2 })];
    if (quantity && quantity.t === 'n') quantity.z = '0.000';
  }
  return sheet;
}

export function buildWorkbook(products: ExcelProduct[]): Buffer {
  const header = ['商品名称', '单价', '数量', '单位', '总价'];
  const body = products.map((product) => {
    const total = multiplyMoney(product.price, product.quantity);
    return [
      asExcelText(product.productName),
      moneyCell(product.price),
      moneyCell(product.quantity),
      asExcelText(product.unit ?? ''),
      moneyCell(total),
    ];
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet([header, ...body], [28, 14, 12, 10, 14]),
    '商品清单',
  );

  const review = products.filter(
    (product) => product.warnings.length > 0 || product.price === null || product.quantity === null,
  );
  if (review.length > 0) {
    const reviewRows = review.map((product) => {
      const total = multiplyMoney(product.price, product.quantity);
      return [
        asExcelText(product.productName),
        moneyCell(product.price),
        moneyCell(product.quantity),
        asExcelText(product.unit ?? ''),
        moneyCell(total),
        asExcelText(product.warnings.join('；')),
      ];
    });
    XLSX.utils.book_append_sheet(
      workbook,
      buildSheet([[...header, '提示'], ...reviewRows], [28, 14, 12, 10, 14, 36]),
      '待确认',
    );
  }

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

export { MIME as EXCEL_MIME };

@Injectable()
export class ExcelService {
  generate(products: ExcelProduct[]): Buffer {
    return buildWorkbook(products);
  }
}
