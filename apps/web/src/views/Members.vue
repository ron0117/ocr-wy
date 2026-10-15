<template>
    <div class="page-head">
      <div>
        <h1>人员列表</h1>
        <p>非凡评分的箭头表示相对上一次写入的升降。手工保存会把改前的评分记为上次。点表头只改变当前排序。</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增</el-button>
    </div>
    <el-card shadow="never">
      <el-form class="filter-form" inline @submit.prevent="load">
        <el-form-item label="俱乐部">
          <el-select v-model="clubId" class="filter-control" clearable placeholder="全部俱乐部">
            <el-option v-for="club in clubs" :key="club.id" :label="club.name" :value="club.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="游戏名称">
          <el-input v-model="keyword" class="filter-control" clearable placeholder="玩家名称" @keyup.enter="load" />
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :loading="loading" @click="load">查询</el-button>
          <el-button :icon="Download" :loading="exporting" :disabled="members.length === 0" @click="exportExcel">导出</el-button>
          <el-button type="danger" :disabled="selected.length === 0" :loading="removing" @click="removeSelected">
            删除{{ selected.length > 0 ? `（${selected.length}）` : '' }}
          </el-button>
        </el-form-item>
      </el-form>
      <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
      <el-table
        v-loading="loading"
        :data="members"
        empty-text="没有人员"
        row-key="id"
        :default-sort="{ prop: 'score', order: 'descending' }"
        @selection-change="onSelect"
        @sort-change="onSort"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column label="排名" width="90">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column prop="playerName" label="玩家名称" min-width="100" sortable="custom" />
        <el-table-column prop="clubName" label="俱乐部名称" min-width="100" sortable="custom" />
        <el-table-column prop="level" label="等级" width="90" sortable="custom" />
        <el-table-column prop="path" label="途径" width="110" sortable="custom" />
        <el-table-column prop="score" label="非凡评分" minWidth="100" sortable="custom">
          <template #default="{ row }">
            <span>{{ row.score ?? '—' }}</span>
            <span v-if="row.scoreChange" :class="row.scoreChange.direction === 'up' ? 'delta-up' : 'delta-down'">
              {{ row.scoreChange.direction === 'up' ? '↑' : '↓' }}{{ row.scoreChange.delta }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="fashion" label="风尚度" minWidth="100" sortable="custom" />
        <el-table-column prop="weeklyActivity" label="周活跃" width="110" sortable="custom" />
        <el-table-column prop="joinedText" label="入会时间" width="150" sortable="custom" />
        <el-table-column label="操作" :width="narrow ? 112 : 220" :fixed="narrow ? false : 'right'">
          <template #default="{ row }">
            <div class="cell-ops">
              <el-button link type="primary" @click="openHistory(row as MemberItem)">查询活跃度</el-button>
              <el-button link type="primary" @click="openEdit(row as MemberItem)">编辑</el-button>
              <el-button link type="danger" @click="remove(row as MemberItem)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="editing" :title="editId ? '编辑人员' : '新增人员'" width="520px" @closed="resetForm">
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="俱乐部" required>
          <el-select v-model="form.clubId" placeholder="请选择俱乐部" style="width: 100%">
            <el-option v-for="club in clubs" :key="club.id" :label="club.name" :value="club.id" />
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="玩家名称" required>
              <el-input v-model="form.playerName" maxlength="40" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="等级">
              <el-input-number v-model="form.level" :min="1" :step="1" :precision="0" controls-position="right" :value-on-clear="null" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="途径">
              <el-input v-model="form.path" maxlength="40" placeholder="可留空" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="非凡评分">
              <el-input-number v-model="form.score" :min="0" :step="1" :precision="0" controls-position="right" :value-on-clear="null" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="风尚度">
              <el-input-number v-model="form.fashion" :min="0" :step="1" :precision="0" controls-position="right" :value-on-clear="null" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="周活跃">
              <el-input-number v-model="form.weeklyActivity" :min="0" :step="1" :precision="0" controls-position="right" :value-on-clear="null" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入会时间">
              <el-input v-model="form.joinedText" maxlength="40" placeholder="如 26天，可留空" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-alert v-if="formError" :title="formError" type="error" show-icon :closable="false" />
      </el-form>
      <template #footer>
        <el-button @click="editing = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="historyOpen" :title="historyTitle" width="720px">
      <h3>已签到</h3>
      <el-table :data="attendedRows" empty-text="没有已签到的活动">
        <el-table-column prop="title" label="标题" min-width="140" />
        <el-table-column label="俱乐部" min-width="140">
          <template #default="{ row }">{{ activityClubs(row as AttendedRow) }}</template>
        </el-table-column>
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">{{ formatTime((row as AttendedRow).startsAt) }}</template>
        </el-table-column>
        <el-table-column label="出席" min-width="140">
          <template #default="{ row }">
            <span class="mark-in">已签到</span>
            <span v-if="(row as AttendedRow).late" class="mark-late">迟到</span>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-if="attendedSorted.length > 0"
        class="history-page"
        background
        layout="total, prev, pager, next"
        :total="attendedSorted.length"
        :page-size="historyPageSize"
        :current-page="attendedPage"
        @current-change="attendedPage = $event"
      />
      <h3 class="history-gap">未签到</h3>
      <el-table :data="missedRows" empty-text="没有未签到的活动">
        <el-table-column prop="title" label="标题" min-width="140" />
        <el-table-column label="俱乐部" min-width="140">
          <template #default="{ row }">{{ activityClubs(row as ActivityBrief) }}</template>
        </el-table-column>
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">{{ formatTime((row as ActivityBrief).startsAt) }}</template>
        </el-table-column>
        <el-table-column label="出席" min-width="140">
          <template #default>
            <span class="mark-out">未签到</span>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-if="missedSorted.length > 0"
        class="history-page"
        background
        layout="total, prev, pager, next"
        :total="missedSorted.length"
        :page-size="historyPageSize"
        :current-page="missedPage"
        @current-change="missedPage = $event"
      />
    </el-dialog>
  </template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useNarrow } from '../composables/viewport';
import { ElMessageBox } from 'element-plus';
import { Download, Plus } from '@element-plus/icons-vue';
import { downloadMemberWorkbook } from './export-members';
import {
  createMember,
  deleteMember,
  deleteMembers,
  errorMessage,
  listClubs,
  listMembers,
  memberActivities,
  updateMember,
  type ActivityBrief,
  type ClubItem,
  type MemberActivities,
  type MemberInput,
  type MemberItem,
} from '../api/client';

type AttendedRow = ActivityBrief & { late: boolean };

const narrow = useNarrow();
const clubs = ref<ClubItem[]>([]);
const members = ref<MemberItem[]>([]);
const clubId = ref<string>();
const keyword = ref('');
const sort = ref('score');
const order = ref<'asc' | 'desc'>('desc');
const selected = ref<MemberItem[]>([]);
const historyOpen = ref(false);
const historyTitle = ref('活跃度');
const history = ref<MemberActivities>({ attended: [], missed: [] });
const historyPageSize = 10;
const attendedPage = ref(1);
const missedPage = ref(1);

function byNewest<T extends { startsAt: string }>(rows: T[]) {
  return [...rows].sort((left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime());
}

const attendedSorted = computed(() => byNewest(history.value.attended));
const missedSorted = computed(() => byNewest(history.value.missed));
const attendedRows = computed(() => attendedSorted.value.slice((attendedPage.value - 1) * historyPageSize, attendedPage.value * historyPageSize));
const missedRows = computed(() => missedSorted.value.slice((missedPage.value - 1) * historyPageSize, missedPage.value * historyPageSize));
const loading = ref(false);
const saving = ref(false);
const removing = ref(false);
const exporting = ref(false);
const error = ref('');
const formError = ref('');
const editing = ref(false);
const editId = ref('');
const form = reactive({
  clubId: '',
  playerName: '',
  rank: null as number | null,
  level: null as number | null,
  path: '',
  score: null as number | null,
  fashion: null as number | null,
  weeklyActivity: null as number | null,
  joinedText: '',
});

async function load() {
  selected.value = [];
  loading.value = true;
  error.value = '';
  try {
    members.value = await listMembers({
      clubId: clubId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      sort: sort.value,
      order: order.value,
    });
  } catch (cause) {
    error.value = errorMessage(cause, '人员加载失败');
  } finally {
    loading.value = false;
  }
}

async function exportExcel() {
  if (members.value.length === 0) return;
  exporting.value = true;
  error.value = '';
  try {
    const clubName = clubs.value.find((club) => club.id === clubId.value)?.name ?? '全部俱乐部';
    await downloadMemberWorkbook(members.value, { clubName, keyword: keyword.value.trim() });
  } catch (cause) {
    error.value = errorMessage(cause, '导出失败');
  } finally {
    exporting.value = false;
  }
}

function onSelect(rows: MemberItem[]) {
  selected.value = rows;
}

function onSort(payload: { prop: string | null; order: 'ascending' | 'descending' | null }) {
  const nextSort = payload.order && payload.prop ? payload.prop : 'score';
  const nextOrder: 'asc' | 'desc' = payload.order === 'ascending' ? 'asc' : 'desc';
  if (nextSort === sort.value && nextOrder === order.value) return;
  sort.value = nextSort;
  order.value = nextOrder;
  void load();
}

function resetForm() {
  formError.value = '';
  editId.value = '';
  form.clubId = '';
  form.playerName = '';
  form.rank = null;
  form.level = null;
  form.path = '';
  form.score = null;
  form.fashion = null;
  form.weeklyActivity = null;
  form.joinedText = '';
}

function openCreate() {
  if (clubs.value.length === 0) {
    error.value = '请先创建俱乐部';
    return;
  }
  resetForm();
  form.clubId = clubId.value || '';
  editing.value = true;
}

function openEdit(row: MemberItem) {
  formError.value = '';
  editId.value = row.id;
  form.clubId = row.clubId;
  form.playerName = row.playerName;
  form.rank = row.rank;
  form.level = row.level;
  form.path = row.path ?? '';
  form.score = row.score;
  form.fashion = row.fashion;
  form.weeklyActivity = row.weeklyActivity;
  form.joinedText = row.joinedText ?? '';
  editing.value = true;
}

function payload(): MemberInput | string {
  if (!form.clubId) return '请选择俱乐部';
  if (!form.playerName.trim()) return '请填写玩家名称';
  return {
    clubId: form.clubId,
    playerName: form.playerName.trim(),
    rank: form.rank !== null && form.rank >= 0 ? form.rank : 1,
    level: form.level,
    path: form.path.trim() || null,
    score: form.score,
    fashion: form.fashion,
    weeklyActivity: form.weeklyActivity,
    joinedText: form.joinedText.trim() || null,
  };
}

async function submit() {
  const body = payload();
  if (typeof body === 'string') {
    formError.value = body;
    return;
  }
  saving.value = true;
  formError.value = '';
  try {
    if (editId.value) await updateMember(editId.value, body);
    else await createMember(body);
    editing.value = false;
    await load();
  } catch (cause) {
    formError.value = errorMessage(cause, '保存失败');
  } finally {
    saving.value = false;
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function activityClubs(row: ActivityBrief) {
  return row.clubs.map((club) => club.name).join('、');
}

async function openHistory(row: MemberItem) {
  historyTitle.value = `${row.playerName}的活跃度`;
  attendedPage.value = 1;
  missedPage.value = 1;
  historyOpen.value = true;
  history.value = { attended: [], missed: [] };
  try {
    history.value = await memberActivities(row.id);
  } catch (cause) {
    error.value = errorMessage(cause, '活跃度加载失败');
    historyOpen.value = false;
  }
}

async function removeSelected() {
  const rows = selected.value;
  if (rows.length === 0) return;
  try {
    await ElMessageBox.confirm(`删除选中的 ${rows.length} 名玩家？删除后不能恢复。`, '删除人员', { type: 'warning' });
  } catch {
    return;
  }
  removing.value = true;
  error.value = '';
  try {
    await deleteMembers(rows.map((row) => row.id));
    selected.value = [];
    await load();
  } catch (cause) {
    error.value = errorMessage(cause, '删除失败');
  } finally {
    removing.value = false;
  }
}

async function remove(row: MemberItem) {
  try {
    await ElMessageBox.confirm(`删除玩家「${row.playerName}」？删除后不能恢复。`, '删除人员', { type: 'warning' });
  } catch {
    return;
  }
  error.value = '';
  try {
    await deleteMember(row.id);
    await load();
  } catch (cause) {
    error.value = errorMessage(cause, '删除失败');
  }
}

onMounted(async () => {
  try {
    clubs.value = await listClubs();
  } catch (cause) {
    error.value = errorMessage(cause, '俱乐部加载失败');
  }
  await load();
});
</script>

<style scoped>
.history-gap {
  margin-top: 16px;
}
.history-page {
  margin-top: 12px;
  justify-content: flex-end;
}
.mark-in {
  color: #1f7a4d;
  margin-right: 8px;
}
.mark-out,
.mark-late {
  color: #c45656;
}
</style>
