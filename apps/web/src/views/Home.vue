<template>
  <div class="page-head">
    <div>
      <h1>诡秘之主战略服筛选月活动表</h1>
    </div>
  </div>

  <el-alert
    class="schedule-block"
    type="info"
    show-icon
    :closable="false"
    title="说明：以下内容根据用户提供的截图人工整理。截图未标明年份；时间按图片原文记录。个别被界面遮挡或截断的文字，结合表格重复格式补全，并在备注中说明。"
  />

  <el-card class="schedule-block" shadow="never">
    <template #header>
      <strong>活动时间说明</strong>
    </template>
    <el-descriptions :column="1" border label-width="120px">
      <el-descriptions-item v-for="item in rules" :key="item.name" :label="item.name">
        <span class="time-cell">
          <template v-for="(part, index) in timeParts(item.detail)" :key="index">
            <strong v-if="part.bold" class="clock">{{ part.text }}</strong>
            <template v-else>{{ part.text }}</template>
          </template>
        </span>
        <div class="rule-notice">
          提前半小时通知：
          <template v-for="(point, index) in item.notices" :key="point.phase">
            <span v-if="index > 0">，</span>
            <strong class="clock">{{ point.exact ? point.at : notifyAt(point.at) }}</strong>
            {{ point.phase }}
          </template>
        </div>
      </el-descriptions-item>
    </el-descriptions>
  </el-card>

  <el-card v-for="week in weeks" :key="week.title" class="schedule-block" shadow="never">
    <template #header>
      <div class="week-title">
        <strong>{{ week.title }}</strong>
        <el-tag v-if="week.partial" type="info" effect="plain">截图可见部分</el-tag>
      </div>
    </template>
    <el-table :data="week.rows" border :row-class-name="rowClass">
      <el-table-column prop="date" label="日期" min-width="120" />
      <el-table-column label="星期" width="110">
        <template #default="{ row }">
          <el-tag v-if="isFocusDay((row as ScheduleRow).weekday)" type="danger" effect="dark">
            {{ (row as ScheduleRow).weekday }}
          </el-tag>
          <span v-else>{{ (row as ScheduleRow).weekday }}</span>
        </template>
      </el-table-column>
      <el-table-column label="活动内容" min-width="200">
        <template #default="{ row }">
          <div class="activity-tags">
            <el-tag
              v-for="name in (row as ScheduleRow).activities"
              :key="name"
              :type="tagType(name)"
              effect="light"
            >
              {{ name }}
            </el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="活动时间" min-width="280">
        <template #default="{ row }">
          <span class="time-cell">
            <template v-for="(part, index) in timeParts((row as ScheduleRow).time)" :key="index">
              <strong v-if="part.bold" class="clock">{{ part.text }}</strong>
              <template v-else>{{ part.text }}</template>
            </template>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="提前半小时通知" min-width="200">
        <template #default="{ row }">
          <div class="notice-list">
            <div v-for="item in noticeItems(row as ScheduleRow)" :key="item.key">
              <strong class="clock">{{ item.notify }}</strong>
              {{ item.label }}
            </div>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-card shadow="never">
    <template #header>
      <strong>备注</strong>
    </template>
    <ol class="notes">
      <li v-for="note in notes" :key="note">{{ note }}</li>
    </ol>
  </el-card>
</template>

<script setup lang="ts">
type ScheduleRow = {
  date: string;
  weekday: string;
  activities: string[];
  time: string;
};

type ScheduleWeek = {
  title: string;
  partial?: boolean;
  rows: ScheduleRow[];
};

const rules = [
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

const weeks: ScheduleWeek[] = [
  {
    title: '10 月 14 日 — 10 月 18 日',
    rows: [
      { date: '10 月 14 日', weekday: '星期三', activities: ['高原竞逐'], time: '12:00--20:30 报名；20:45--21:15 进行' },
      { date: '10 月 15 日', weekday: '星期四', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '10 月 16 日', weekday: '星期五', activities: ['跨服巨龙'], time: '20:00--20:45 进行' },
      { date: '10 月 17 日', weekday: '星期六', activities: ['四方联赛', '高原竞逐'], time: '四方联赛：20:00 开始；高原竞逐：12:00--20:30 报名，20:45--21:15 进行' },
      { date: '10 月 18 日', weekday: '星期天', activities: ['跨服巨龙'], time: '19:00--20:00 进行' },
    ],
  },
  {
    title: '第一周：非势力战周（10 月 19 日 — 10 月 25 日）',
    rows: [
      { date: '10 月 19 日', weekday: '星期一', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '10 月 20 日', weekday: '星期二', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '10 月 21 日', weekday: '星期三', activities: ['高原竞逐'], time: '12:00--20:30 报名；20:45--21:15 进行' },
      { date: '10 月 22 日', weekday: '星期四', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '10 月 23 日', weekday: '星期五', activities: ['跨服巨龙'], time: '20:00--20:45 进行' },
      { date: '10 月 24 日', weekday: '星期六', activities: ['四方联赛', '势力战'], time: '四方联赛：20:00 开始；势力战：12:00--20:30 报名，20:45--21:15 进行' },
      { date: '10 月 25 日', weekday: '星期天', activities: ['跨服巨龙', '四方联赛附加赛'], time: '跨服巨龙：19:00--20:00；附加赛：20:00 开始' },
    ],
  },
  {
    title: '第二周：附加赛周（10 月 26 日 — 11 月 1 日）',
    rows: [
      { date: '10 月 26 日', weekday: '星期一', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '10 月 27 日', weekday: '星期二', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '10 月 28 日', weekday: '星期三', activities: ['高原竞逐'], time: '12:00--20:30 报名；20:45--21:15 进行' },
      { date: '10 月 29 日', weekday: '星期四', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '10 月 30 日', weekday: '星期五', activities: ['跨服巨龙'], time: '20:00--20:45 进行' },
      { date: '10 月 31 日', weekday: '星期六', activities: ['四方联赛', '高原竞逐'], time: '四方联赛：20:00 开始；高原竞逐：12:00--20:30 报名，20:45--21:15 进行' },
      { date: '11 月 1 日', weekday: '星期天', activities: ['跨服巨龙'], time: '19:00--20:00 进行' },
    ],
  },
  {
    title: '第三周：非势力战周（11 月 2 日 — 11 月 8 日）',
    rows: [
      { date: '11 月 2 日', weekday: '星期一', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '11 月 3 日', weekday: '星期二', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '11 月 4 日', weekday: '星期三', activities: ['高原竞逐'], time: '12:00--20:30 报名；20:45--21:15 进行' },
      { date: '11 月 5 日', weekday: '星期四', activities: ['终末猎杀'], time: '高倍时间 20:00--21:00' },
      { date: '11 月 6 日', weekday: '星期五', activities: ['跨服巨龙'], time: '20:00--20:45 进行' },
      { date: '11 月 7 日', weekday: '星期六', activities: ['四方联赛', '势力战'], time: '四方联赛：20:00 开始；势力战：12:00--20:30 报名，20:45--21:15 进行' },
      { date: '11 月 8 日', weekday: '星期天', activities: ['跨服巨龙', '四方联赛附加赛'], time: '跨服巨龙：19:00--20:00；附加赛：20:00 开始' },
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

const notes = [
  '截图中的日期没有标注年份，因此本文未自行补充年份。',
  '截图右侧部分区域被短视频界面元素遮挡，但重复出现的活动时间格式较清楚；按相同活动的重复排期整理。',
  '第四周只整理截图中可见的日期，不推测截图下方未显示的活动。',
  '通知时间按开始时间提前 30 分钟计算：报名取报名开始，集合取进行开始，高倍取高倍开始，开赛取开始时间。高原竞逐的报名截止按 20:30 通知。周五、周六、周日整行已标出。',
];

const focusDays = new Set(['星期五', '星期六', '星期天']);
const clockPattern = /(\d{1,2}:\d{2})/g;

type StartPoint = {
  activity: string;
  phase: string;
  at: string;
  exact?: boolean;
};

function isFocusDay(weekday: string) {
  return focusDays.has(weekday);
}

function rowClass({ row }: { row: ScheduleRow }) {
  return isFocusDay(row.weekday) ? 'focus-row' : '';
}

function timeParts(text: string) {
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

function notifyAt(at: string) {
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
      return [{ activity, phase: '集合', at: row.weekday === '星期天' ? '19:00' : '20:00' }];
    }
    return [{ activity, phase: '开始', at: '20:00' }];
  });
}

function noticeItems(row: ScheduleRow) {
  const multiple = row.activities.length > 1;
  return startPoints(row)
    .sort((left, right) => left.at.localeCompare(right.at))
    .map((point) => ({
      key: `${point.activity}-${point.phase}-${point.at}`,
      notify: point.exact ? point.at : notifyAt(point.at),
      label: noticeLabel(point, multiple),
    }));
}

function noticeLabel(point: StartPoint, multiple: boolean) {
  if (!multiple || point.phase === '截止报名') return point.phase;
  if (point.phase === '开始' || point.phase === '高倍') return point.activity;
  return `${point.activity}${point.phase}`;
}

function tagType(name: string) {
  if (name === '高原竞逐') return 'warning';
  if (name === '终末猎杀' || name === '势力战') return 'danger';
  if (name === '跨服巨龙') return 'success';
  if (name === '四方联赛附加赛') return 'info';
  return 'primary';
}
</script>

<style scoped>
.schedule-block {
  margin-bottom: 16px;
}

.week-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.activity-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.time-cell,
.rule-notice,
.notice-list {
  line-height: 1.6;
}

.rule-notice {
  margin-top: 4px;
  color: #ad4e00;
}

.notice-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.clock {
  font-weight: 700;
}

:deep(.focus-row > td.el-table__cell) {
  background-color: #ffd666 !important;
}

:deep(.el-table__body tr.focus-row:hover > td.el-table__cell) {
  background-color: #ffc53d !important;
}

:deep(.focus-row > td.el-table__cell:first-child) {
  box-shadow: inset 4px 0 0 #d46b08;
}

:deep(.focus-row) .clock {
  color: #ad4e00;
}

.notes {
  margin: 0;
  padding-left: 1.25em;
  line-height: 1.7;
}

.notes li + li {
  margin-top: 8px;
}
</style>
