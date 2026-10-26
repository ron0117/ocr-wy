<template>
  <div class="page-head">
    <div>
      <h1>活动签到</h1>
      <p>发布后在列表展示报名链接与二维码；玩家在公开页自助报名。</p>
    </div>
    <el-button type="primary" :icon="Plus" @click="openCreate">发布活动</el-button>
  </div>
  <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" style="margin-bottom: 12px" />
  <el-card shadow="never">
    <el-table v-loading="loading" :data="activities" empty-text="还没有活动">
      <el-table-column prop="title" label="标题" min-width="140" />
      <el-table-column label="俱乐部" min-width="160">
        <template #default="{ row }">{{ clubNames(row as ActivityItem) }}</template>
      </el-table-column>
      <el-table-column label="开始时间" min-width="170">
        <template #default="{ row }">{{ formatTime((row as ActivityItem).startsAt) }}</template>
      </el-table-column>
      <el-table-column label="备注" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ (row as ActivityItem).note }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ (row as ActivityItem).status === 'PUBLISHED' ? '已发布' : '已结束' }}</template>
      </el-table-column>
      <el-table-column label="操作" :width="narrow ? 140 : 320" :fixed="narrow ? false : 'right'">
        <template #default="{ row }">
          <div class="cell-ops">
            <el-button link type="primary" @click="openShare(row as ActivityItem)">报名链接</el-button>
            <el-button link type="primary" @click="goRegistrations(row as ActivityItem)">活动人员列表查看</el-button>
            <el-button link type="primary" @click="openEdit(row as ActivityItem)">编辑</el-button>
            <el-button v-if="(row as ActivityItem).status === 'PUBLISHED'" link type="danger" @click="finish(row as ActivityItem)">结束</el-button>
            <el-button link type="danger" @click="remove(row as ActivityItem)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="editing" :title="editId ? '编辑活动' : '发布活动'" width="560px" @closed="resetForm">
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="标题" required>
        <el-input v-model="form.title" maxlength="80" />
      </el-form-item>
      <el-form-item label="俱乐部" required>
        <el-select v-model="form.clubIds" multiple placeholder="可多选" style="width: 100%">
          <el-option v-for="club in clubs" :key="club.id" :label="club.name" :value="club.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="开始时间" required>
        <el-date-picker v-model="form.startsAt" type="datetime" placeholder="选择开始时间" style="width: 100%" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.note" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="选填" />
      </el-form-item>
      <el-alert v-if="formError" :title="formError" type="error" show-icon :closable="false" />
    </el-form>
    <template #footer>
      <el-button @click="editing = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">{{ editId ? '保存' : '发布' }}</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="sharing" :title="shareTitle" width="420px" @closed="shareUrl = ''">
    <p class="share-label">公开报名链接</p>
    <el-input :model-value="shareUrl" readonly>
      <template #append>
        <el-button @click="copyUrl">复制</el-button>
      </template>
    </el-input>
    <div v-if="qrDataUrl" class="qr-wrap">
      <img :src="qrDataUrl" alt="报名二维码" width="200" height="200" />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useNarrow } from '../composables/viewport';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import QRCode from 'qrcode';
import {
  createActivity,
  deleteActivity,
  endActivity,
  errorMessage,
  listActivities,
  listClubs,
  updateActivity,
  type ActivityItem,
  type ClubItem,
} from '../api/client';

const router = useRouter();
const narrow = useNarrow();
const clubs = ref<ClubItem[]>([]);
const activities = ref<ActivityItem[]>([]);
const loading = ref(false);
const saving = ref(false);
const editing = ref(false);
const editId = ref('');
const error = ref('');
const formError = ref('');
const form = reactive({
  title: '',
  note: '',
  clubIds: [] as string[],
  startsAt: null as Date | null,
});
const sharing = ref(false);
const shareTitle = ref('');
const shareUrl = ref('');
const qrDataUrl = ref('');

function clubNames(row: ActivityItem) {
  return row.clubs.map((club) => club.name).join('、');
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function publicUrlFor(row: ActivityItem) {
  if (row.publicUrl) return row.publicUrl;
  const origin = window.location.origin;
  return `${origin}/a/${row.id}`;
}

async function openShare(row: ActivityItem) {
  shareTitle.value = `报名 · ${row.title}`;
  shareUrl.value = publicUrlFor(row);
  sharing.value = true;
  try {
    qrDataUrl.value = await QRCode.toDataURL(shareUrl.value, { margin: 1, width: 200 });
  } catch {
    qrDataUrl.value = '';
  }
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    ElMessage.success('已复制链接');
  } catch {
    ElMessage.warning('复制失败，请手动选择链接');
  }
}

function goRegistrations(row: ActivityItem) {
  void router.push({ path: '/activity-registrations', query: { activityId: row.id } });
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    activities.value = await listActivities();
  } catch (cause) {
    error.value = errorMessage(cause, '活动加载失败');
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  formError.value = '';
  form.title = '';
  form.note = '';
  form.clubIds = [];
  form.startsAt = null;
  editId.value = '';
}

function openCreate() {
  resetForm();
  editing.value = true;
}

function openEdit(row: ActivityItem) {
  resetForm();
  editId.value = row.id;
  form.title = row.title;
  form.note = row.note ?? '';
  form.clubIds = row.clubs.map((club) => club.id);
  form.startsAt = new Date(row.startsAt);
  editing.value = true;
}

async function submit() {
  if (!form.title.trim()) {
    formError.value = '请填写活动标题';
    return;
  }
  if (form.clubIds.length === 0) {
    formError.value = '请选择俱乐部';
    return;
  }
  if (!form.startsAt) {
    formError.value = '请选择开始时间';
    return;
  }
  saving.value = true;
  formError.value = '';
  const payload = {
    title: form.title.trim(),
    note: form.note.trim() || null,
    clubIds: form.clubIds,
    startsAt: form.startsAt.toISOString(),
  };
  try {
    if (editId.value) await updateActivity(editId.value, payload);
    else await createActivity(payload);
    editing.value = false;
    await load();
  } catch (cause) {
    formError.value = errorMessage(cause, editId.value ? '保存失败' : '发布失败');
  } finally {
    saving.value = false;
  }
}

async function finish(row: ActivityItem) {
  try {
    await ElMessageBox.confirm(`结束「${row.title}」后公开页将无法再报名。`, '结束活动', { type: 'warning' });
  } catch {
    return;
  }
  error.value = '';
  try {
    await endActivity(row.id);
    await load();
  } catch (cause) {
    error.value = errorMessage(cause, '结束失败');
  }
}

async function remove(row: ActivityItem) {
  try {
    await ElMessageBox.confirm(`删除「${row.title}」后，该活动的报名记录也会去掉。`, '删除活动', { type: 'warning' });
  } catch {
    return;
  }
  error.value = '';
  try {
    await deleteActivity(row.id);
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
.share-label {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.qr-wrap {
  margin-top: 16px;
  text-align: center;
}
</style>
