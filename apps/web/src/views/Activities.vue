<template>
  <div class="page-head">
    <div>
      <h1>活动签到</h1>
      <p>发布后，企业微信里的成员可以点开卡片绑定角色并签到。</p>
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
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ (row as ActivityItem).status === 'PUBLISHED' ? '已发布' : '已结束' }}</template>
      </el-table-column>
      <el-table-column label="通知" min-width="140">
        <template #default="{ row }">{{ noticeText(row as ActivityItem) }}</template>
      </el-table-column>
      <el-table-column label="操作" :width="narrow ? 112 : 280" :fixed="narrow ? false : 'right'">
        <template #default="{ row }">
          <div class="cell-ops">
            <el-button link type="primary" @click="router.push(`/activities/${(row as ActivityItem).id}`)">签到情况</el-button>
            <el-button v-if="(row as ActivityItem).status === 'PUBLISHED'" link type="primary" @click="resend(row as ActivityItem, 'publish')">重发卡片</el-button>
            <el-button v-if="(row as ActivityItem).status === 'PUBLISHED'" link type="primary" @click="resend(row as ActivityItem, 'remind')">重发提醒</el-button>
            <el-button v-if="(row as ActivityItem).status === 'PUBLISHED'" link type="danger" @click="finish(row as ActivityItem)">结束</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
  <el-dialog v-model="creating" title="发布活动" width="560px" @closed="resetForm">
    <el-alert v-if="configError" :title="configError" type="warning" show-icon :closable="false" style="margin-bottom: 12px" />
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
      <el-form-item label="提醒时间">
        <el-date-picker v-model="form.remindAt" type="datetime" placeholder="可留空，不发提醒" style="width: 100%" />
      </el-form-item>
      <el-form-item label="部门">
        <el-select v-model="form.partyIds" multiple filterable placeholder="可见范围内的部门" style="width: 100%">
          <el-option v-for="item in audience.parties" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="标签">
        <el-select v-model="form.tagIds" multiple filterable placeholder="可见范围内的标签" style="width: 100%">
          <el-option v-for="item in audience.tags" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="成员">
        <el-select v-model="form.userIds" multiple filterable placeholder="可见范围内的成员" style="width: 100%">
          <el-option v-for="item in audience.users" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-alert v-if="formError" :title="formError" type="error" show-icon :closable="false" />
    </el-form>
    <template #footer>
      <el-button @click="creating = false">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="Boolean(configError)" @click="submit">发布</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useNarrow } from '../composables/viewport';
import { useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import {
  createActivity,
  endActivity,
  errorMessage,
  listActivities,
  listClubs,
  resendActivity,
  wecomAudience,
  type ActivityItem,
  type ClubItem,
  type WecomAudience,
} from '../api/client';

const router = useRouter();
const narrow = useNarrow();
const clubs = ref<ClubItem[]>([]);
const activities = ref<ActivityItem[]>([]);
const audience = ref<WecomAudience>({ parties: [], tags: [], users: [] });
const loading = ref(false);
const saving = ref(false);
const creating = ref(false);
const error = ref('');
const formError = ref('');
const configError = ref('');
const form = reactive({
  title: '',
  clubIds: [] as string[],
  startsAt: null as Date | null,
  remindAt: null as Date | null,
  partyIds: [] as string[],
  tagIds: [] as string[],
  userIds: [] as string[],
});

function clubNames(row: ActivityItem) {
  return row.clubs.map((club) => club.name).join('、');
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function noticeText(row: ActivityItem) {
  if (row.publishStatus === 'FAILED') return row.publishError || '发送失败';
  if (row.publishError) return row.publishError;
  if (row.publishStatus === 'SENT') return '已发送';
  return '—';
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
  form.clubIds = [];
  form.startsAt = null;
  form.remindAt = null;
  form.partyIds = [];
  form.tagIds = [];
  form.userIds = [];
}

async function openCreate() {
  resetForm();
  configError.value = '';
  creating.value = true;
  try {
    audience.value = await wecomAudience();
  } catch (cause) {
    configError.value = errorMessage(cause, '企业微信未配置');
    audience.value = { parties: [], tags: [], users: [] };
  }
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
  if (form.partyIds.length + form.tagIds.length + form.userIds.length === 0) {
    formError.value = '请选择部门、标签或成员';
    return;
  }
  saving.value = true;
  formError.value = '';
  try {
    await createActivity({
      title: form.title.trim(),
      clubIds: form.clubIds,
      startsAt: form.startsAt.toISOString(),
      remindAt: form.remindAt ? form.remindAt.toISOString() : null,
      partyIds: form.partyIds,
      tagIds: form.tagIds,
      userIds: form.userIds,
    });
    creating.value = false;
    await load();
  } catch (cause) {
    formError.value = errorMessage(cause, '发布失败');
  } finally {
    saving.value = false;
  }
}

async function finish(row: ActivityItem) {
  try {
    await ElMessageBox.confirm(`结束「${row.title}」后不能再签到。`, '结束活动', { type: 'warning' });
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

async function resend(row: ActivityItem, kind: 'publish' | 'remind') {
  error.value = '';
  try {
    await resendActivity(row.id, kind);
    await load();
  } catch (cause) {
    error.value = errorMessage(cause, '发送失败');
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
