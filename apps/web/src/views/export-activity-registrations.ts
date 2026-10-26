import ExcelJS from 'exceljs';
import type { RegistrationRowItem } from '../api/client';

const COLUMNS = ['俱乐部', '非凡者名称', '当前最高评分', '职业', '出席状态', '报名时间'] as const;
const WIDTHS = [16, 18, 14, 12, 12, 20];
const LAST_COL = COLUMNS.length;

const thin = { style: 'thin' as const, color: { argb: 'FFD5DDE8' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

export async function downloadRegistrationWorkbook(
  rows: RegistrationRowItem[],
  filter: { activityTitle: string; clubName: string },
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '无忧俱乐部';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('活动报名', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  sheet.columns = WIDTHS.map((width) => ({ width }));

  sheet.mergeCells(1, 1, 1, LAST_COL);
  const title = sheet.getCell(1, 1);
  title.value = '活动报名';
  title.font = { name: '微软雅黑', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = solid('FF1B3A4B');
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 34;
  paintRow(sheet, 1, solid('FF1B3A4B'));

  const exportedAt = new Date();
  sheet.mergeCells(2, 1, 2, LAST_COL);
  const summary = sheet.getCell(2, 1);
  summary.value = `活动：${filter.activityTitle}    俱乐部：${filter.clubName}    共 ${rows.length} 人    导出时间：${formatTime(exportedAt)}`;
  summary.font = { name: '微软雅黑', size: 10, color: { argb: 'FF5C6B7A' } };
  summary.fill = solid('FFF4F7FB');
  summary.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 22;
  paintRow(sheet, 2, solid('FFF4F7FB'));

  sheet.getRow(3).height = 10;

  const header = sheet.getRow(4);
  header.height = 24;
  COLUMNS.forEach((label, index) => {
    const cell = header.getCell(index + 1);
    cell.value = label;
    cell.font = { name: '微软雅黑', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = solid('FF245C78');
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = border;
  });
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: LAST_COL } };

  rows.forEach((row, index) => {
    const line = sheet.getRow(index + 5);
    line.height = 22;
    const stripe = index % 2 === 1;
    const values = [
      row.clubName,
      row.playerName,
      row.score,
      row.professionLabel,
      row.statusLabel,
      formatTime(new Date(row.createdAt)),
    ];
    values.forEach((value, column) => {
      const cell = line.getCell(column + 1);
      cell.value = value;
      cell.font = { name: '微软雅黑', size: 11, color: { argb: 'FF243140' } };
      cell.fill = solid(stripe ? 'FFF7F9FC' : 'FFFFFFFF');
      cell.alignment = {
        vertical: 'middle',
        horizontal: column === 1 ? 'left' : 'center',
        indent: column === 1 ? 1 : 0,
      };
      cell.border = border;
      if (typeof value === 'number') cell.numFmt = '#,##0';
    });
  });

  sheet.headerFooter.oddFooter = '&L当前筛选结果&R第 &P 页 / 共 &N 页';
  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileName(filter.activityTitle, exportedAt),
  );
}

function solid(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function paintRow(sheet: ExcelJS.Worksheet, row: number, fill: ExcelJS.Fill) {
  for (let column = 1; column <= LAST_COL; column += 1) {
    sheet.getCell(row, column).fill = fill;
  }
}

function formatTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fileName(activityTitle: string, date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  const title = activityTitle.replace(/[\\/:*?"<>|]/g, '').trim() || '活动';
  return `活动报名_${title}_${stamp}.xlsx`;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
