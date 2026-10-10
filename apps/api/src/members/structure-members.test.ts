import assert from 'node:assert/strict';
import test from 'node:test';
import { fillMissingFields, groundMemberRows, uniqueByName } from './structure-members';
import type { ParsedMember } from './parse-member-table';

const lines = [
  { text: '玩家名称' },
  { text: '64' },
  { text: '奶得加钱' },
  { text: '70' },
  { text: '观众' },
  { text: '134398' },
  { text: '11810' },
  { text: '100' },
  { text: '26天' },
];

test('保留原文里出现过的人员字段', () => {
  const rows = groundMemberRows(
    {
      rows: [
        {
          playerName: '奶得加钱',
          rank: 64,
          level: 70,
          path: '观众',
          score: 134398,
          fashion: 11810,
          weeklyActivity: 100,
          joinedText: '26天',
        },
      ],
    },
    lines,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].playerName, '奶得加钱');
  assert.equal(rows[0].rank, 64);
  assert.equal(rows[0].score, 134398);
  assert.equal(rows[0].joinedText, '26天');
});

test('原文没有的分数和名称不会入库', () => {
  const rows = groundMemberRows(
    {
      rows: [
        { playerName: '奶得加钱', rank: 64, score: 999999 },
        { playerName: '虚构玩家', rank: 2, score: 70 },
      ],
    },
    lines,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].playerName, '奶得加钱');
  assert.equal(rows[0].score, null);
});

test('模型漏掉的风尚度和入会时间用坐标结果补回', () => {
  const ai = member('奶得加钱', 64);
  const coordinate = { ...member('奶得加钱', 64), fashion: 11810, joinedText: '26天', score: 134398 };
  const rows = fillMissingFields([ai], [coordinate]);
  assert.equal(rows[0].fashion, 11810);
  assert.equal(rows[0].joinedText, '26天');
  assert.equal(rows[0].score, 134398);
});

test('同名人员只保留先出现的一条', () => {
  const first = member('奶得加钱', 64);
  const second = member('奶得加钱', 3);
  const rows = uniqueByName([first, second, member('无忧十三郎', 1)]);
  assert.deepEqual(rows.map((row) => row.rank), [64, 1]);
});

function member(playerName: string, rank: number): ParsedMember {
  return {
    playerName,
    rank,
    level: null,
    path: null,
    score: null,
    fashion: null,
    weeklyActivity: null,
    joinedText: null,
  };
}
