import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMemberTable, type OcrLine } from './parse-member-table';

function line(text: string, x: number, y: number, w = 80, h = 24): OcrLine {
  return {
    text,
    confidence: 0.99,
    box: [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
  };
}

const headerY = 100;
const header = [
  line('玩家名称', 200, headerY, 90),
  line('等级', 360, headerY, 50),
  line('途径', 460, headerY, 60),
  line('非凡评分', 560, headerY, 90),
  line('风尚度', 700, headerY, 70),
  line('周活跃', 820, headerY, 70),
  line('入会时间', 940, headerY, 80),
];

test('整理出排名在名称左侧的多行人员', () => {
  const rows = parseMemberTable([
    line('主页', 40, 20, 40),
    ...header,
    line('64', 30, 160, 40),
    line('奶得加钱', 200, 160, 100),
    line('70', 360, 160, 40),
    line('观众', 460, 160, 60),
    line('134398', 560, 160, 80),
    line('11810', 700, 160, 70),
    line('100', 820, 160, 40),
    line('26天', 940, 160, 50),
    line('1', 30, 220, 40),
    line('无忧十三郎', 200, 220, 110),
    line('70', 360, 220, 40),
    line('学徒', 460, 220, 60),
    line('185130', 560, 220, 80),
    line('339183', 700, 220, 80),
    line('95', 820, 220, 40),
    line('33天', 940, 220, 50),
  ]);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    playerName: '奶得加钱',
    rank: 1,
    level: 70,
    path: '观众',
    score: 134398,
    fashion: 11810,
    weeklyActivity: 100,
    joinedText: '26天',
  });
  assert.equal(rows[1].playerName, '无忧十三郎');
  assert.equal(rows[1].rank, 2);
  assert.equal(rows[1].score, 185130);
});

test('没有玩家名称的职位行会被丢弃', () => {
  const rows = parseMemberTable([
    ...header,
    line('2', 30, 160, 40),
    line('无忧赵子龙', 200, 160, 110),
    line('70', 360, 160, 40),
    line('二组组员', 250, 210, 80),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].playerName, '无忧赵子龙');
});

test('分组列不会写入入会时间或其他字段', () => {
  const rows = parseMemberTable([
    line('玩家名称', 200, headerY, 90),
    line('周活跃', 820, headerY, 70),
    line('分组', 940, headerY, 50),
    line('入会时间', 1060, headerY, 80),
    line('奶得加钱', 200, 160, 100),
    line('100', 820, 160, 40),
    line('二组', 940, 160, 50),
    line('26天', 1060, 160, 50),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].weeklyActivity, 100);
  assert.equal(rows[0].joinedText, '26天');
});

test('找不到表头时不产出人员', () => {
  const rows = parseMemberTable([line('主页', 20, 20), line('64', 20, 80), line('奶得加钱', 200, 80)]);
  assert.deepEqual(rows, []);
});

test('相邻数字不会被拼成超出整数范围的评分', () => {
  const rows = parseMemberTable([
    line('玩家名称', 200, headerY, 90),
    line('非凡评分', 560, headerY, 90),
    line('64', 30, 160, 40),
    line('奶得加钱', 200, 160, 100),
    line('134398', 560, 160, 80),
    line('11810', 700, 160, 70),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].score, 134398);
});

test('单个超出 32 位整数的评分留空', () => {
  const rows = parseMemberTable([
    ...header,
    line('64', 30, 160, 40),
    line('奶得加钱', 200, 160, 100),
    line('13439811810', 560, 160, 140),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].playerName, '奶得加钱');
  assert.equal(rows[0].score, null);
});

test('缺少评分时仍保留同时具备名称和排名的行', () => {
  const rows = parseMemberTable([
    ...header,
    line('3', 30, 160, 40),
    line('无忧霜眸', 200, 160, 100),
    line('70', 360, 160, 40),
    line('窃梭人', 460, 160, 70),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].playerName, '无忧霜眸');
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].level, 70);
  assert.equal(rows[0].path, '窃梭人');
  assert.equal(rows[0].score, null);
  assert.equal(rows[0].joinedText, null);
});

test('表头被拆开或末字认错时仍能对上风尚度和入会时间', () => {
  const rows = parseMemberTable([
    line('玩家名称', 200, headerY, 90),
    line('风尚', 700, headerY, 46),
    line('度', 748, headerY, 22),
    line('入会时问', 940, headerY, 80),
    line('64', 30, 160, 40),
    line('奶得加钱', 200, 160, 100),
    line('11810', 700, 160, 70),
    line('26天', 940, 160, 50),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fashion, 11810);
  assert.equal(rows[0].joinedText, '26天');
});

test('列标题带排序图标撑宽时，短数字和入会时间不会被分到左边那一列', () => {
  const rows = parseMemberTable([
    line('玩家名称', 200, headerY, 90),
    line('非凡评分', 560, headerY, 90),
    line('风尚度', 700, headerY, 220),
    line('周活跃', 960, headerY, 70),
    line('入会时间', 1100, headerY, 200),
    line('64', 30, 160, 40),
    line('奶得加钱', 200, 160, 100),
    line('134398', 560, 160, 80),
    line('11810', 665, 160, 50),
    line('100', 960, 160, 40),
    line('二组', 1120, 160, 40),
    line('2天', 1052, 160, 36),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].score, 134398);
  assert.equal(rows[0].fashion, 11810);
  assert.equal(rows[0].weeklyActivity, 100);
  assert.equal(rows[0].joinedText, '2天');
});
