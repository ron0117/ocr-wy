export type ScheduleRow = {
  date: string;
  weekday: string;
  activities: string[];
  time: string;
};

export type ScheduleWeek = {
  title: string;
  partial?: boolean;
  rows: ScheduleRow[];
};

export type ScheduleNotice = {
  at: string;
  phase: string;
  exact?: boolean;
};

export type ScheduleRule = {
  name: string;
  detail: string;
  notices: ScheduleNotice[];
};

type StartPoint = {
  activity: string;
  phase: string;
  at: string;
  exact?: boolean;
};

const focusDays = new Set(['星期三', '星期四', '星期五', '星期六', '星期天']);
const clockPattern = /(\d{1,2}:\d{2})/g;
const huntTime = '全天开放，高倍 19:00—20:00';
const weekendHuntTime = '高倍 12:00—18:00、20:00—22:00';
const dragonTime = '20:00—20:45，20:01 刷龙';
const strategicDragonTime = '19:50 开线，20:01 刷龙';

export const scheduleRules: ScheduleRule[] = [
  {
    name: '终末猎杀',
    detail: '周一至周三高倍 19:00—20:00；周五、周日高倍 12:00—18:00、20:00—22:00。',
    notices: [
      { at: '12:00', phase: '周五、周日第一场高倍' },
      { at: '20:00', phase: '周五、周日第二场高倍' },
    ],
  },
  {
    name: '巨龙讨伐',
    detail: '周五、周日 20:00—20:45，20:01 刷新巨龙投影。',
    notices: [{ at: '20:00', phase: '开始' }],
  },
  {
    name: '战略服巨龙讨伐',
    detail:
      '周四、周六 19:50 开线，20:01 刷龙。战略服关闭主动召唤，战功只在讨伐期间击杀敌对时获得。',
    notices: [{ at: '19:50', phase: '开线' }],
  },
  {
    name: '霜陨领主',
    detail: '周四 20:45—21:20。',
    notices: [{ at: '20:45', phase: '开始' }],
  },
  {
    name: '拍卖高原战',
    detail:
      '后 3 个周三（11 月 18 日、11 月 25 日、12 月 2 日）20:45—21:20。非消极参赛达到 20 人开启拍卖，全俱乐部可竞拍，分红只给实际参赛者。',
    notices: [{ at: '20:45', phase: '开始' }],
  },
  {
    name: '势力战（猎城战）',
    detail: '四个周六（11 月 14 日、11 月 21 日、11 月 28 日、12 月 5 日）20:45 开启。',
    notices: [{ at: '20:45', phase: '开始' }],
  },
  {
    name: '征服宣令',
    detail: '周日两场 20:45—21:10、21:15—21:40。结算增加建筑伤害。胜者宣言大会 22:00。',
    notices: [
      { at: '20:45', phase: '第一场' },
      { at: '21:15', phase: '第二场' },
    ],
  },
  {
    name: '周排名结算',
    detail: '每周日 21:00。',
    notices: [{ at: '21:00', phase: '结算' }],
  },
  {
    name: '人员与拍卖',
    detail:
      '每周加入、退出各限 5 人。每晚 19:00—22:30 不能变更成员，玩法期间不能变更职位。退出战略服俱乐部后 7 天内不能参加战略服拍卖。',
    notices: [],
  },
];

function dayLabel(md: string) {
  const [month, day] = md.split('.').map(Number);
  return `${month} 月 ${day} 日`;
}

function row(md: string, weekday: string, activities: string[], time: string): ScheduleRow {
  return { date: dayLabel(md), weekday, activities, time };
}

function standardWeek(title: string, dates: string[]): ScheduleWeek {
  const [mon, tue, wed, thu, fri, sat, sun] = dates;
  return {
    title,
    rows: [
      row(mon, '星期一', ['终末猎杀'], huntTime),
      row(tue, '星期二', ['终末猎杀'], huntTime),
      row(wed, '星期三', ['终末猎杀', '拍卖高原战'], `${huntTime}；拍卖高原战：20:45—21:20`),
      row(thu, '星期四', ['战略服巨龙讨伐', '霜陨领主'], `战略服巨龙讨伐：${strategicDragonTime}；霜陨领主：20:45—21:20`),
      row(fri, '星期五', ['终末猎杀', '巨龙讨伐'], `终末猎杀：${weekendHuntTime}；巨龙讨伐：${dragonTime}`),
      row(sat, '星期六', ['战略服巨龙讨伐', '势力战（猎城战）'], `战略服巨龙讨伐：${strategicDragonTime}；势力战：20:45`),
      row(sun, '星期天', ['终末猎杀', '巨龙讨伐', '征服宣令', '周排名结算'], `终末猎杀：${weekendHuntTime}；巨龙讨伐：${dragonTime}；征服宣令：20:45—21:10、21:15—21:40；周排名结算：21:00`),
    ],
  };
}

export const scheduleWeeks: ScheduleWeek[] = [
  {
    title: '第一周：11 月 12 日开服（11 月 9 日 — 11 月 15 日）',
    rows: [
      row('11.09', '星期一', [], '暂无活动'),
      row('11.10', '星期二', [], '暂无活动'),
      row('11.11', '星期三', [], '暂无活动'),
      row('11.12', '星期四', ['战略服巨龙讨伐', '霜陨领主'], `战略服巨龙讨伐：${strategicDragonTime}；霜陨领主：20:45—21:20`),
      row('11.13', '星期五', ['终末猎杀', '巨龙讨伐'], `终末猎杀：${weekendHuntTime}；巨龙讨伐：${dragonTime}`),
      row('11.14', '星期六', ['战略服巨龙讨伐', '势力战（猎城战）'], `战略服巨龙讨伐：${strategicDragonTime}；势力战：20:45`),
      row('11.15', '星期天', ['终末猎杀', '巨龙讨伐', '征服宣令', '周排名结算'], `终末猎杀：${weekendHuntTime}；巨龙讨伐：${dragonTime}；征服宣令：20:45—21:10、21:15—21:40；周排名结算：21:00`),
    ],
  },
  standardWeek('第二周：11 月 16 日 — 11 月 22 日', ['11.16', '11.17', '11.18', '11.19', '11.20', '11.21', '11.22']),
  standardWeek('第三周：11 月 23 日 — 11 月 29 日', ['11.23', '11.24', '11.25', '11.26', '11.27', '11.28', '11.29']),
  standardWeek('第四周：11 月 30 日 — 12 月 6 日', ['11.30', '12.01', '12.02', '12.03', '12.04', '12.05', '12.06']),
];

export function isFocusDay(weekday: string) {
  return focusDays.has(weekday);
}

export function timeParts(text: string) {
  const parts: { text: string; bold: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(clockPattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), bold: false });
    parts.push({ text: match[1], bold: true });
    last = index + match[1].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts;
}

export function notifyAt(at: string) {
  const [hour, minute] = at.split(':').map(Number);
  const total = hour * 60 + minute - 30;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function startPoints(row: ScheduleRow): StartPoint[] {
  return row.activities.flatMap((activity) => {
    if (activity === '终末猎杀') {
      if (row.weekday === '星期五' || row.weekday === '星期天') {
        return [
          { activity, phase: '第一场高倍', at: '12:00' },
          { activity, phase: '第二场高倍', at: '20:00' },
        ];
      }
      return [{ activity, phase: '高倍', at: '19:00' }];
    }
    if (activity === '巨龙讨伐') return [{ activity, phase: '开始', at: '20:00' }];
    if (activity === '战略服巨龙讨伐') return [{ activity, phase: '开线', at: '19:50' }];
    if (activity === '霜陨领主' || activity === '拍卖高原战') {
      return [{ activity, phase: '开始', at: '20:45' }];
    }
    if (activity === '势力战（猎城战）') return [{ activity, phase: '开始', at: '20:45' }];
    if (activity === '征服宣令') {
      return [
        { activity, phase: '第一场', at: '20:45' },
        { activity, phase: '第二场', at: '21:15' },
      ];
    }
    if (activity === '周排名结算') return [{ activity, phase: '结算', at: '21:00' }];
    return [];
  });
}

function noticeLabel(point: StartPoint, multiple: boolean) {
  if (!multiple || point.phase === '结算') return point.phase;
  if (point.phase === '开始' || point.phase === '高倍') return point.activity;
  return `${point.activity}${point.phase}`;
}

export function noticeItems(row: ScheduleRow) {
  const multiple = row.activities.length > 1;
  return startPoints(row)
    .sort((left, right) => left.at.localeCompare(right.at))
    .map((point) => ({
      key: `${point.activity}-${point.phase}-${point.at}`,
      notify: point.exact ? point.at : notifyAt(point.at),
      label: noticeLabel(point, multiple),
    }));
}

export function activityTone(name: string) {
  if (name === '拍卖高原战' || name === '霜陨领主' || name === '势力战（猎城战）') return 'warning';
  if (name === '终末猎杀') return 'danger';
  if (name === '巨龙讨伐' || name === '战略服巨龙讨伐') return 'success';
  if (name === '征服宣令') return 'info';
  return 'primary';
}
