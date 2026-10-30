<template>
  <div class="page-head">
    <div>
      <h1>活动查看</h1>
      <p>查看公开报名表，可删改并标记迟到或未到。</p>
    </div>
  </div>
  <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
  <el-card shadow="never" style="margin-bottom: 12px">
    <el-form inline @submit.prevent="reload">
      <el-form-item label="活动" required>
        <el-select v-model="activityId" placeholder="请选择活动" style="width: 280px" filterable @change="onActivityChange">
          <el-option v-for="item in activityOptions" :key="item.id" :label="item.title" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="俱乐部">
        <el-select v-model="clubFilter" clearable placeholder="全部" style="width: 200px" :disabled="!activityId" @change="reload">
          <el-option v-for="club in clubOptions" :key="club.id" :label="club.name" :value="club.id" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :icon="Search":disabled="!activityId" :loading="loading" @click="reload">查询</el-button>
        <el-button :icon="Download" :loading="exporting" :disabled="rows.length === 0" @click="exportExcel">导出</el-button>
      </el-form-item>
    </el-form>
  </el-card>
  <el-card shadow="never">
    <div class="batch-bar">
      <el-text v-if="selected.length" type="info">已选 {{ selected.length }} 人</el-text>
      <el-button :disabled="selected.length === 0" :loading="batchPatching" @click="batchSetStatus('NORMAL')">设为正常</el-button>
      <el-button :disabled="selected.length === 0" :loading="batchPatching" @click="batchSetStatus('LATE')">设为迟到</el-button>
      <el-button :disabled="selected.length === 0" :loading="batchPatching" @click="batchSetStatus('ABSENT')">设为未到</el-button>
    </div>
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="rows"
      empty-text="请选择活动后查询，或该活动还没有报名"
      row-key="id"
      @sort-change="onSort"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" reserve-selection />
      <el-table-column prop="clubName" label="俱乐部" min-width="120" sortable="custom" />
      <el-table-column prop="playerName" label="非凡者名称" min-width="120" sortable="custom" />
      <el-table-column prop="score" label="当前最高评分" width="150" sortable="custom" />
      <el-table-column prop="professionLabel" label="职业" width="100" sortable="custom" />
      <el-table-column label="出席状态" width="120" sortable="custom" prop="attendanceStatus">
        <template #default="{ row }">
          <el-tag :type="statusTagType((row as RegistrationRowItem).attendanceStatus)" effect="plain">
            {{ (row as RegistrationRowItem).statusLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="报名时间" min-width="170" sortable="custom" prop="createdAt">
        <template #default="{ row }">{{ formatTime((row as RegistrationRowItem).createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row as RegistrationRowItem)">编辑</el-button>
          <el-button link type="danger" @click="removeRow(row as RegistrationRowItem)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="editing" title="编辑报名" width="480px" @closed="resetEdit">
    <el-form label-position="top">
      <el-form-item label="俱乐部" required>
        <el-select v-model="editForm.clubId" style="width: 100%">
          <el-option v-for="club in clubOptions" :key="club.id" :label="club.name" :value="club.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="非凡者名称" required>
        <el-input v-model="editForm.playerName" maxlength="64" />
      </el-form-item>
      <el-form-item label="当前最高评分" required>
        <el-input-number v-model="editForm.score" :min="1" :max="999999" controls-position="right" style="width: 100%" />
      </el-form-item>
      <el-form-item label="职业" required>
        <el-select v-model="editForm.profession" style="width: 100%">
          <el-option v-for="item in REGISTRATION_PROFESSION_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="出席状态">
        <el-select v-model="editForm.attendanceStatus" style="width: 100%">
          <el-option v-for="(label, key) in REGISTRATION_STATUS_LABEL" :key="key" :label="label" :value="key" />
        </el-select>
      </el-form-item>
      <el-alert v-if="formError" :title="formError" type="error" show-icon :closable="false" />
    </el-form>
    <template #footer>
      <el-button @click="editing = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Download, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type TableInstance } from 'element-plus';
import {
  REGISTRATION_PROFESSION_OPTIONS,
  REGISTRATION_STATUS_LABEL,
  type RegistrationAttendanceStatus,
  type RegistrationProfession,
} from '@ocr/shared-types';
import {
  deleteRegistration,
  errorMessage,
  listRegistrationActivities,
  listRegistrations,
  patchRegistration,
  type RegistrationActivityOption,
  type RegistrationRowItem,
} from '../api/client';
import { downloadRegistrationWorkbook } from './export-activity-registrations';

const route = useRoute();
const activityOptions = ref<RegistrationActivityOption[]>([]);
const activityId = ref('');
const activityTitle = ref('');
const clubOptions = ref<Array<{ id: string; name: string }>>([]);
const clubFilter = ref('');
const rows = ref<RegistrationRowItem[]>([]);
const loading = ref(false);
const exporting = ref(false);
const error = ref('');
const sortBy = ref<string | undefined>();
const sortOrder = ref<'asc' | 'desc' | undefined>();
const tableRef = ref<TableInstance>();
const selected = ref<RegistrationRowItem[]>([]);
const batchPatching = ref(false);

const editing = ref(false);
const editId = ref('');
const saving = ref(false);
const formError = ref('');
const editForm = reactive({
  clubId: '',
  playerName: '',
  score: 1,
  profession: 'WARRIOR' as RegistrationProfession,
  attendanceStatus: 'NORMAL' as RegistrationAttendanceStatus,
});

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function statusTagType(status: RegistrationAttendanceStatus): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'LATE') return 'warning';
  if (status === 'ABSENT') return 'danger';
  return 'success';
}

function onSelectionChange(items: RegistrationRowItem[]) {
  selected.value = items;
}

async function loadActivities() {
  activityOptions.value = await listRegistrationActivities();
  if (!activityId.value && activityOptions.value[0]) {
    activityId.value = activityOptions.value[0].id;
  }
}

async function reload() {
  if (!activityId.value) {
    rows.value = [];
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const data = await listRegistrations({
      activityId: activityId.value,
      clubId: clubFilter.value || undefined,
      sortBy: sortBy.value as Parameters<typeof listRegistrations>[0]['sortBy'],
      sortOrder: sortOrder.value,
    });
    rows.value = data.rows;
    activityTitle.value = data.activity.title;
    clubOptions.value = data.activity.clubs;
    selected.value = [];
    tableRef.value?.clearSelection();
  } catch (cause) {
    error.value = errorMessage(cause, '加载失败');
  } finally {
    loading.value = false;
  }
}

function onActivityChange() {
  clubFilter.value = '';
  void reload();
}

function onSort(payload: { prop: string | null; order: 'ascending' | 'descending' | null }) {
  if (!payload.order || !payload.prop) {
    sortBy.value = undefined;
    sortOrder.value = undefined;
  } else {
    const propMap: Record<string, string> = {
      clubName: 'clubName',
      playerName: 'playerName',
      score: 'score',
      professionLabel: 'profession',
      attendanceStatus: 'attendanceStatus',
      createdAt: 'createdAt',
    };
    sortBy.value = propMap[payload.prop] ?? payload.prop;
    sortOrder.value = payload.order === 'ascending' ? 'asc' : 'desc';
  }
  void reload();
}

async function batchSetStatus(status: RegistrationAttendanceStatus) {
  if (selected.value.length === 0) return;
  const label = REGISTRATION_STATUS_LABEL[status];
  try {
    await ElMessageBox.confirm(`将所选 ${selected.value.length} 人设为「${label}」？`, '批量改出席状态', {
      type: 'info',
    });
  } catch {
    return;
  }
  batchPatching.value = true;
  error.value = '';
  try {
    const updatedList = await Promise.all(
      selected.value.map((row) => patchRegistration(row.id, { attendanceStatus: status })),
    );
    const byId = new Map(updatedList.map((item) => [item.id, item]));
    rows.value = rows.value.map((row) => byId.get(row.id) ?? row);
    selected.value = [];
    tableRef.value?.clearSelection();
    ElMessage.success(`已更新 ${updatedList.length} 人`);
  } catch (cause) {
    error.value = errorMessage(cause, '批量更新失败');
  } finally {
    batchPatching.value = false;
  }
}

function openEdit(row: RegistrationRowItem) {
  editId.value = row.id;
  editForm.clubId = row.clubId;
  editForm.playerName = row.playerName;
  editForm.score = row.score;
  editForm.profession = row.profession;
  editForm.attendanceStatus = row.attendanceStatus;
  formError.value = '';
  editing.value = true;
}

function resetEdit() {
  editId.value = '';
  formError.value = '';
}

async function saveEdit() {
  if (!editForm.playerName.trim()) {
    formError.value = '请填写非凡者名称';
    return;
  }
  saving.value = true;
  formError.value = '';
  try {
    await patchRegistration(editId.value, {
      clubId: editForm.clubId,
      playerName: editForm.playerName.trim(),
      score: editForm.score,
      profession: editForm.profession,
      attendanceStatus: editForm.attendanceStatus,
    });
    editing.value = false;
    await reload();
    ElMessage.success('已保存');
  } catch (cause) {
    formError.value = errorMessage(cause, '保存失败');
  } finally {
    saving.value = false;
  }
}

async function removeRow(row: RegistrationRowItem) {
  try {
    await ElMessageBox.confirm(`删除「${row.playerName}」的报名记录？`, '删除', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await deleteRegistration(row.id);
    rows.value = rows.value.filter((item) => item.id !== row.id);
  } catch (cause) {
    error.value = errorMessage(cause, '删除失败');
  }
}

async function exportExcel() {
  exporting.value = true;
  try {
    const clubName = clubFilter.value
      ? (clubOptions.value.find((c) => c.id === clubFilter.value)?.name ?? '')
      : '全部';
    await downloadRegistrationWorkbook(rows.value, {
      activityTitle: activityTitle.value || '活动',
      clubName: clubName || '全部',
    });
  } finally {
    exporting.value = false;
  }
}

onMounted(async () => {
  const fromQuery = route.query.activityId;
  if (typeof fromQuery === 'string' && fromQuery) activityId.value = fromQuery;
  try {
    await loadActivities();
    if (typeof fromQuery === 'string' && fromQuery) activityId.value = fromQuery;
    await reload();
  } catch (cause) {
    error.value = errorMessage(cause, '活动列表加载失败');
  }
});

watch(
  () => route.query.activityId,
  (value) => {
    if (typeof value === 'string' && value && value !== activityId.value) {
      activityId.value = value;
      void reload();
    }
  },
);
</script>

<style scoped>
.batch-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
</style>
