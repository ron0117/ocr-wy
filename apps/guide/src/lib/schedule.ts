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

const focusDays = new Set(['星期五', '星期六', '星期天']);
const clockPattern = /(\d{1,2}:\d{2})/g;

export const scheduleRules: ScheduleRule[] = [
  {
    name: '高原竞逐',
    detail: '12:00--20:30 报名，20:45--21:15 进行。',
    notices: [
      { at: '12:00', phase: '报名' },
      { at: '20:30', phase: '截止报名', exact: true },
    ],
  },
  {
    name: '终末猎杀',
    detail: '高倍时间 20:00--21:00。',
    notices: [{ at: '20:00', phase: '高倍' }],
  },
  {
    name: '跨服巨龙',
    detail: '20:00--20:45 进行；周日场为 19:00--20:00 进行。',
    notices: [
      { at: '20:00', phase: '平日集合' },
      { at: '19:00', phase: '周日集合' },
    ],
  },
  {
    name: '四方联赛',
    detail: '20:00 开始。',
    notices: [{ at: '20:00', phase: '开始' }],
  },
  {
    name: '势力战',
    detail: '12:00--20:30 报名，20:45--21:15 进行。',
    notices: [
      { at: '12:00', phase: '报名' },
      { at: '20:45', phase: '集合' },
    ],
  },
  {
    name: '附加赛',
    detail: '20:00 开始。',
    notices: [{ at: '20:00', phase: '开始' }],
  },
];

export const scheduleWeeks: ScheduleWeek[] = [
  {
    title: '第三周：非势力战周（11 月 2 日 — 11 月 8 日）',
    rows: [
      { date: '11 月 2 日', weekday: '星期一', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '11 月 3 日', weekday: '星期二', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '11 月 4 日', weekday: '星期三', activities: ['高原竞逐'], time: '12:00--20:30 报名；20:45--21:15 进行' },
      { date: '11 月 5 日', weekday: '星期四', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '11 月 6 日', weekday: '星期五', activities: ['跨服巨龙'], time: '20:00--20:45 进行' },
      {
        date: '11 月 7 日',
        weekday: '星期六',
        activities: ['四方联赛', '势力战'],
        time: '四方联赛：20:00 开始；势力战：12:00--20:30 报名，20:45--21:15 进行',
      },
      {
        date: '11 月 8 日',
        weekday: '星期天',
        activities: ['跨服巨龙', '四方联赛附加赛'],
        time: '跨服巨龙：20:00--20:45；附加赛：20:45 开始',
      },
    ],
  },
  {
    title: '第四周：附加赛周',
    partial: true,
    rows: [
      { date: '11 月 9 日', weekday: '星期一', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '11 月 10 日', weekday: '星期二', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '11 月 11 日', weekday: '星期三', activities: ['高原竞逐'], time: '12:00--20:30 报名；20:45--21:15 进行' },
    ],
  },
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
    if (activity === '高原竞逐') {
      return [
        { activity, phase: '报名', at: '12:00' },
        { activity, phase: '截止报名', at: '20:30', exact: true },
      ];
    }
    if (activity === '势力战') {
      return [
        { activity, phase: '报名', at: '12:00' },
        { activity, phase: '集合', at: '20:45' },
      ];
    }
    if (activity === '终末猎杀') return [{ activity, phase: '高倍', at: '20:00' }];
    if (activity === '跨服巨龙') {
      if (row.date === '11 月 8 日') return [{ activity, phase: '集合', at: '19:00', exact: true }];
      return [{ activity, phase: '集合', at: row.weekday === '星期天' ? '19:00' : '20:00' }];
    }
    if (activity === '四方联赛附加赛' && row.date === '11 月 8 日') return [];
    return [{ activity, phase: '开始', at: '20:00' }];
  });
}

function noticeLabel(point: StartPoint, multiple: boolean) {
  if (!multiple || point.phase === '截止报名') return point.phase;
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
  if (name === '高原竞逐') return 'warning';
  if (name === '终末猎杀' || name === '势力战') return 'danger';
  if (name === '跨服巨龙') return 'success';
  if (name === '四方联赛附加赛') return 'info';
  return 'primary';
}
