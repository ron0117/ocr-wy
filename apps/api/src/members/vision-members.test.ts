import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanVisionRows, mergeVisionRows, type VisionMemberRow } from './vision-members';

function row(partial: Partial<VisionMemberRow> & { playerName: string }): VisionMemberRow {
  return {
    playerName: partial.playerName,
    level: partial.level ?? null,
    path: partial.path ?? null,
    score: partial.score ?? null,
    fashion: partial.fashion ?? null,
    weeklyActivity: partial.weeklyActivity ?? null,
    joinedText: partial.joinedText ?? null,
  };
}

test('丢掉空名称，等级 0 变空，评分 0 保留，忽略排名', () => {
  const rows = cleanVisionRows({
    rows: [
      { playerName: '  ', level: 1, score: 1 },
      { playerName: '甲', level: 0, score: 0, rank: 9 },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].playerName, '甲');
  assert.equal(rows[0].level, null);
  assert.equal(rows[0].score, 0);
  assert.equal('rank' in rows[0], false);
});

test('大小写和空格合并时保留字段更多的一条，不同名字都留下', () => {
  const merged = mergeVisionRows([
    [row({ playerName: '张三', level: 1 })],
    [
      row({ playerName: ' 张三 ', level: 2, path: '观众', score: 3 }),
      row({ playerName: '李四' }),
    ],
  ]);
  assert.deepEqual(
    merged.map((item) => item.playerName),
    ['张三', '李四'],
  );
  assert.equal(merged[0].level, 2);
  assert.equal(merged[0].path, '观众');
  assert.equal(merged[0].score, 3);
});

test('完整度相同时保留更早上传的图', () => {
  const merged = mergeVisionRows([
    [row({ playerName: '张三', level: 1, joinedText: '1天' })],
    [row({ playerName: '张三', level: 9, joinedText: '2天' })],
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].level, 1);
  assert.equal(merged[0].joinedText, '1天');
});
