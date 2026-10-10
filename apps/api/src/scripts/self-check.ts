import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { extractTable } from '../common/extract-table';
import { buildWorkbook } from '../exports/excel.service';
import { groundDraft } from '../ai/grounding';
import { applyOperations, planLocally } from '../ai/operations';
import { normalizePrice, normalizeQuantity, numberAppearsInText } from '../common/numbers';

const lines = [
  { text: '商品名称', confidence: 0.99, box: [[10, 10], [100, 10], [100, 30], [10, 30]] },
  { text: '单价', confidence: 0.99, box: [[140, 10], [200, 10], [200, 30], [140, 30]] },
  { text: '数量', confidence: 0.99, box: [[230, 10], [290, 10], [290, 30], [230, 30]] },
  { text: '单位', confidence: 0.99, box: [[320, 10], [380, 10], [380, 30], [320, 30]] },
  { text: '机械键盘', confidence: 0.96, box: [[10, 50], [120, 50], [120, 74], [10, 74]] },
  { text: '199.00', confidence: 0.42, box: [[140, 50], [210, 50], [210, 74], [140, 74]] },
  { text: '2', confidence: 0.91, box: [[230, 50], [260, 50], [260, 74], [230, 74]] },
  { text: '件', confidence: 0.95, box: [[320, 50], [350, 50], [350, 74], [320, 74]] },
  { text: '鼠标', confidence: 0.97, box: [[10, 90], [80, 90], [80, 112], [10, 112]] },
  { text: '89.00', confidence: 0.95, box: [[140, 90], [210, 90], [210, 112], [140, 112]] },
  { text: '3', confidence: 0.94, box: [[230, 90], [260, 90], [260, 112], [230, 112]] },
  { text: '个', confidence: 0.96, box: [[320, 90], [350, 90], [350, 112], [320, 112]] },
];

const table = extractTable(lines);
assert.equal(table.length, 2);
assert.equal(table[0].productName, '机械键盘');
assert.equal(table[0].price, '199.00');
assert.equal(table[0].quantity, '2');
assert.equal(table[0].unit, '件');
assert.ok(table[0].warnings.includes('低置信度，请人工确认'));
assert.equal(table[1].productName, '鼠标');
assert.equal(table[1].price, '89.00');
assert.equal(table[1].quantity, '3');

const loose = extractTable([
  { text: '机械键盘 199.00 2 件', confidence: 0.9 },
  { text: '只有名称', confidence: 0.88 },
]);
assert.equal(loose[0].price, '199.00');
assert.equal(loose[0].quantity, '2');
assert.equal(loose[1].price, null);
assert.equal(loose[1].quantity, null);

const ocrText = lines.map((line) => line.text).join('\n');
const grounded = groundDraft(
  {
    productName: '机械键盘',
    price: '12.00',
    quantity: '9',
    unit: '件',
    total: '108.00',
    sourceText: '机械键盘 12.00 9 件',
    warnings: [],
    confidence: 0.9,
    rawText: '机械键盘 12.00 9 件',
  },
  ocrText,
);
assert.equal(grounded.price, null);
assert.equal(grounded.quantity, null);
assert.equal(grounded.total, null);

const kept = groundDraft(table[0], ocrText);
assert.equal(kept.price, '199.00');
assert.equal(kept.quantity, '2');

assert.equal(numberAppearsInText('合计 199.50', '199'), false);
assert.equal(numberAppearsInText('合计 199.00', '199'), true);
assert.equal(normalizePrice('10'), '10.00');
assert.equal(normalizeQuantity('2.500'), '2.5');
assert.equal(normalizeQuantity('2.000'), '2');
assert.equal(normalizePrice('1000000001'), null);

const plan = planLocally('按单价从低到高排序，并计算总价');
const sorted = applyOperations(table, plan.operations);
assert.equal(sorted[0].productName, '鼠标');
assert.equal(sorted[0].total, '267.00');
assert.equal(sorted[1].total, '398.00');

const workbook = buildWorkbook([
  {
    productName: '=1+1',
    price: '10.00',
    quantity: null,
    unit: '-件',
    warnings: ['数量缺失，待确认'],
  },
]);
const opened = XLSX.read(workbook, { type: 'buffer' });
assert.deepEqual(opened.SheetNames, ['商品清单', '待确认']);
const sheet = opened.Sheets['商品清单'];
const nameCell = sheet.A2;
assert.equal(nameCell.t, 's');
assert.equal(nameCell.f, undefined);
assert.ok(String(nameCell.v).includes('1+1'));
const totalCell = sheet.E2;
assert.ok(totalCell === undefined || totalCell.v === undefined || totalCell.v === '' || totalCell.t !== 'n');

console.log('self-check ok');
